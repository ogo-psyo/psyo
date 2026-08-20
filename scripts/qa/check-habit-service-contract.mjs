import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const required = [
  'lib/server/habitService.ts',
  'app/api/habits/route.ts',
  'app/api/habits/[id]/checkins/route.ts',
  'supabase/migrations/20260820013000_habit_service.sql',
];

for (const file of required) assert.ok(existsSync(file), `HabitService missing file: ${file}`);

const service = readFileSync(required[0], 'utf8');
const listRoute = readFileSync(required[1], 'utf8');
const checkinRoute = readFileSync(required[2], 'utf8');
const migration = readFileSync(required[3], 'utf8');

for (const token of ['listHabitsForOwner', 'createHabitForOwner', 'checkInHabitForOwner', 'ownerId', 'petId']) {
  assert.ok(service.includes(token), `HabitService missing owner-scoped behavior: ${token}`);
}
for (const token of ['careRequestFingerprint', 'request_fingerprint', 'IDEMPOTENCY_KEY_REUSED']) {
  assert.ok(service.includes(token), `HabitService must reject changed idempotent payloads: ${token}`);
}
for (const token of ['getAppSessionFromRequest', 'getRequestAuth', "problem('AUTH_REQUIRED'"]) {
  assert.ok(listRoute.includes(token), `habit route missing: ${token}`);
  assert.ok(checkinRoute.includes(token), `habit check-in route missing: ${token}`);
}
for (const token of [
  'create table if not exists public.pet_habits',
  'create table if not exists public.habit_checkins',
  'enable row level security',
  'habit_checkins owner',
  'unique (habit_id, idempotency_key)',
  'request_fingerprint text not null',
]) assert.ok(migration.includes(token), `habit migration missing: ${token}`);

console.log('habit service contract ok');
