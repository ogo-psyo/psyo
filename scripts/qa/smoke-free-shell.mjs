#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCreatePetInput } from '../../packages/contracts/index.ts';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const page = read('app/page.tsx');
const navigation = read('components/app/AppNavigation.tsx');
const creationSheet = read('components/onboarding/CoreOnboarding.tsx');
const route = read('app/api/v1/onboarding/activate/route.ts');
const service = read('lib/server/onboardingService.ts');
const contracts = read('packages/contracts/index.ts');
const migration = read('supabase/migrations/20260813170000_onboarding_activation.sql');

const visibleTabs = [...navigation.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
const freshOwner = {
  visibleTabs,
  blockingOnboarding: page.includes("if (onboardingStage !== 'done') return"),
};

assert.deepEqual(freshOwner.visibleTabs, ['today', 'profile', 'map', 'nearby', 'things']);
assert.equal(freshOwner.blockingOnboarding, false, 'fresh owners must see the real app shell');

for (const token of ['Имя собаки', 'Добавить собаку', 'Не сейчас', 'role="dialog"']) {
  assert.ok(creationSheet.includes(token), `contextual dog creation is missing: ${token}`);
}
for (const forbidden of ['шаг 1 из 2', 'шаг 2 из 2', 'Первое дело', 'firstReminder']) {
  assert.equal(creationSheet.includes(forbidden), false, `dog creation still requires care setup: ${forbidden}`);
}
const saveDogStart = page.indexOf('async function saveMinimalDog()');
const saveDogEnd = page.indexOf('async function loadBootstrap', saveDogStart);
const saveDog = page.slice(saveDogStart, saveDogEnd);
assert.ok(saveDogStart >= 0 && saveDogEnd > saveDogStart, 'minimal dog creation handler is missing');
assert.equal(saveDog.includes('createReminder'), false, 'saving a dog must not create a reminder');

for (const token of ['CreatePetInput', 'CreatePetResult', 'validateCreatePetInput']) {
  assert.ok(contracts.includes(token), `minimal pet contract is missing: ${token}`);
}
for (const token of ['createPet', "supabase.rpc('create_pet_for_owner'"]) {
  assert.ok(`${service}\n${route}`.includes(token), `idempotent dog creation is missing: ${token}`);
}
assert.ok(contracts.includes('created: boolean'), 'pet creation result must distinguish a replay');

assert.equal(`${route}\n${service}`.includes('firstReminder'), false, 'the creation API must not accept a reminder');
assert.equal(migration.includes('insert into public.reminders'), false, 'dog creation must not create a reminder');
assert.ok(migration.includes('unique (owner_id, idempotency_key)'), 'dog creation must remain owner-scoped and idempotent');
assert.ok(migration.includes('grant execute on function public.create_pet_for_owner'), 'pet creation RPC must remain service-role only');

assert.deepEqual(
  validateCreatePetInput({ name: ' Луна ', idempotencyKey: 'create-pet:12345678' }),
  { ok: true, input: { name: 'Луна', idempotencyKey: 'create-pet:12345678' } },
);
assert.equal(validateCreatePetInput({ name: '', idempotencyKey: 'create-pet:12345678' }).ok, false);
assert.equal(validateCreatePetInput({ name: 'Луна', idempotencyKey: 'short' }).ok, false);

console.log('free shell smoke ok');
