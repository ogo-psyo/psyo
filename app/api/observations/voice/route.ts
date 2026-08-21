import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { ingestVoiceObservationBatch, VoiceIngestionError } from '@/lib/server/voiceObservationService';

export const runtime = 'nodejs';

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function statusFor(code: string) {
  if (['INVALID_CANDIDATE_BATCH', 'CONFIRMATION_REQUIRED', 'PET_MISMATCH', 'INVALID_CANDIDATE_METRIC', 'INVALID_CANDIDATE_DIRECTION', 'CONFIDENCE_TOO_LOW', 'INVALID_CANDIDATE_VALUE', 'INVALID_OBSERVED_AT', 'INVALID_ONSET_AT', 'INVALID_IDEMPOTENCY_KEY', 'CAPTURE_MISMATCH'].includes(code)) return 400;
  if (code === 'PET_NOT_FOUND') return 404;
  if (code === 'VOICE_INGESTION_RATE_LIMITED') return 429;
  if (['IDEMPOTENCY_KEY_REUSED', 'CARE_MUTATION_IN_PROGRESS'].includes(code)) return 409;
  return 503;
}

export async function POST(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId) return json({ error: 'AUTH_REQUIRED' }, 401);

  const idempotencyKey = request.headers.get('idempotency-key') || '';
  const body = await request.json().catch(() => null) as { petId?: string; candidates?: unknown[] } | null;
  if (!body?.petId || !Array.isArray(body.candidates)) return json({ error: 'INVALID_CANDIDATE_BATCH' }, 400);
  const admin = getSupabaseAdmin();
  if (!admin) return json({ error: 'VOICE_INGESTION_UNAVAILABLE' }, 503);

  try {
    const result = await ingestVoiceObservationBatch({
      supabase: admin,
      ownerId,
      petId: body.petId,
      idempotencyKey,
      candidates: body.candidates as never,
    });
    return json(result as unknown as Record<string, unknown>, 200);
  } catch (error) {
    if (error instanceof VoiceIngestionError) return json({ error: error.code }, statusFor(error.code));
    return json({ error: 'VOICE_INGESTION_FAILED' }, 503);
  }
}
