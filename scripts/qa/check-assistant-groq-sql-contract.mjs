#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20260821144500_assistant_groq_rate_limit.sql', 'utf8').toLowerCase();
const failures = [];
for (const token of [
  'create table if not exists public.assistant_usage_events',
  'alter table public.assistant_usage_events enable row level security',
  'create or replace function public.claim_assistant_request',
  'pg_advisory_xact_lock',
  "interval '1 hour'",
  'assistant_rate_limited',
  'revoke all on function public.claim_assistant_request(uuid) from public, anon, authenticated',
  'grant execute on function public.claim_assistant_request(uuid) to service_role',
]) if (!sql.includes(token)) failures.push(token);

if (failures.length) {
  console.error(failures.map((token) => `assistant Groq SQL contract missing: ${token}`).join('\n'));
  process.exit(1);
}
console.log('assistant Groq SQL contract ok');
