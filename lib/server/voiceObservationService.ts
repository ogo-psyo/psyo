import type { ObservationCandidate } from '@/lib/observationIngestion';
import { createHash } from 'node:crypto';

const allowedMetrics = new Set(['mood', 'energy', 'appetite', 'stool', 'sleep']);
const allowedDirections = new Set(['down', 'stable', 'up', 'unknown']);

export class VoiceIngestionError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'VoiceIngestionError';
  }
}

function normalizedCandidates(candidates: ObservationCandidate[], petId: string) {
  if (!Array.isArray(candidates) || candidates.length < 1 || candidates.length > 6) {
    throw new VoiceIngestionError('INVALID_CANDIDATE_BATCH');
  }
  return candidates.map((candidate) => {
    if (!candidate.confirmed) throw new VoiceIngestionError('CONFIRMATION_REQUIRED');
    if (candidate.petId !== petId) throw new VoiceIngestionError('PET_MISMATCH');
    if (!allowedMetrics.has(candidate.metric)) throw new VoiceIngestionError('INVALID_CANDIDATE_METRIC');
    if (!allowedDirections.has(candidate.direction)) throw new VoiceIngestionError('INVALID_CANDIDATE_DIRECTION');
    if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0.8 || candidate.confidence > 1) {
      throw new VoiceIngestionError('CONFIDENCE_TOO_LOW');
    }
    const value = candidate.value.trim();
    if (!value || value.length > 120) throw new VoiceIngestionError('INVALID_CANDIDATE_VALUE');
    const observedAt = new Date(candidate.observedAt);
    if (!Number.isFinite(observedAt.getTime())) throw new VoiceIngestionError('INVALID_OBSERVED_AT');
    const onsetAt = candidate.onsetAt ? new Date(candidate.onsetAt) : null;
    if (onsetAt && !Number.isFinite(onsetAt.getTime())) throw new VoiceIngestionError('INVALID_ONSET_AT');
    return {
      id: candidate.id,
      captureId: candidate.captureId,
      metric: candidate.metric,
      value,
      direction: candidate.direction,
      observedAt: observedAt.toISOString(),
      onsetAt: onsetAt?.toISOString() ?? null,
      confidence: candidate.confidence,
      transcriptSpan: candidate.transcriptSpan.slice(0, 200),
      confirmed: true,
    };
  });
}

function stableFingerprint(value: unknown) {
  const canonical = JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right)))
    : item);
  return createHash('sha256').update(canonical).digest('hex');
}

export async function ingestVoiceObservationBatch(input: {
  supabase: any;
  ownerId: string;
  petId: string;
  idempotencyKey: string;
  candidates: ObservationCandidate[];
}) {
  if (input.idempotencyKey.length < 8 || input.idempotencyKey.length > 128) throw new VoiceIngestionError('INVALID_IDEMPOTENCY_KEY');
  const candidates = normalizedCandidates(input.candidates, input.petId);
  const captureId = String(candidates[0]?.captureId || '').slice(0, 128);
  if (!captureId || candidates.some((candidate) => candidate.captureId !== captureId)) throw new VoiceIngestionError('CAPTURE_MISMATCH');

  const result = await input.supabase.rpc('ingest_voice_observation_batch', {
    p_owner_id: input.ownerId,
    p_pet_id: input.petId,
    p_idempotency_key: input.idempotencyKey,
    p_request_fingerprint: stableFingerprint({ petId: input.petId, candidates }),
    p_candidates: candidates,
    p_capture_id: captureId,
    p_author_id: input.ownerId,
  });
  if (result.error) {
    const message = String(result.error.message || '');
    for (const code of ['VOICE_INGESTION_RATE_LIMITED', 'IDEMPOTENCY_KEY_REUSED', 'PET_NOT_FOUND', 'CARE_MUTATION_IN_PROGRESS']) {
      if (message.includes(code)) throw new VoiceIngestionError(code);
    }
    throw new VoiceIngestionError('VOICE_INGESTION_FAILED');
  }
  if (!result.data || typeof result.data !== 'object') throw new VoiceIngestionError('VOICE_INGESTION_FAILED');
  return result.data as { observation: Record<string, unknown>; decisions: unknown[]; summary: Record<string, number>; replayed?: boolean };
}
