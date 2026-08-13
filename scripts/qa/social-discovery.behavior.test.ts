import assert from 'node:assert/strict';
import test from 'node:test';
import { groupSocialCandidates, type SocialCandidateSource, type SocialProfile } from '../../lib/socialCore.ts';

const mine: SocialProfile = {
  petId: 'mine', discoverable: true, city: 'moscow', district: 'Хамовники',
  coarseLocation: { lat: 55.75, lng: 37.62 }, scenarios: ['walk', 'meet'],
};

function candidate(overrides: Partial<SocialCandidateSource> & { petId: string }): SocialCandidateSource {
  return {
    ownerId: `owner-${overrides.petId}`,
    name: overrides.petId,
    avatarUrl: null,
    profile: {
      petId: overrides.petId,
      discoverable: true,
      city: 'moscow',
      district: 'Арбат',
      coarseLocation: { lat: 55.86, lng: 37.62 },
      scenarios: ['walk'],
    },
    ...overrides,
  };
}

test('12 km is nearby; 20 km falls back to city', () => {
  const result = groupSocialCandidates({
    mine,
    candidates: [
      candidate({ petId: 'twelve', profile: { ...candidate({ petId: 'x' }).profile, petId: 'twelve', coarseLocation: { lat: 55.86, lng: 37.62 } } }),
      candidate({ petId: 'twenty', profile: { ...candidate({ petId: 'x' }).profile, petId: 'twenty', coarseLocation: { lat: 55.93, lng: 37.62 } } }),
    ],
  });
  assert.deepEqual(result.nearby.map((item) => item.petId), ['twelve']);
  assert.deepEqual(result.city.map((item) => item.petId), ['twenty']);
});

test('without geolocation, same-city candidates remain discoverable and same district comes first', () => {
  const noGeoMine = { ...mine, coarseLocation: null };
  const result = groupSocialCandidates({
    mine: noGeoMine,
    candidates: [
      candidate({ petId: 'other-district', profile: { ...candidate({ petId: 'x' }).profile, petId: 'other-district', coarseLocation: null } }),
      candidate({ petId: 'same-district', profile: { ...candidate({ petId: 'x' }).profile, petId: 'same-district', district: 'Хамовники', coarseLocation: null } }),
    ],
  });
  assert.deepEqual(result.nearby, []);
  assert.deepEqual(result.city.map((item) => item.petId), ['same-district', 'other-district']);
});

test('different city, hidden profile, no shared scenario and blocked owner are absent', () => {
  const result = groupSocialCandidates({
    mine,
    candidates: [
      candidate({ petId: 'different-city', profile: { ...candidate({ petId: 'x' }).profile, petId: 'different-city', city: 'saint_petersburg' } }),
      candidate({ petId: 'hidden', profile: { ...candidate({ petId: 'x' }).profile, petId: 'hidden', discoverable: false } }),
      candidate({ petId: 'no-shared', profile: { ...candidate({ petId: 'x' }).profile, petId: 'no-shared', scenarios: ['mating'] } }),
      candidate({ petId: 'blocked', ownerId: 'blocked-owner' }),
    ],
    excludedOwnerIds: new Set(['blocked-owner']),
  });
  assert.deepEqual(result, { nearby: [], city: [] });
});

test('zero and one-user cold starts are stable empty groups', () => {
  assert.deepEqual(groupSocialCandidates({ mine, candidates: [] }), { nearby: [], city: [] });
  assert.deepEqual(groupSocialCandidates({ mine: { ...mine, discoverable: false }, candidates: [candidate({ petId: 'only' })] }), { nearby: [], city: [] });
});
