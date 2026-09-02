#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  bootstrap: readFileSync('app/api/app/bootstrap/route.ts', 'utf8'),
  observations: readFileSync('app/api/observations/route.ts', 'utf8'),
  observationById: readFileSync('app/api/observations/[id]/route.ts', 'utf8'),
  domain: readFileSync('lib/domain.ts', 'utf8'),
  schema: readFileSync('supabase/schema.sql', 'utf8'),
  migration: readFileSync('supabase/migrations/20260702120000_pet_observations.sql', 'utf8'),
  disclosure: readFileSync('components/today/ObservationDisclosure.tsx', 'utf8'),
  health: readFileSync('components/health/HealthTimelineScreen.tsx', 'utf8'),
  profileMemory: readFileSync('components/profile/ProfileMemoryWorkspace.tsx', 'utf8'),
};

const failures = [];

if (files.bootstrap.includes("note: 'демо-наблюдение'")) {
  failures.push('demo observation must not leak into personal history');
}

for (const token of [
  'create table if not exists public.pet_observations',
  'pet_id uuid not null references public.pets(id) on delete cascade',
  "type text not null check (type in ('mood','energy','appetite','stool','sleep','weight','activity','fear_trigger','dog_reaction','people_reaction','walk','training','medication','procedure','symptom','behavior_change','note'))",
  "source text not null default 'manual'",
  "metadata jsonb not null default '{}'",
  'alter table public.pet_observations enable row level security',
  'create policy "observations owner"',
  'pet_observations_pet_observed_idx',
]) {
  if (!files.schema.includes(token) && !files.migration.includes(token)) failures.push(`observation schema missing: ${token}`);
}

for (const token of [
  'export type PetObservation',
  'observations: PetObservation[]',
]) {
  if (!files.domain.includes(token)) failures.push(`domain observation contract missing: ${token}`);
}

for (const token of [
  "supabase.from('pet_observations')",
  'mapObservation',
  'observations:',
]) {
  if (!files.bootstrap.includes(token)) failures.push(`bootstrap does not load observations: ${token}`);
}

for (const token of [
  'export async function GET',
  'export async function POST',
  'normalizeObservationInput',
  "eq('pets.owner_id', ownerId)",
  "eq('id', body.petId).eq('owner_id', ownerId)",
]) {
  if (!files.observations.includes(token)) failures.push(`observations API missing: ${token}`);
}

for (const token of [
  'export async function PATCH',
  'export async function DELETE',
  'ownedObservation',
  "eq('pets.owner_id', ownerId)",
]) {
  if (!files.observationById.includes(token)) failures.push(`observation item API missing: ${token}`);
}

for (const token of [
  "type ObservationView",
  "observationsStorageKey",
  "submitObservation",
]) {
  if (!files.page.includes(token)) failures.push(`observation wiring missing: ${token}`);
}

for (const token of ['<HealthTimelineScreen', 'onStartEdit={startObservationEdit}', 'onDelete={deleteObservation}']) {
  if (!files.page.includes(token)) failures.push(`canonical health wiring missing: ${token}`);
}
for (const token of ['Записать наблюдение', 'aria-label="История наблюдений"', '<ObservationEditor', '<ObservationMetricFields', 'data-observation-calendar', 'health-calendar-grid', 'data-observation-metrics', 'Контекст владельца', 'Изменить', 'Убрать']) {
  if (!files.health.includes(token)) failures.push(`canonical health lifecycle missing: ${token}`);
}
if (files.profileMemory.includes("surface === 'health'")) {
  failures.push('duplicate profile health surface is still present');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('observations contract ok');
