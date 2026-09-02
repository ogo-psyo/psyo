#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const requiredFiles = [
  'packages/recommendations/contracts.ts',
  'lib/server/recommendations/contextSnapshot.ts',
  'lib/server/recommendations/policyRegistry.ts',
  'lib/server/recommendations/policies.ts',
  'lib/server/recommendations/engine.ts',
  'lib/server/recommendations/repository.ts',
  'lib/server/recommendations/lifecycle.ts',
  'lib/server/recommendations/domainOutcomeLink.ts',
  'app/api/recommendations/route.ts',
  'app/api/recommendations/[id]/route.ts',
  'app/api/recommendations/[id]/outcome/route.ts',
  'supabase/migrations/20260902150000_recommendation_foundation.sql',
  'supabase/migrations/20260902163000_recommendation_repository.sql',
  'supabase/migrations/20260902171000_recommendation_outcome_retries.sql',
];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`missing required recommendation foundation file: ${file}`);
}

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const foundationSql = read('supabase/migrations/20260902150000_recommendation_foundation.sql');
const repositorySql = read('supabase/migrations/20260902163000_recommendation_repository.sql');
const retrySql = read('supabase/migrations/20260902171000_recommendation_outcome_retries.sql');
const schema = `${foundationSql}\n${repositorySql}\n${retrySql}`;
for (const token of [
  'alter table public.recommendations enable row level security',
  'recommendations_active_fingerprint_uidx',
  "where status in ('candidate','eligible','shown','accepted','snoozed')",
  'recommendation_persist_evaluation_atomic',
  'recommendation_outcome_atomic',
  "when 'show' then 'shown'",
  "'reactivate', 'snoozed', 'eligible'",
  'recommendation_outcome_failures_retry_idx',
  'from public, anon, authenticated',
  'to service_role',
]) {
  if (!schema.includes(token)) failures.push(`recommendation SQL contract missing: ${token}`);
}

const env = read('.env.example');
if (!/^RECOMMENDATIONS_FOUNDATION_ENABLED=false$/m.test(env)) {
  failures.push('recommendation foundation feature flag must default to false');
}

const policyRegistry = `${read('lib/server/recommendations/policies.ts')}\n${read('lib/server/recommendations/policyRegistry.ts')}`;
for (const version of ['care_due@1', 'wellbeing_change@1', 'habit_explicit_goal@1', 'walk_with_constraints@1', 'thing_for_task@1']) {
  if (!policyRegistry.includes(version)) failures.push(`policy registry missing ${version}`);
}
if (policyRegistry.includes("risk: 'safety_override'")) {
  failures.push('Phase 0 policies must not emit safety_override before an approved veterinary pack');
}

const recommendationServerDir = 'lib/server/recommendations';
const recommendationSources = readdirSync(recommendationServerDir)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => read(join(recommendationServerDir, name))).join('\n');
for (const forbiddenImport of ['groqAssistant', 'assistantAnswerService', 'openai']) {
  if (recommendationSources.includes(forbiddenImport)) failures.push(`recommendation decision path imports ${forbiddenImport}`);
}
if (recommendationSources.includes("'use client'") || recommendationSources.includes('"use client"')) {
  failures.push('recommendation repository must remain server-only');
}

const snapshot = read('lib/server/recommendations/contextSnapshot.ts').toLowerCase();
for (const banned of ['microchip', 'vet_contact', 'approximate_lat', 'approximate_lng', 'document_body', 'document_content', 'raw_note']) {
  if (snapshot.includes(banned)) failures.push(`privacy snapshot contains banned field: ${banned}`);
}

function filesUnder(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}
for (const file of [...filesUnder('components'), 'app/page.tsx']) {
  if (/from ['"][^'"]*server\/recommendations/.test(read(file))) {
    failures.push(`client/UI imports server recommendation code: ${file}`);
  }
}

const engineTests = read('scripts/qa/recommendation-engine.behavior.test.ts');
for (let number = 1; number <= 12; number += 1) {
  const marker = `AC${String(number).padStart(2, '0')}`;
  if (!engineTests.includes(marker)) failures.push(`deterministic acceptance test missing ${marker}`);
}

const domainRoutes = [
  'app/api/reminders/[id]/complete/route.ts',
  'app/api/habits/[id]/checkins/route.ts',
  'app/api/wishlist/route.ts',
  'app/api/map/features/route.ts',
].map(read).join('\n');
if ((domainRoutes.match(/linkRecommendationOutcome/g) ?? []).length < 8) {
  failures.push('all four domain routes must import and invoke the post-success outcome hook');
}

if (!read('package.json').includes('check-recommendation-foundation-contract.mjs')) {
  failures.push('qa:contracts does not include recommendation foundation contract');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('recommendation foundation contract ok');
