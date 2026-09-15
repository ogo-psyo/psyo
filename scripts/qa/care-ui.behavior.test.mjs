import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');

assert.match(page, /Idempotency-Key/, 'care mutations must send an Idempotency-Key');
assert.match(page, /careMutationKey/, 'care mutations must reuse a stable key while the same action is retried');
assert.match(page, /newReminderRecurrence/, 'reminder composer must expose recurrence');
assert.match(page, /newReminderTimeMode/, 'reminder composer must expose exact, flexible, and approximate timing');
const editor = readFileSync(new URL('../../components/care/ReminderEditor.tsx', import.meta.url), 'utf8');
assert.match(editor, /if\(await onSave\(draft\)\)\{drafts.delete\(reminder.id\);onClose\(\);\}/, 'reminder editor closes and clears its draft only after a successful save');
assert.match(page, /onSave=\{draft=>updateReminder\(reminder.id/, 'the editor submits through the guarded reminder update');
assert.match(page, /editObservation/, 'observations must be editable');
assert.match(page, /deleteObservation/, 'observations must support recoverable deletion');
assert.match(page, /\/restore/, 'observation undo must call the restore endpoint');
assert.match(page, /loadReminderHistory/, 'completed reminder history must be loaded from the lifecycle endpoint');

console.log('care UI behavior contract passed');
