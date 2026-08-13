import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPetProfilePersistencePayload } from '../../lib/server/profileService';
import { normalizePublicDogCardFields } from '../../lib/server/publicDogCard';

const owner = { id: '00000000-0000-4000-8000-0000000000a1' };

const privateProfile = buildPetProfilePersistencePayload({
  user: owner,
  profile: {
    dogName: 'Луна',
    isPublic: true,
    healthNotes: 'Не показывать наружу',
    medication: 'Не показывать наружу',
  },
});

assert.equal(
  Object.hasOwn(privateProfile.petPayload, 'is_public'),
  false,
  'saving a private dog profile must never publish it',
);

const publicCard = normalizePublicDogCardFields({
  name: 'Луна',
  image: 'https://example.test/luna.jpg',
  healthNotes: 'Не показывать наружу',
  medication: 'Не показывать наружу',
});
assert.deepEqual(Object.keys(publicCard).sort(), ['area', 'bio', 'breed', 'character', 'image', 'name', 'social', 'triggers']);
assert.equal(JSON.stringify(publicCard).includes('Не показывать наружу'), false);

const petsRoute = readFileSync('app/api/v1/pets/route.ts', 'utf8');
const accountRoute = readFileSync('app/api/v1/account/route.ts', 'utf8');
const cardRoute = readFileSync('app/api/dog-cards/route.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260813220000_profile_lifecycle.sql', 'utf8');

for (const token of [
  'export async function PATCH',
  'activePetId',
  'export async function DELETE',
  'DELETE_DOG',
  "eq('owner_id', ownerId)",
  "request.headers.get('idempotency-key')",
  'createPetProfileIdempotently',
]) {
  assert.ok(petsRoute.includes(token), `pets lifecycle route missing ${token}`);
}

for (const token of ['export async function DELETE', 'DELETE_ACCOUNT', 'auth.admin.deleteUser(ownerId)']) {
  assert.ok(accountRoute.includes(token), `account lifecycle route missing ${token}`);
}

for (const token of ["is('revoked_at', null)", 'normalizePublicDogCardFields', 'revoke']) {
  assert.ok(cardRoute.includes(token), `card lifecycle route missing ${token}`);
}

for (const token of [
  'active_pet_id uuid references public.pets(id) on delete set null',
  'dog_cards_one_active_per_pet_idx',
  'where revoked_at is null',
  'create table if not exists public.pet_profile_commands',
  'create or replace function public.create_pet_profile_for_owner',
]) {
  assert.ok(migration.includes(token), `profile lifecycle migration missing ${token}`);
}

console.log('profile lifecycle behavioral contract ok');
