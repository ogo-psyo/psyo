import assert from 'node:assert/strict';
import test from 'node:test';
import { generateGuardedAssistantAnswer } from '../../lib/server/assistantAnswerService';

const base = {
  ownerId: 'owner-1',
  kind: 'general' as const,
  rulesAnswer: 'Безопасный ответ по правилам.',
  prompt: 'Вопрос и безопасный контекст.',
  supabase: {},
};

test('uses Groq only for an authenticated non-medical question after claiming capacity', async () => {
  const events: string[] = [];
  const result = await generateGuardedAssistantAnswer(base, {
    availability: () => ({ available: true }),
    claim: async () => { events.push('claim'); return 19; },
    generate: async () => { events.push('generate'); return { text: 'Контекстный ответ без медицинских обещаний.', usage: { inputTokens: 20, outputTokens: 8 } }; },
  });
  assert.deepEqual(events, ['claim', 'generate']);
  assert.equal(result.provider, 'groq');
  assert.equal(result.mode, 'groq_contextual');
  assert.equal(result.safetyLevel, 'non_medical_guidance');
  assert.deepEqual(result.usage, { inputTokens: 20, outputTokens: 8 });
});

test('keeps health triage deterministic and never sends it to the model', async () => {
  let called = false;
  const result = await generateGuardedAssistantAnswer({ ...base, kind: 'health_triage' }, {
    availability: () => ({ available: true }),
    claim: async () => { called = true; return 1; },
    generate: async () => { called = true; return { text: 'unsafe', usage: { inputTokens: 1, outputTokens: 1 } }; },
  });
  assert.equal(called, false);
  assert.equal(result.provider, 'rules');
  assert.equal(result.mode, 'rules_health_boundary');
  assert.equal(result.safetyLevel, 'vet_boundary');
});

test('falls back to rules on quota and rejects unsafe dosage-like output', async () => {
  for (const scenario of ['quota', 'unsafe'] as const) {
    const result = await generateGuardedAssistantAnswer(base, {
      availability: () => ({ available: true }),
      claim: async () => 1,
      generate: async () => {
        if (scenario === 'quota') throw Object.assign(new Error('quota'), { code: 'ASSISTANT_QUOTA_EXHAUSTED' });
        return { text: 'Дайте собаке 50 мг препарата.', usage: { inputTokens: 10, outputTokens: 10 } };
      },
    });
    assert.equal(result.provider, 'rules');
    assert.equal(result.answer, base.rulesAnswer);
    assert.match(result.mode, /^rules_fallback_/);
  }
});

test('guest questions remain rules-only and do not consume provider quota', async () => {
  let called = false;
  const result = await generateGuardedAssistantAnswer({ ...base, ownerId: null }, {
    availability: () => ({ available: true }),
    claim: async () => { called = true; return 1; },
    generate: async () => { called = true; return { text: 'model', usage: { inputTokens: 1, outputTokens: 1 } }; },
  });
  assert.equal(called, false);
  assert.equal(result.mode, 'rules_guest');
});
