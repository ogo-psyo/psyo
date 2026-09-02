import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadMainRecommendation,
  recommendationActionLabel,
  transitionRecommendation,
} from '../../lib/recommendations/client.ts';
import type { Recommendation } from '../../packages/recommendations/contracts.ts';

const recommendation = {
  id: 'recommendation-1',
  petId: 'pet-1',
  scenarioKey: 'care_due',
  policyVersion: 'care_due@1',
  category: 'care',
  risk: 'routine',
  status: 'eligible',
  createdAt: '2026-09-02T12:00:00.000Z',
  freshUntil: '2026-09-03T12:00:00.000Z',
  expiresAt: '2026-09-04T12:00:00.000Z',
  evidence: [{ sourceType: 'reminder', sourceId: 'reminder-1', capturedAt: '2026-09-02T12:00:00.000Z', ownerConfirmed: true }],
  missingData: [], conflicts: [], suppressionReasons: [],
  confidence: { dataSufficiency: 'high', sourceReliability: 'high', ruleCertainty: 'high' },
  rank: { tier: 1, urgency: 90, actionability: 100, relevance: 100, annoyancePenalty: 0 },
  title: 'Пора проверить лапы', whyNow: ['Дело запланировано на сегодня'],
  primaryAction: { intent: 'open_reminder', reminderId: 'reminder-1' },
  fingerprint: 'a'.repeat(64),
} satisfies Recommendation;

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('recommendation load retries a transient response once and returns the main item', async () => {
  const calls: RequestInit[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    calls.push(init ?? {});
    return calls.length === 1 ? response(503, { code: 'STORAGE_UNAVAILABLE' }) : response(200, { main: recommendation });
  };
  const result = await loadMainRecommendation({ petId: 'pet-1', headers: { Authorization: 'Bearer token' }, fetcher });
  assert.equal(result?.id, recommendation.id);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.method, 'POST');
});

test('recommendation load does not retry owner or validation failures', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls += 1; return response(401, { code: 'AUTH_REQUIRED' }); };
  await assert.rejects(() => loadMainRecommendation({ petId: 'pet-1', fetcher }), /AUTH_REQUIRED/);
  assert.equal(calls, 1);
});

test('default browser fetch keeps the global receiver', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async function (this: unknown) {
    assert.equal(this, globalThis);
    called = true;
    return response(200, { main: recommendation });
  } as typeof fetch;
  try {
    const result = await loadMainRecommendation({ petId: 'pet-1' });
    assert.equal(result?.id, recommendation.id);
    assert.equal(called, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('lifecycle transition sends an idempotency key and validated command', async () => {
  let seen: { url?: string; init?: RequestInit } = {};
  const fetcher: typeof fetch = async (input, init) => {
    seen = { url: String(input), init };
    return response(200, { recommendation: { ...recommendation, status: 'shown' } });
  };
  const shown = await transitionRecommendation({ recommendationId: recommendation.id, command: { action: 'show' }, fetcher });
  assert.equal(shown.status, 'shown');
  assert.match(String(seen.url), /recommendations\/recommendation-1$/);
  assert.equal(new Headers(seen.init?.headers).has('Idempotency-Key'), true);
  assert.deepEqual(JSON.parse(String(seen.init?.body)), { action: 'show' });
});

test('each typed recommendation action has concise Russian copy', () => {
  assert.equal(recommendationActionLabel({ intent: 'open_reminder', reminderId: '1' }), 'Открыть дело');
  assert.equal(recommendationActionLabel({ intent: 'open_health' }), 'Открыть наблюдения');
  assert.equal(recommendationActionLabel({ intent: 'open_habits' }), 'Добавить привычку');
  assert.equal(recommendationActionLabel({ intent: 'plan_walk', zoneIds: [], limitation: 'route_not_verified_safe' }), 'Спланировать прогулку');
  assert.equal(recommendationActionLabel({ intent: 'add_wishlist', draft: { title: 'Поводок', category: 'walk', reason: 'Для прогулки' } }), 'Добавить в вещи');
  assert.equal(recommendationActionLabel({ intent: 'open_gav', view: 'live_signal', signalId: 'signal-1' }), 'Открыть Гав');
  assert.equal(recommendationActionLabel({ intent: 'open_gav', view: 'requests', requestId: 'request-1' }), 'Ответить');
  assert.equal(recommendationActionLabel({ intent: 'open_gav', view: 'give_signal' }), 'Дать Гав');
});
