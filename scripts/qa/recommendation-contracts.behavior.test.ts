import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseLifecycleCommand,
  validateRecommendation,
  type Recommendation,
  type RecommendationAction,
} from '../../packages/recommendations/contracts';

const baseRecommendation: Recommendation = {
  id: 'rec-1',
  petId: 'pet-1',
  scenarioKey: 'care_due',
  policyVersion: 'care_due@1',
  category: 'care',
  risk: 'routine',
  status: 'eligible',
  createdAt: '2026-09-02T10:00:00.000Z',
  freshUntil: '2026-09-03T10:00:00.000Z',
  expiresAt: '2026-09-04T10:00:00.000Z',
  evidence: [{
    sourceType: 'reminder',
    sourceId: 'reminder-1',
    capturedAt: '2026-09-02T10:00:00.000Z',
    dueAt: '2026-09-02T09:00:00.000Z',
    ownerConfirmed: true,
    excerpt: 'Обработка от клещей',
  }],
  missingData: [],
  conflicts: [],
  suppressionReasons: [],
  confidence: {
    dataSufficiency: 'high',
    sourceReliability: 'high',
    ruleCertainty: 'high',
  },
  rank: { tier: 2, urgency: 100, actionability: 100, relevance: 100, annoyancePenalty: 0 },
  title: 'Проверьте дело ухода',
  whyNow: ['Срок дела уже наступил'],
  primaryAction: { intent: 'open_reminder', reminderId: 'reminder-1' },
  fingerprint: 'a'.repeat(64),
};

test('normalizes valid lifecycle commands', () => {
  assert.deepEqual(parseLifecycleCommand({ action: 'show' }), {
    ok: true,
    value: { action: 'show' },
  });
  assert.deepEqual(parseLifecycleCommand({ action: 'snooze', until: '2026-09-03T12:00:00Z' }), {
    ok: true,
    value: { action: 'snooze', until: '2026-09-03T12:00:00.000Z' },
  });
  assert.deepEqual(parseLifecycleCommand({ action: 'dismiss', reason: 'wrong_data' }), {
    ok: true,
    value: { action: 'dismiss', reason: 'wrong_data' },
  });
  assert.deepEqual(parseLifecycleCommand({ action: 'accept' }), {
    ok: true,
    value: { action: 'accept' },
  });
});

test('rejects malformed or unsupported lifecycle commands', () => {
  assert.equal(parseLifecycleCommand({ action: 'snooze', until: 'bad' }).ok, false);
  assert.equal(parseLifecycleCommand({ action: 'dismiss', reason: 'unknown' }).ok, false);
  assert.equal(parseLifecycleCommand({ action: 'complete' }).ok, false);
  assert.equal(parseLifecycleCommand(null).ok, false);
});

test('accepts the five allowlisted primary action shapes', () => {
  const actions: RecommendationAction[] = [
    { intent: 'open_reminder', reminderId: 'reminder-1' },
    { intent: 'open_health', observationId: 'observation-1' },
    { intent: 'open_habits', draft: { kind: 'training', title: 'Спокойная выдержка', cadence: 'daily', targetPerPeriod: 1 } },
    { intent: 'plan_walk', zoneIds: ['zone-1'], limitation: 'route_not_verified_safe' },
    { intent: 'add_wishlist', draft: { title: 'Подобрать адресник', category: 'gear', reason: 'Для прогулки' } },
  ];

  for (const primaryAction of actions) {
    assert.deepEqual(validateRecommendation({ ...baseRecommendation, primaryAction }), { ok: true });
  }
});

test('enforces bounded explanation and evidence copy', () => {
  assert.deepEqual(validateRecommendation(baseRecommendation), { ok: true });
  assert.deepEqual(validateRecommendation({ ...baseRecommendation, whyNow: [] }), {
    ok: false,
    error: 'WHY_NOW_REQUIRED',
  });
  assert.deepEqual(validateRecommendation({ ...baseRecommendation, whyNow: ['one', 'two', 'three'] }), {
    ok: false,
    error: 'WHY_NOW_LIMIT_EXCEEDED',
  });
  assert.deepEqual(validateRecommendation({
    ...baseRecommendation,
    evidence: [{ ...baseRecommendation.evidence[0], excerpt: 'x'.repeat(161) }],
  }), { ok: false, error: 'EVIDENCE_EXCERPT_LIMIT_EXCEEDED' });
});

test('does not expose owner identity or private source payload in the contract', () => {
  assert.equal('ownerId' in baseRecommendation, false);
  assert.equal('payload' in baseRecommendation.evidence[0], false);
  assert.equal(JSON.stringify(baseRecommendation).includes('microchip'), false);
});
