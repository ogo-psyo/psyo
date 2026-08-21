import assert from 'node:assert/strict';
import test from 'node:test';
import { extractStructuredObservations } from '../../lib/server/observationExtractionService';

const input = {
  transcript: 'Мята сегодня активно поела, довольная и бодрая.',
  captureId: 'capture-1',
  petId: 'pet-1',
  authorId: 'owner-1',
  observedAt: '2026-08-21T09:30:00.000Z',
  source: 'voice' as const,
  supabase: {},
};

test('uses bounded Groq JSON and validates candidates against the transcript', async () => {
  const result = await extractStructuredObservations(input, {
    available: () => ({ available: true }),
    claim: async () => 19,
    generate: async () => ({
      text: JSON.stringify({ candidates: [
        { metric: 'appetite', value: 'поела хорошо', direction: 'stable', transcriptSpan: 'активно поела', onset: 'today', confidence: 0.94 },
        { metric: 'mood', value: 'довольная', direction: 'up', transcriptSpan: 'довольная', onset: 'today', confidence: 0.95 },
        { metric: 'energy', value: 'бодрая', direction: 'stable', transcriptSpan: 'бодрая', onset: 'today', confidence: 0.93 },
      ] }),
      usage: { inputTokens: 20, outputTokens: 30 },
    }),
  });

  assert.equal(result.provider, 'groq');
  assert.deepEqual(result.candidates.map(({ metric, source }) => ({ metric, source })), [
    { metric: 'appetite', source: 'voice' },
    { metric: 'mood', source: 'voice' },
    { metric: 'energy', source: 'voice' },
  ]);
});

test('drops hallucinated spans and falls back to deterministic extraction when Groq is unavailable', async () => {
  const hallucinated = await extractStructuredObservations(input, {
    available: () => ({ available: true }),
    claim: async () => 19,
    generate: async () => ({
      text: JSON.stringify({ candidates: [{ metric: 'symptom', value: 'температура', direction: 'down', transcriptSpan: 'температура 40', onset: 'today', confidence: 0.99 }] }),
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
  });
  assert.equal(hallucinated.candidates.some((item) => item.metric === 'symptom'), false);

  const fallback = await extractStructuredObservations({ ...input, source: 'text' }, {
    available: () => ({ available: false, reason: 'ASSISTANT_LLM_DISABLED' }),
    claim: async () => 19,
    generate: async () => { throw new Error('must not run'); },
  });
  assert.equal(fallback.provider, 'rules');
  assert.ok(fallback.candidates.length >= 3);
  assert.ok(fallback.candidates.every((item) => item.source === 'text'));
});

test('never accepts a model value that is not supported by its quoted transcript span', async () => {
  const result = await extractStructuredObservations(input, {
    available: () => ({ available: true }),
    claim: async () => 19,
    generate: async () => ({
      text: JSON.stringify({ candidates: [{ metric: 'energy', value: 'температура 40', direction: 'stable', transcriptSpan: 'бодрая', onset: 'today', confidence: 0.99 }] }),
      usage: { inputTokens: 10, outputTokens: 10 },
    }),
  });
  const energy = result.candidates.find((item) => item.metric === 'energy');
  assert.ok(energy);
  assert.equal(energy.value, 'бодрая');
  assert.equal(energy.value.includes('температура'), false);
});
