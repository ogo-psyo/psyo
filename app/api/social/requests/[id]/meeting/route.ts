import { measuredMapOperation } from '@/lib/server/mapMetrics';
import { createHash } from 'node:crypto';
import { socialRequestContext, socialStorageError } from '@/lib/server/socialHttp';
import { isOwnerPairBlocked } from '@/lib/server/socialService';
import { previewMeetingPlace, previewMeetingRoute, type MeetingPreview } from '@/lib/meetingPlace';
import { storedRoutePoints } from '@/lib/routeGeometry';
import type { MapLibrary } from '@/lib/mapLibrary';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Ctx = {
    params: Promise<{
        id: string;
    }>;
};
async function contextFor(request: Request, id: string) {
    const context = await socialRequestContext(request);
    if ('response' in context)
        return { response: context.response! };
    const { data: connection, error } = await context.supabase.from('social_match_requests').select('id,status,source,sender_owner_id,recipient_owner_id,sender_pet_id,recipient_pet_id').eq('id', id).maybeSingle();
    if (error || !connection || connection.status !== 'accepted' || ![connection.sender_owner_id, connection.recipient_owner_id].includes(context.ownerId))
        return { response: Response.json({ error: 'CONNECTION_UNAVAILABLE' }, { status: 404 }) };
    if (await isOwnerPairBlocked(context.supabase, connection.sender_owner_id, connection.recipient_owner_id))
        return { response: Response.json({ error: 'CONNECTION_UNAVAILABLE' }, { status: 404 }) };
    if (connection.source !== 'invite' && connection.source !== 'signal') {
        const { data, error } = await context.supabase.from('social_discovery_profiles').select('pet_id,discoverable').in('pet_id', [connection.sender_pet_id, connection.recipient_pet_id]);
        if (error)
            return { response: socialStorageError() };
        if (data?.filter(p => p.discoverable).length !== 2)
            return { response: Response.json({ error: 'CONNECTION_UNAVAILABLE' }, { status: 404 }) };
    }
    return { ...context, connection };
}
const fingerprint = (value: MeetingPreview) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function sourcePreview(context: Exclude<Awaited<ReturnType<typeof contextFor>>, {
    response: unknown;
}>, ownerId: string, petId: string, kind: unknown, id: unknown): Promise<MeetingPreview | null> {
    if (typeof id !== 'string')
        return null;
    if (kind === 'place') {
        const { data, error } = await context.supabase.from('map_libraries').select('document').eq('owner_id', ownerId).eq('pet_id', petId).maybeSingle();
        if (error)
            throw Error('STORAGE');
        const place = (data?.document as MapLibrary | undefined)?.places.find(p => p.id === id && !p.unavailable);
        return place ? previewMeetingPlace(place) : null;
    }
    if (kind === 'route') {
        const { data, error } = await context.supabase.from('map_routes').select('id,title,path,path_gaps').eq('owner_id', ownerId).eq('pet_id', petId).eq('id', id).maybeSingle();
        if (error)
            throw Error('STORAGE');
        if (!data || data.path_gaps?.length)
            return null;
        const points = storedRoutePoints(data.path);
        return points ? previewMeetingRoute(data.id, data.title, points) : null;
    }
    return null;
}
export async function POST(request: Request, ctx: Ctx) {
    const body = await request.clone().json().catch(() => null);
    return measuredMapOperation(body?.action === 'preview' ? 'meeting_preview' : 'meeting_send', request, () => measuredMutation(request, ctx));
}
async function measuredMutation(request: Request, ctx: Ctx) {
    try {
        const { id } = await ctx.params;
        const context = await contextFor(request, id);
        if ('response' in context)
            return context.response!;
        const body = await request.json().catch(() => null);
        const petId = context.connection.sender_owner_id === context.ownerId ? context.connection.sender_pet_id : context.connection.recipient_pet_id;
        const preview = await sourcePreview(context, context.ownerId, petId, body?.kind, body?.sourceId);
        if (!preview)
            return Response.json({ error: 'MEETING_OBJECT_UNAVAILABLE' }, { status: 409 });
        const digest = fingerprint(preview);
        if (body?.action === 'preview')
            return Response.json({ preview, fingerprint: digest });
        if (body?.action !== 'send' || body?.fingerprint !== digest || body?.confirmed !== true || typeof body?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id))
            return Response.json({ error: 'PREVIEW_CONFIRMATION_REQUIRED' }, { status: 409 });
        const row = { id: body.id, request_id: id, author_owner_id: context.ownerId, author_pet_id: petId, kind: preview.kind, source_id: preview.sourceId, snapshot: preview, fingerprint: digest };
        const result = await context.supabase.from('social_meeting_proposals').insert(row);
        if (result.error?.code === '23505') {
            const existing = await context.supabase.from('social_meeting_proposals').select('fingerprint').eq('id', body.id).eq('author_owner_id', context.ownerId).eq('request_id', id).maybeSingle();
            if (existing.data?.fingerprint !== digest)
                return Response.json({ error: 'PROPOSAL_CONFLICT' }, { status: 409 });
        }
        else if (result.error)
            return socialStorageError();
        return Response.json({ ok: true, id: body.id, replayed: result.error?.code === '23505' });
    }
    catch {
        return socialStorageError();
    }
}
export async function GET(request: Request, ctx: Ctx) {
    try {
        const { id } = await ctx.params;
        const context = await contextFor(request, id);
        if ('response' in context)
            return context.response!;
        const { data, error } = await context.supabase.from('social_meeting_proposals').select('id,author_owner_id,author_pet_id,kind,source_id,snapshot,fingerprint,created_at').eq('request_id', id).order('created_at', { ascending: false }).limit(30);
        if (error)
            return socialStorageError();
        const proposals = [];
        for (const row of data || []) {
            const current = await sourcePreview(context, row.author_owner_id, row.author_pet_id, row.kind, row.source_id);
            const available = current && fingerprint(current) === row.fingerprint;
            proposals.push({ id: row.id, mine: row.author_owner_id === context.ownerId, createdAt: row.created_at, status: available ? 'available' : 'changed_or_unavailable', preview: available ? row.snapshot : null });
        }
        return Response.json({ proposals }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch {
        return socialStorageError();
    }
}
