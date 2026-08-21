#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260821141000_voice_observation_ingestion.sql', 'utf8');
const required = [
  'create table if not exists public.stt_usage_events',
  'alter table public.stt_usage_events enable row level security',
  'create or replace function public.claim_stt_request',
  'pg_advisory_xact_lock',
  'STT_RATE_LIMITED',
  'create or replace function public.ingest_voice_observation_batch',
  'VOICE_INGESTION_RATE_LIMITED',
  'IDEMPOTENCY_KEY_REUSED',
  "source = 'assistant'",
  'for update',
  'analyticsEligible',
  'revoke all on function public.claim_stt_request',
  'revoke all on function public.ingest_voice_observation_batch',
  'grant execute on function public.claim_stt_request',
  'grant execute on function public.ingest_voice_observation_batch',
];

const missing = required.filter((token) => !migration.includes(token));
if (missing.length) {
  console.error(`voice ingestion SQL contract missing: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('voice ingestion SQL contract ok');
