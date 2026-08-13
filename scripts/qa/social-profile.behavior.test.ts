import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupSocialCandidates,
  normalizeSocialProfileInput,
  quantizeCoarseLocation,
  type SocialProfile,
} from '../../lib/socialCore.ts';
import { requireOwnedPet } from '../../lib/server/socialService.ts';

test('discovery is an explicit per-pet opt-in and mating is only a scenario', () => {
  const hidden = normalizeSocialProfileInput({
    discoverable: false,
    city: 'moscow',
    scenarios: [],
  });
  assert.equal(hidden.ok && hidden.value.discoverable, false);

  const missingScenario = normalizeSocialProfileInput({ discoverable: true, city: 'moscow', scenarios: [] });
  assert.deepEqual(missingScenario, {
    ok: false,
    code: 'SCENARIO_REQUIRED_WHEN_DISCOVERABLE',
    field: 'scenarios',
  });

  const mating = normalizeSocialProfileInput({
    discoverable: true,
    city: 'moscow',
    district: 'Хамовники',
    scenarios: ['mating'],
  });
  assert.equal(mating.ok, true);
  if (mating.ok) assert.deepEqual(mating.value.scenarios, ['mating']);
});

test('coarse location is quantized and exact/contact fields are rejected', () => {
  assert.deepEqual(quantizeCoarseLocation({ lat: 55.755826, lng: 37.6173 }), { lat: 55.76, lng: 37.62 });
  assert.equal(normalizeSocialProfileInput({
    discoverable: true,
    city: 'moscow',
    scenarios: ['walk'],
    latitude: 55.755826,
  }).ok, false);
  assert.equal(normalizeSocialProfileInput({
    discoverable: true,
    city: 'moscow',
    scenarios: ['walk'],
    telegramUsername: 'spoofed_owner',
  }).ok, false);
});

test('candidate projection contains no coordinates, owner id, contact, or score', () => {
  const mine: SocialProfile = {
    petId: 'pet-a', discoverable: true, city: 'moscow', district: 'Хамовники',
    coarseLocation: { lat: 55.76, lng: 37.62 }, scenarios: ['walk'],
  };
  const candidateProfile: SocialProfile = {
    ...mine, petId: 'pet-b', coarseLocation: { lat: 55.77, lng: 37.63 },
  };
  const output = groupSocialCandidates({
    mine,
    candidates: [{ petId: 'pet-b', ownerId: 'owner-b', name: 'Бруно', avatarUrl: null, profile: candidateProfile }],
  });
  const serialized = JSON.stringify(output);
  assert.equal(output.nearby.length, 1);
  for (const forbidden of ['55.77', '37.63', 'owner-b', 'telegram', 'score']) {
    assert.equal(serialized.toLowerCase().includes(forbidden), false, `leaked ${forbidden}`);
  }
});

test('owner/pet lookup denies a cross-owner pet', async () => {
  const rows = [
    { id: 'pet-a', owner_id: 'owner-a', name: 'Ася', avatar_url: null },
    { id: 'pet-b', owner_id: 'owner-b', name: 'Бруно', avatar_url: null },
  ];
  const filters: Record<string, unknown> = {};
  const query = {
    select() { return this; },
    eq(field: string, value: unknown) { filters[field] = value; return this; },
    async maybeSingle() {
      return { data: rows.find((row) => Object.entries(filters).every(([key, value]) => (row as any)[key] === value)) ?? null, error: null };
    },
  };
  const supabase = { from() { return query; } } as any;
  assert.equal((await requireOwnedPet(supabase, 'owner-a', 'pet-a'))?.id, 'pet-a');
  assert.equal(await requireOwnedPet(supabase, 'owner-a', 'pet-b'), null);
});
