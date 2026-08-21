import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { principalsAgree } from '@/lib/socialCore';
import { planObservationIngestion, type ExistingStructuredObservation } from '@/lib/observationIngestion';
import { extractStructuredObservations } from '@/lib/server/observationExtractionService';

export const runtime = 'nodejs';

type Dependencies = { admin: typeof getSupabaseAdmin; extract: typeof extractStructuredObservations };

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function createObservationExtractionPostHandler(dependencies: Dependencies = { admin: getSupabaseAdmin, extract: extractStructuredObservations }) {
  return async (request: Request) => {
    const auth = await getRequestAuth(request);
    const session = getAppSessionFromRequest(request);
    if (!principalsAgree({ bearerOwnerId: auth.user?.id, sessionOwnerId: session?.ownerId })) return json({ error: 'IDENTITY_PRINCIPAL_MISMATCH' }, 401);
    const ownerId = auth.user?.id ?? session?.ownerId;
    if (!ownerId) return json({ error: 'AUTH_REQUIRED' }, 401);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const petId = String(body?.petId || '');
    const captureId = String(body?.captureId || '');
    const transcript = String(body?.transcript || '').trim();
    const observedAt = String(body?.observedAt || '');
    const source = body?.source === 'text' ? 'text' : 'voice';
    if (!petId || !captureId || !transcript || transcript.length > 600 || !Number.isFinite(new Date(observedAt).getTime())) return json({ error: 'INVALID_EXTRACTION_REQUEST' }, 400);

    const supabase = dependencies.admin();
    if (!supabase) return json({ error: 'OBSERVATION_EXTRACTION_UNAVAILABLE' }, 503);
    const pet = await supabase.from('pets').select('id').eq('id', petId).eq('owner_id', ownerId).maybeSingle();
    if (!pet.data?.id) return json({ error: 'PET_NOT_FOUND' }, 404);

    const extracted = await dependencies.extract({ transcript, captureId, petId, authorId: ownerId, observedAt, source, supabase });
    let decisions: unknown[] = [];
    if (extracted.candidates.length) {
      const existingResult = await supabase.from('pet_observations').select('id,pet_id,type,value,observed_at,metadata').eq('pet_id', petId).is('deleted_at', null).order('observed_at', { ascending: false }).limit(40);
      const existing: ExistingStructuredObservation[] = (existingResult.data ?? []).flatMap((row: any) => {
        const metric = row.type;
        if (!['mood', 'energy', 'appetite', 'stool', 'sleep', 'activity', 'symptom', 'behavior_change'].includes(metric)) return [];
        return [{ id: row.id, petId: row.pet_id, metric, value: row.value, direction: row.metadata?.candidate?.direction ?? 'unknown', observedAt: row.observed_at, authorId: row.metadata?.voiceCapture?.authorId ?? ownerId }];
      });
      decisions = planObservationIngestion({ candidates: extracted.candidates.map((candidate) => ({ ...candidate, confirmed: true })), existing }).decisions;
    }
    return json({ candidates: extracted.candidates, decisions, provider: extracted.provider, mode: extracted.mode }, 200);
  };
}

export const POST = createObservationExtractionPostHandler();
