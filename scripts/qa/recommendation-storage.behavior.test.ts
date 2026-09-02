import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/20260902150000_recommendation_foundation.sql';
const databaseTestPath = 'supabase/tests/recommendation_foundation.sql';

test('recommendation storage migration and database regression suite exist', () => {
  assert.equal(existsSync(migrationPath), true, `${migrationPath} is required`);
  assert.equal(existsSync(databaseTestPath), true, `${databaseTestPath} is required`);
});

test('migration creates constrained owner-scoped recommendation storage', () => {
  const sql = readFileSync(migrationPath, 'utf8');
  for (const table of [
    'recommendations',
    'recommendation_evidence',
    'recommendation_events',
    'recommendation_preferences',
    'recommendation_mutations',
  ]) {
    assert.match(sql, new RegExp(`create table(?: if not exists)? public\\.${table}\\b`, 'i'));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  }
  assert.match(sql, /recommendations_active_fingerprint_uidx/i);
  assert.match(sql, /where status in \('candidate','eligible','shown','accepted','snoozed'\)/i);
  assert.match(sql, /check \(category in \('care','wellbeing','habit','walk','thing'\)\)/i);
  assert.match(sql, /check \(risk in \('routine','caution','safety_override'\)\)/i);
  assert.match(sql, /check \(char_length\(excerpt\) <= 160\)/i);
  assert.match(sql, /owner_id = \(select auth\.uid\(\)\)/i);
});

test('direct lifecycle writes are revoked and atomic RPC is service-only', () => {
  const sql = readFileSync(migrationPath, 'utf8');
  assert.match(sql, /revoke insert, update, delete on public\.recommendations from anon, authenticated/i);
  assert.match(sql, /revoke all on public\.recommendation_events from anon, authenticated/i);
  assert.match(sql, /revoke all on public\.recommendation_mutations from anon, authenticated/i);
  assert.match(sql, /create or replace function public\.recommendation_transition_atomic\(/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = ''/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /for update/i);
  assert.match(sql, /IDEMPOTENCY_KEY_REUSED/i);
  assert.match(sql, /INVALID_RECOMMENDATION_TRANSITION/i);
  assert.match(sql, /when 'reactivate' then 'eligible'/i);
  assert.match(sql, /revoke all on function public\.recommendation_transition_atomic[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.recommendation_transition_atomic[\s\S]*to service_role/i);
});

test('database suite covers isolation, uniqueness, replay and invalid transitions', () => {
  const sql = readFileSync(databaseTestPath, 'utf8');
  assert.match(sql, /owner A sees its recommendation/i);
  assert.match(sql, /owner B sees zero recommendations/i);
  assert.match(sql, /duplicate active fingerprint/i);
  assert.match(sql, /idempotent replay changed response/i);
  assert.match(sql, /IDEMPOTENCY_KEY_REUSED/i);
  assert.match(sql, /INVALID_RECOMMENDATION_TRANSITION/i);
  assert.match(sql, /rollback;/i);
});
