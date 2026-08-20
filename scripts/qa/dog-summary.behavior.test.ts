import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDogSummary } from '../../lib/server/dogSummaryService.ts';

const pet = { name: 'Боня', life_stage: 'adult', sex: 'female', breed_id: 'corgi' };

test('summary is empty when only the dog profile exists', () => {
  const summary = buildDogSummary({ pet, reminders: [], habits: [], observations: [], places: [], things: [] });
  assert.equal(summary.status, 'empty');
  assert.deepEqual(summary.profile, { facts: 4, total: 4 });
});

test('overdue owner reminder sets attention without medical inference', () => {
  const now = new Date('2026-08-20T10:00:00.000Z');
  const summary = buildDogSummary({
    now,
    pet,
    reminders: [{ status: 'active', due_at: '2026-08-19T10:00:00.000Z' }],
    habits: [], observations: [], places: [], things: [],
  });
  assert.equal(summary.status, 'attention');
  assert.equal(summary.reminders.overdue, 1);
});

test('daily habit progress counts only today check-ins', () => {
  const now = new Date('2026-08-20T10:00:00.000Z');
  const summary = buildDogSummary({
    now,
    pet,
    reminders: [], observations: [], places: [], things: [],
    habits: [{
      status: 'active', cadence: 'daily', target_per_period: 2,
      habit_checkins: [
        { completed_at: '2026-08-20T08:00:00.000Z' },
        { completed_at: '2026-08-19T08:00:00.000Z' },
      ],
    }],
  });
  assert.equal(summary.status, 'active');
  assert.deepEqual(summary.habits, { active: 1, completedToday: 1, targetToday: 2 });
});
