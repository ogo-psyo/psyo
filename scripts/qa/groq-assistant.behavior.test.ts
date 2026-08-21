import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GroqAssistantError,
  generateGroqAssistantAnswer,
  groqAssistantAvailability,
  type GroqAssistantDependencies,
} from '../../lib/server/groqAssistant';

function fixture(response: Response) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const dependencies: GroqAssistantDependencies = {
    apiKey: 'qa-groq-key',
    enabled: true,
    model: 'qwen/qwen3.6-27b',
    fetch: async (url, init) => { calls.push({ url: String(url), init }); return response; },
  };
  return { calls, dependencies };
}

test('requires both the production gate and Groq key', () => {
  assert.deepEqual(groqAssistantAvailability({ enabled: false, apiKey: 'key' }), { available: false, reason: 'ASSISTANT_LLM_DISABLED' });
  assert.deepEqual(groqAssistantAvailability({ enabled: true, apiKey: '' }), { available: false, reason: 'ASSISTANT_LLM_NOT_CONFIGURED' });
  assert.deepEqual(groqAssistantAvailability({ enabled: true, apiKey: 'key' }), { available: true });
});

test('sends a bounded Russian assistant request to Groq chat completions', async () => {
  const fixtureData = fixture(Response.json({
    choices: [{ message: { content: 'Сначала уточни длительность прогулки и уровень усталости.' } }],
    usage: { prompt_tokens: 120, completion_tokens: 18 },
  }));
  const result = await generateGroqAssistantAnswer({
    system: 'Отвечай по-русски и не ставь диагнозы.',
    prompt: 'Сделай спокойный план прогулки для Мяты.',
  }, fixtureData.dependencies);

  assert.equal(fixtureData.calls.length, 1);
  assert.equal(fixtureData.calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  const body = JSON.parse(String(fixtureData.calls[0].init?.body));
  assert.equal(body.model, 'qwen/qwen3.6-27b');
  assert.equal(body.temperature, 0.1);
  assert.equal(body.max_completion_tokens, 700);
  assert.deepEqual(body.messages.map((message: { role: string }) => message.role), ['system', 'user']);
  assert.equal(result.text, 'Сначала уточни длительность прогулки и уровень усталости.');
  assert.deepEqual(result.usage, { inputTokens: 120, outputTokens: 18 });
});

test('maps quota, auth and provider failures without leaking response bodies', async () => {
  for (const [status, code] of [[429, 'ASSISTANT_QUOTA_EXHAUSTED'], [401, 'ASSISTANT_PROVIDER_AUTH_FAILED'], [503, 'ASSISTANT_PROVIDER_UNAVAILABLE']] as const) {
    const fixtureData = fixture(new Response('provider secret body', { status }));
    await assert.rejects(
      generateGroqAssistantAnswer({ system: 'safe', prompt: 'question' }, fixtureData.dependencies),
      (error: Error) => error instanceof GroqAssistantError && error.code === code && !error.message.includes('secret'),
    );
  }
});

test('rejects empty and overlong completions', async () => {
  for (const content of ['', 'x'.repeat(1801)]) {
    const fixtureData = fixture(Response.json({ choices: [{ message: { content } }] }));
    await assert.rejects(
      generateGroqAssistantAnswer({ system: 'safe', prompt: 'question' }, fixtureData.dependencies),
      (error: Error) => error instanceof GroqAssistantError && error.code === 'ASSISTANT_INVALID_RESPONSE',
    );
  }
});
