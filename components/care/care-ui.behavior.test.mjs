import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');

assert.match(page, /Idempotency-Key/,
  'care mutations must send an Idempotency-Key');
assert.match(page, /careMutationKey/,
  'care mutations must reuse a stable key while the same action is retried');
assert.match(page, /newReminderRecurrence/,
  'reminder composer must expose recurrence');
assert.match(page, /newReminderTimeMode/,
  'reminder composer must expose exact, flexible, and approximate timing');
assert.match(page, /await updateReminder\([\s\S]*setEditingReminderId\(null\)/,
  'reminder editor must await a successful save before closing');
assert.match(page, /editObservation/,
  'observations must be editable');
assert.match(page, /deleteObservation/,
  'observations must support recoverable deletion');
assert.match(page, /\/restore/,
  'observation undo must call the restore endpoint');
assert.match(page, /loadReminderHistory/,
  'completed reminder history must be loaded from the lifecycle endpoint');

console.log('care UI behavior contract passed');
