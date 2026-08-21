#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const migration = readFileSync('supabase/migrations/20260821141000_voice_observation_ingestion.sql', 'utf8');
const provenanceMigration = readFileSync('supabase/migrations/20260821152500_fix_observation_input_provenance.sql', 'utf8');
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
  "v_input_source not in ('voice', 'text')",
  "case when v_input_source = 'voice' then 'groq_whisper_large_v3_turbo' else null end",
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

for (const token of ["v_input_source not in ('voice', 'text')", "case when v_input_source = 'voice'", 'ingest_voice_observation_batch_legacy']) {
  if (!provenanceMigration.includes(token)) {
    console.error(`voice provenance migration missing: ${token}`);
    process.exit(1);
  }
}

console.log('voice ingestion SQL contract ok');
