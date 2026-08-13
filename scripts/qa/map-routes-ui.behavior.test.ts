import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeOwnerRoutes, removeOwnerRoute, upsertOwnerRoute } from '../../lib/mapUi.ts';

const restored = normalizeOwnerRoutes([
  {
    id: 'route-1',
    pet_id: 'pet-1',
    title: 'Тихий вечерний маршрут',
    description: 'Лучше после девяти',
    visibility: 'private',
    path: { type: 'LineString', coordinates: [[37.61, 55.75], [37.62, 55.76]] },
  },
  { id: '', title: 'Повреждённая запись', visibility: 'private' },
]);

assert.equal(restored.length, 1, 'bootstrap must restore valid owner routes only');
assert.deepEqual(restored[0], {
  id: 'route-1',
  petId: 'pet-1',
  type: 'route',
  title: 'Тихий вечерний маршрут',
  description: 'Лучше после девяти',
  path: { type: 'LineString', coordinates: [[37.61, 55.75], [37.62, 55.76]] },
  visibility: 'private',
});

const updated = upsertOwnerRoute(restored, { ...restored[0], title: 'Новый заголовок', visibility: 'shared' });
assert.equal(updated.length, 1, 'editing a route must not duplicate it');
assert.equal(updated[0].title, 'Новый заголовок');
assert.equal(updated[0].visibility, 'shared');
assert.deepEqual(removeOwnerRoute(updated, 'route-1'), [], 'deleted route must leave the personal list');

const page = readFileSync('app/page.tsx', 'utf8');
for (const token of [
  'setOwnerRoutes(normalizeOwnerRoutes(payload.routes))',
  'features={ownerRoutes}',
  'async function updateOwnerRoute',
  'async function deleteOwnerRoute',
  'async function shareOwnerRoute',
  'async function revokeOwnerRouteShare',
  'Мои маршруты',
  'Закрыть ссылку',
  'Изменить маршрут',
]) {
  assert.ok(page.includes(token), `personal route UI is missing: ${token}`);
}
assert.equal(page.includes('На модерацию'), false, 'private map must not promise an unavailable community layer');

console.log('map routes ui behavior ok');
