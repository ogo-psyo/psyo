#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const source = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const migration = source('supabase/migrations/20260813230000_atomic_care_mutations.sql');
const concurrencySpec = source('supabase/tests/isolation/care_atomicity_concurrency.spec');
const routes = [
  source('app/api/reminders/route.ts'),
  source('app/api/reminders/[id]/route.ts'),
  source('app/api/reminders/[id]/complete/route.ts'),
  source('app/api/reminders/[id]/snooze/route.ts'),
];

for (const functionName of [
  'care_create_reminder_atomic',
  'care_update_reminder_atomic',
  'care_delete_reminder_atomic',
  'care_complete_reminder_atomic',
  'care_snooze_reminder_atomic',
]) {
  assert.match(migration, new RegExp(`create or replace function public\\.${functionName}\\b`, 'i'));
  assert.match(migration, new RegExp(`revoke all on function public\\.${functionName}[\\s\\S]*?from public, anon, authenticated`, 'i'));
  assert.match(migration, new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*?to service_role`, 'i'));
}

assert.match(migration, /security definer/gi);
assert.match(migration, /set search_path = ''/gi);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /for update/gi);
assert.match(migration, /IDEMPOTENCY_KEY_REUSED/);
assert.match(migration, /request_fingerprint/);
assert.match(migration, /historyOccurrence/);
assert.match(migration, /nextOccurrence/);
assert.match(migration, /insert into public\.reminders[\s\S]*insert into public\.reminder_events[\s\S]*care_finish_mutation_atomic/);

const combinedRoutes = routes.join('\n');
for (const rpc of [
  'care_create_reminder_atomic',
  'care_update_reminder_atomic',
  'care_delete_reminder_atomic',
  'care_complete_reminder_atomic',
  'care_snooze_reminder_atomic',
]) {
  assert.match(combinedRoutes, new RegExp(`\\.rpc\\('${rpc}'`));
}
assert.doesNotMatch(combinedRoutes, /beginCareMutation|finishCareMutation|abortCareMutation/);
assert.match(combinedRoutes, /getSupabaseAdmin\(\)/);

const completeRoute = routes[2];
const snoozeRoute = routes[3];
assert.match(completeRoute, /completedAt:\s*body\.completedAt\s*\?\?\s*null/);
assert.match(snoozeRoute, /snoozedUntil:\s*body\.snoozedUntil\s*\?\?\s*null/);
assert.doesNotMatch(completeRoute, /new Date\(\)\.toISOString\(\)/);
assert.doesNotMatch(snoozeRoute, /Date\.now\(\)/);
assert.match(concurrencySpec, /second_replay\"\(\"first_commit\"\)/);
assert.match(concurrencySpec, /same-concurrent-key/g);
assert.match(concurrencySpec, /select count\(\*\) from public\.reminders/);

console.log('care atomicity contract ok');
