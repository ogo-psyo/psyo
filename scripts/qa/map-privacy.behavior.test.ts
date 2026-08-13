import assert from 'node:assert/strict';
import {
  listOwnerMapFeatures,
  projectExternalMapFeature,
  resolveSharedMapFeature,
  revokeSharedMapFeature,
  type StoredMapFeature,
} from '../../lib/server/mapProjection';

const pointA: StoredMapFeature = {
  id: 'point-a',
  ownerId: 'owner-a',
  petId: 'pet-a',
  kind: 'point',
  title: 'Парк',
  visibility: 'private',
  exactPoint: { lat: 55.751244, lng: 37.618423 },
  approximateCenter: { lat: 55.75, lng: 37.62 },
  areaLabel: 'центр Москвы',
  shareToken: null,
};

const routeA: StoredMapFeature = {
  id: 'route-a',
  ownerId: 'owner-a',
  petId: 'pet-a',
  kind: 'route',
  title: 'Вечерний маршрут',
  visibility: 'shared',
  exactPath: [
    [37.618423, 55.751244],
    [37.622811, 55.754901],
  ],
  approximateCenter: { lat: 55.75, lng: 37.62 },
  areaLabel: 'центр Москвы',
  shareToken: 'share-route-a',
};

const features = [pointA, routeA];

assert.deepEqual(
  listOwnerMapFeatures(features, { ownerId: 'owner-a', includePrivate: true }).map((item) => item.id),
  ['point-a', 'route-a'],
  'owner A should restore both private points and routes',
);
assert.equal(
  listOwnerMapFeatures(features, { ownerId: 'owner-b', includePrivate: true }).some((item) => item.id === routeA.id),
  false,
  'owner B must not read owner A route',
);

const publicRoute = projectExternalMapFeature(routeA);
assert.equal('exactPath' in publicRoute, false, 'external projection must omit exactPath');
assert.equal('path' in publicRoute, false, 'external projection must omit path');
assert.deepEqual(publicRoute.approximateCenter, routeA.approximateCenter);

assert.equal(resolveSharedMapFeature(features, routeA.shareToken)?.id, routeA.id);
const revoked = revokeSharedMapFeature(features, { ownerId: 'owner-a', id: routeA.id });
assert.equal(resolveSharedMapFeature(revoked, routeA.shareToken), null, 'revoked share should resolve as 404/not found');

assert.throws(
  () => revokeSharedMapFeature(features, { ownerId: 'owner-b', id: routeA.id }),
  /not found/i,
  'another owner cannot revoke the route',
);

console.log('map privacy behavior ok');
