import { measuredMapOperation } from '@/lib/server/mapMetrics';
import { socialRequestContext, socialStorageError } from '@/lib/server/socialHttp';
import { requireOwnedPet } from '@/lib/server/socialService';
import { applyLibraryCommand, emptyMapLibrary, type MapLibrary } from '@/lib/mapLibrary';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
    const context = await socialRequestContext(request);
    if ('response' in context)
        return context.response!;
    const petId = new URL(request.url).searchParams.get('petId') || '';
    try {
        if (!await requireOwnedPet(context.supabase, context.ownerId, petId))
            return Response.json({ error: 'PET_NOT_FOUND' }, { status: 404 });
        const { data, error } = await context.supabase.from('map_libraries').select('document').eq('pet_id', petId).eq('owner_id', context.ownerId).maybeSingle();
        if (error)
            return socialStorageError();
        return Response.json({ library: data?.document || emptyMapLibrary() }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    catch {
        return socialStorageError();
    }
}
export async function POST(request: Request) { return measuredMapOperation('library_change', request, () => measuredMutation(request)); }
async function measuredMutation(request: Request) {
    const context = await socialRequestContext(request);
    if ('response' in context)
        return context.response!;
    const body = await request.json().catch(() => null);
    const petId = body?.petId;
    if (!petId || !body?.command)
        return Response.json({ error: 'INVALID_COMMAND' }, { status: 400 });
    try {
        if (!await requireOwnedPet(context.supabase, context.ownerId, petId))
            return Response.json({ error: 'PET_NOT_FOUND' }, { status: 404 });
        // Compare-and-swap makes edits from two tabs/devices composable, never last-write-wins.
        for (let attempt = 0; attempt < 4; attempt++) {
            const current = await context.supabase.from('map_libraries').select('document,revision').eq('pet_id', petId).eq('owner_id', context.ownerId).maybeSingle();
            if (current.error)
                return socialStorageError();
            const library = (current.data?.document || emptyMapLibrary()) as MapLibrary;
            let next: MapLibrary;
            try {
                next = applyLibraryCommand(library, body.command);
            }
            catch (error) {
                return Response.json({ error: error instanceof Error ? error.message : 'INVALID_COMMAND' }, { status: 400 });
            }
            if (next === library)
                return Response.json({ library, replayed: true });
            if (!current.data) {
                const inserted = await context.supabase.from('map_libraries').insert({ pet_id: petId, owner_id: context.ownerId, revision: next.version, document: next });
                if (!inserted.error)
                    return Response.json({ library: next });
                if (inserted.error.code === '23505')
                    continue;
                return socialStorageError();
            }
            const saved = await context.supabase.from('map_libraries').update({ document: next, revision: next.version }).eq('pet_id', petId).eq('owner_id', context.ownerId).eq('revision', current.data.revision).select('revision').maybeSingle();
            if (saved.error)
                return socialStorageError();
            if (saved.data)
                return Response.json({ library: next });
        }
        return Response.json({ error: 'LIBRARY_BUSY' }, { status: 409 });
    }
    catch {
        return socialStorageError();
    }
}
