import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestVoiceObservationBatch, VoiceIngestionError } from '../../lib/server/voiceObservationService';
import type { ObservationCandidate } from '../../lib/observationIngestion';

function candidate(overrides: Partial<ObservationCandidate> = {}): ObservationCandidate {
  return {
    id: 'candidate-energy',
    captureId: 'capture-1',
    petId: '00000000-0000-4000-8000-000000000010',
    metric: 'energy',
    value: 'спит больше обычного',
    direction: 'down',
    observedAt: '2026-08-21T10:00:00.000Z',
    onsetAt: '2026-08-20T10:00:00.000Z',
    authorId: '00000000-0000-4000-8000-000000000001',
    source: 'voice',
    confidence: 0.94,
    transcriptSpan: 'больше спит со вчера',
    confirmed: true,
    ...overrides,
  };
}

test('sends one bounded confirmed batch to the atomic Supabase RPC', async () => {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const supabase = {
    rpc: async (name: string, params: Record<string, unknown>) => {
      calls.push({ name, params });
      return { data: { observation: { id: 'observation-1' }, decisions: [{ operation: 'merge' }], summary: { merge: 1 } }, error: null };
    },
  };

  const result = await ingestVoiceObservationBatch({
    supabase,
    ownerId: '00000000-0000-4000-8000-000000000001',
    petId: '00000000-0000-4000-8000-000000000010',
    idempotencyKey: 'voice-capture-1234',
    candidates: [candidate()],
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'ingest_voice_observation_batch');
  assert.equal(calls[0].params.p_owner_id, '00000000-0000-4000-8000-000000000001');
  assert.equal(calls[0].params.p_pet_id, '00000000-0000-4000-8000-000000000010');
  assert.equal(calls[0].params.p_idempotency_key, 'voice-capture-1234');
  assert.deepEqual(result.summary, { merge: 1 });
});

test('rejects unsafe candidates before touching the database', async () => {
  let called = false;
  const supabase = { rpc: async () => { called = true; return { data: null, error: null }; } };
  await assert.rejects(
    ingestVoiceObservationBatch({
      supabase,
      ownerId: '00000000-0000-4000-8000-000000000001',
      petId: '00000000-0000-4000-8000-000000000010',
      idempotencyKey: 'voice-capture-1234',
      candidates: [candidate({ confirmed: false })],
    }),
    (error: Error) => error instanceof VoiceIngestionError && error.code === 'CONFIRMATION_REQUIRED',
  );
  assert.equal(called, false);
});

test('maps database rate limiting and conflicts to stable service errors', async () => {
  for (const [message, code] of [
    ['VOICE_INGESTION_RATE_LIMITED', 'VOICE_INGESTION_RATE_LIMITED'],
    ['IDEMPOTENCY_KEY_REUSED', 'IDEMPOTENCY_KEY_REUSED'],
  ] as const) {
    const supabase = { rpc: async () => ({ data: null, error: { message } }) };
    await assert.rejects(
      ingestVoiceObservationBatch({
        supabase,
        ownerId: '00000000-0000-4000-8000-000000000001',
        petId: '00000000-0000-4000-8000-000000000010',
        idempotencyKey: 'voice-capture-1234',
        candidates: [candidate()],
      }),
      (error: Error) => error instanceof VoiceIngestionError && error.code === code,
    );
  }
});
