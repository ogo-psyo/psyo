import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyIdempotentCareMutation,
  completeReminder,
  restoreObservation,
  softDeleteObservation,
  snoozeReminder,
  type CareMutationLedger,
  type CareObservationState,
  type CareReminderState,
} from '../../lib/server/careLifecycle';

const reminder: CareReminderState = {
  id: 'reminder-1',
  petId: 'pet-a',
  title: 'Обработка от клещей',
  dueAt: '2026-01-31T09:00:00.000Z',
  recurrence: 'monthly',
  status: 'active',
};

const ledger: CareMutationLedger = new Map();
const firstCompletion = applyIdempotentCareMutation(
  ledger,
  { ownerId: 'owner-a', key: 'complete:reminder-1:jan', operation: 'complete', fingerprint: 'same-request' },
  () => completeReminder(reminder, '2026-01-31T10:00:00.000Z'),
);
const replayedCompletion = applyIdempotentCareMutation(
  ledger,
  { ownerId: 'owner-a', key: 'complete:reminder-1:jan', operation: 'complete', fingerprint: 'same-request' },
  () => completeReminder(firstCompletion.value.reminder, '2026-02-28T10:00:00.000Z'),
);

assert.equal(firstCompletion.replayed, false);
assert.equal(replayedCompletion.replayed, true);
assert.equal(firstCompletion.value.historyOccurrence.dueAt, '2026-01-31T09:00:00.000Z');
assert.equal(firstCompletion.value.reminder.status, 'active');
assert.equal(firstCompletion.value.reminder.dueAt, '2026-02-28T09:00:00.000Z');
assert.equal(replayedCompletion.value.reminder.dueAt, '2026-02-28T09:00:00.000Z');

assert.throws(() => applyIdempotentCareMutation(
  ledger,
  { ownerId: 'owner-a', key: 'complete:reminder-1:jan', operation: 'complete', fingerprint: 'different-request' },
  () => completeReminder(reminder, '2026-01-31T10:00:00.000Z'),
), /IDEMPOTENCY_KEY_REUSED/);

const done = completeReminder({ ...reminder, recurrence: 'none' }, '2026-01-31T10:00:00.000Z');
assert.equal(done.reminder.status, 'done');
assert.equal(done.nextOccurrence, null);

const snoozed = snoozeReminder(reminder, '2026-02-01T12:00:00.000Z');
assert.equal(snoozed.status, 'snoozed');
assert.equal(snoozed.snoozedUntil, '2026-02-01T12:00:00.000Z');

const observation: CareObservationState = {
  id: 'observation-1',
  petId: 'pet-a',
  type: 'mood',
  value: 'спокойная',
  deletedAt: null,
};
const deleted = softDeleteObservation(observation, '2026-08-13T12:00:00.000Z');
assert.equal(deleted.deletedAt, '2026-08-13T12:00:00.000Z');
assert.equal(restoreObservation(deleted).deletedAt, null);

assert.throws(
  () => softDeleteObservation({ ...observation, petId: 'pet-b' }, 'invalid'),
  /INVALID_DATE/,
);

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const careHttp = source('lib/server/careHttp.ts');
const reminderCreateApi = source('app/api/reminders/route.ts');
const reminderUpdateApi = source('app/api/reminders/[id]/route.ts');
const reminderCompleteApi = source('app/api/reminders/[id]/complete/route.ts');
const reminderSnoozeApi = source('app/api/reminders/[id]/snooze/route.ts');
const reminderHistoryApi = source('app/api/reminders/[id]/history/route.ts');
const observationCreateApi = source('app/api/observations/route.ts');
const observationItemApi = source('app/api/observations/[id]/route.ts');
const observationRestoreApi = source('app/api/observations/[id]/restore/route.ts');
const migration = source('supabase/migrations/20260813210000_care_lifecycle.sql');
const atomicMigration = source('supabase/migrations/20260813230000_atomic_care_mutations.sql');

assert.match(careHttp, /readCareIdempotencyKey/);
for (const api of [reminderCreateApi, reminderUpdateApi, reminderCompleteApi, reminderSnoozeApi, observationCreateApi, observationItemApi, observationRestoreApi]) {
  assert.match(api, /readCareIdempotencyKey/);
}
for (const api of [reminderCreateApi, reminderUpdateApi, reminderCompleteApi, reminderSnoozeApi]) {
  assert.match(api, /care_\w+_reminder_atomic/);
  assert.doesNotMatch(api, /beginCareMutation|finishCareMutation|abortCareMutation/);
}
for (const api of [observationCreateApi, observationItemApi, observationRestoreApi]) {
  assert.match(api, /beginCareMutation/);
}
assert.match(reminderHistoryApi, /event_type[\s\S]*completed/);
assert.match(observationCreateApi, /is\('deleted_at', null\)/);
assert.doesNotMatch(observationItemApi, /\.delete\(\)/);
assert.match(observationItemApi, /deleted_at/);
assert.match(observationRestoreApi, /deleted_at:\s*null/);
assert.match(migration, /create table if not exists public\.care_mutations/);
assert.match(migration, /unique \(owner_id, idempotency_key\)/);
assert.match(migration, /add column if not exists deleted_at timestamptz/);
assert.match(atomicMigration, /security definer/);
assert.match(atomicMigration, /pg_advisory_xact_lock/);

console.log('care CRUD behavior ok');
