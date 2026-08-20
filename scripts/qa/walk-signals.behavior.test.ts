import assert from 'node:assert/strict';
import test from 'node:test';
import { blurredSignalLocation, normalizeWalkSignalInput } from '../../lib/socialCore.ts';

const now = Date.parse('2026-08-20T18:00:00.000Z');
const valid = {
  petId: 'pet-a', city: 'moscow', district: 'САО',
  coarseLocation: { lat: 55.761234, lng: 37.621234 },
  startsAt: '2026-08-20T18:10:00.000Z', pace: 'balanced', note: 'Вокруг пруда',
};

test('walk signal stores only a coarse location and receives a bounded lifetime', () => {
  const result = normalizeWalkSignalInput(valid, now);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.value.coarseLocation, { lat: 55.76, lng: 37.62 });
  assert.equal(result.value.expiresAt, '2026-08-20T20:10:00.000Z');
});

test('exact coordinates and contact fields are rejected', () => {
  assert.deepEqual(normalizeWalkSignalInput({ ...valid, latitude: 55.7 }, now), { ok: false, code: 'EXACT_LOCATION_FORBIDDEN', field: 'coarseLocation' });
  assert.deepEqual(normalizeWalkSignalInput({ ...valid, telegramUsername: 'owner' }, now), { ok: false, code: 'TELEGRAM_CONTACT_SERVER_CONTROLLED', field: 'telegramUsername' });
});

test('display jitter is deterministic and never returns the stored point', () => {
  const first = blurredSignalLocation('signal-a', { lat: 55.76, lng: 37.62 });
  const second = blurredSignalLocation('signal-a', { lat: 55.76, lng: 37.62 });
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, { lat: 55.76, lng: 37.62 });
  assert.ok(Math.abs(first.lat - 55.76) < 0.01);
  assert.ok(Math.abs(first.lng - 37.62) < 0.01);
});

test('stale, distant and overlong drafts are rejected or bounded', () => {
  assert.equal(normalizeWalkSignalInput({ ...valid, startsAt: '2026-08-20T16:00:00.000Z' }, now).ok, false);
  assert.equal(normalizeWalkSignalInput({ ...valid, startsAt: '2026-08-23T18:00:00.000Z' }, now).ok, false);
  const result = normalizeWalkSignalInput({ ...valid, note: 'x'.repeat(400) }, now);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.note?.length, 180);
});

test('signal city follows the coarse location instead of a stale client default', () => {
  const result = normalizeWalkSignalInput({
    ...valid,
    city: 'moscow',
    coarseLocation: { lat: 59.93, lng: 30.32 },
  }, now);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.city, 'saint_petersburg');
});
