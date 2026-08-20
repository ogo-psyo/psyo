import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterWalkSignalsForViewer,
  normalizeWalkSignalViewerInput,
  parseWalkSignalViewerSearch,
  socialCityForLocation,
} from '../../lib/socialCore.ts';

const now = Date.parse('2026-08-20T20:00:00.000Z');
const viewer = { lat: 55.761, lng: 37.621 };

test('a viewer without a discovery profile can resolve the live city from a coarse location', () => {
  assert.equal(socialCityForLocation(viewer), 'moscow');
  assert.deepEqual(normalizeWalkSignalViewerInput({ location: viewer }), {
    ok: true,
    value: { city: 'moscow', location: { lat: 55.76, lng: 37.62 }, radiusKm: 3 },
  });
});

test('a foreign active signal is visible to a nearby viewer without an acquaintance profile', () => {
  const rows = [
    { id: 'mine', ownerId: 'owner-a', location: { lat: 55.761, lng: 37.621 }, expiresAt: '2026-08-20T21:00:00.000Z' },
    { id: 'nearby', ownerId: 'owner-b', location: { lat: 55.766, lng: 37.626 }, expiresAt: '2026-08-20T21:00:00.000Z' },
    { id: 'far', ownerId: 'owner-c', location: { lat: 55.82, lng: 37.72 }, expiresAt: '2026-08-20T21:00:00.000Z' },
    { id: 'expired', ownerId: 'owner-d', location: { lat: 55.762, lng: 37.622 }, expiresAt: '2026-08-20T19:59:59.000Z' },
  ];

  const visible = filterWalkSignalsForViewer({
    rows,
    viewerOwnerId: 'owner-a',
    viewerLocation: viewer,
    radiusKm: 3,
    now,
  });

  assert.deepEqual(visible.map((row) => row.id), ['mine', 'nearby']);
});

test('unsupported or missing viewer areas are explicit instead of looking empty', () => {
  assert.deepEqual(normalizeWalkSignalViewerInput({}), { ok: false, code: 'VIEWER_LOCATION_REQUIRED' });
  assert.deepEqual(normalizeWalkSignalViewerInput({ location: { lat: 48.8566, lng: 2.3522 } }), {
    ok: false,
    code: 'CITY_NOT_SUPPORTED',
  });
});

test('missing query coordinates are not coerced into a real location', () => {
  assert.equal(parseWalkSignalViewerSearch(new URLSearchParams()), null);
  assert.deepEqual(
    parseWalkSignalViewerSearch(new URLSearchParams({ lat: '55.75', lng: '37.62' })),
    { lat: 55.75, lng: 37.62 },
  );
});
