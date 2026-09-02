import assert from 'node:assert/strict';
import test from 'node:test';
import { processRecommendationOutcomeRetries } from '../../lib/server/recommendations/outcomeRetry.ts';

const due = {
  id: 'failure-1', ownerId: 'owner-1', outcomeKey: 'outcome-key-1', recommendationId: 'recommendation-1',
  domainType: 'habit' as const, domainId: 'habit-1', result: 'completed' as const,
  occurredAt: '2026-09-02T12:00:00.000Z', attemptCount: 0,
};

test('retry worker deletes a durable failure only after the outcome links', async () => {
  const deleted: string[] = [];
  const result = await processRecommendationOutcomeRetries({
    now: new Date('2026-09-02T13:00:00.000Z'),
    store: {
      listDue: async () => [due],
      remove: async (id) => { deleted.push(id); },
      reschedule: async () => { throw new Error('must not reschedule'); },
      countExhausted: async () => 0,
    },
    record: async (item) => { assert.equal(item.idempotencyKey, due.outcomeKey); },
  });
  assert.deepEqual(deleted, ['failure-1']);
  assert.deepEqual(result, { scanned: 1, linked: 1, rescheduled: 0, exhausted: 0 });
});

test('retry worker backs off a failed outcome and exposes exhausted backlog for alerting', async () => {
  const updates: Array<{ id: string; attemptCount: number; nextRetryAt: string; errorCode: string }> = [];
  const result = await processRecommendationOutcomeRetries({
    now: new Date('2026-09-02T13:00:00.000Z'),
    store: {
      listDue: async () => [{ ...due, attemptCount: 2 }],
      remove: async () => { throw new Error('must not delete'); },
      reschedule: async (update) => { updates.push(update); },
      countExhausted: async () => 1,
    },
    record: async () => { throw new Error('DOMAIN_TARGET_NOT_FOUND'); },
  });
  assert.equal(updates[0]?.attemptCount, 3);
  assert.equal(updates[0]?.nextRetryAt, '2026-09-02T13:40:00.000Z');
  assert.equal(updates[0]?.errorCode, 'DOMAIN_TARGET_NOT_FOUND');
  assert.deepEqual(result, { scanned: 1, linked: 0, rescheduled: 1, exhausted: 1 });
});
