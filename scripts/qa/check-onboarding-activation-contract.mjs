#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'app/api/v1/onboarding/activate/route.ts',
  'lib/server/onboardingService.ts',
  'supabase/migrations/20260813170000_onboarding_activation.sql',
  'supabase/migrations/20260813190000_split_pet_creation_from_first_care.sql',
];

const failures = [];
for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`onboarding activation missing file: ${file}`);
}

if (!failures.length) {
  const route = readFileSync(requiredFiles[0], 'utf8');
  const service = readFileSync(requiredFiles[1], 'utf8');
  const migration = `${readFileSync(requiredFiles[2], 'utf8')}\n${readFileSync(requiredFiles[3], 'utf8')}`;

  for (const token of [
    'getAppSessionFromRequest(request)',
    "problem('AUTH_REQUIRED'",
    'validateCreatePetInput',
    'createPet',
    'const supabase = getSupabaseAdmin()',
    "{ reason: conflictCode }",
    'Retry with the same idempotency key.',
  ]) {
    if (!route.includes(token)) failures.push(`activation route missing: ${token}`);
  }
  if (/body\??\.ownerId|source\??\.ownerId/.test(route)) failures.push('activation route must not accept ownerId from the request body');
  if (/problem\([^)]*internalMessage/s.test(route)) failures.push('activation route must not expose internal database errors in Problem detail');

  for (const token of [
    "supabase.rpc('create_pet_for_owner'",
    'ownerId: string',
    'idempotencyKey: string',
    'canonicalJson({ name: name.trim(), lifeStage, sex, breedId, breedGroupId, breedCustom })',
  ]) {
    if (!service.includes(token)) failures.push(`activation service missing: ${token}`);
  }

  for (const token of [
    'create table if not exists public.onboarding_activations',
    'unique (owner_id, idempotency_key)',
    'create or replace function public.create_pet_for_owner',
    'pg_advisory_xact_lock',
    "insert into public.pets",
    'reminder_id uuid references public.reminders',
    'alter column reminder_id drop not null',
    'revoke all on function public.create_pet_for_owner',
    'grant execute on function public.create_pet_for_owner',
  ]) {
    if (!migration.includes(token)) failures.push(`activation migration missing: ${token}`);
  }
  if (/insert into public\.(reminders|reminder_events)/.test(migration)) {
    failures.push('pet creation migration must not create a mandatory reminder or reminder event');
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('onboarding activation contract ok');
