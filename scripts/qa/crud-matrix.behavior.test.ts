import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

function assertMethods(label: string, path: string, methods: string[]) {
  const body = source(path);
  for (const method of methods) {
    assert.match(body, new RegExp(`export async function ${method}\\b`), `${label}: missing ${method} in ${path}`);
  }
}

assertMethods('pets', 'app/api/v1/pets/route.ts', ['GET', 'POST', 'PATCH', 'DELETE']);
assertMethods('reminders collection', 'app/api/reminders/route.ts', ['GET', 'POST']);
assertMethods('reminders item', 'app/api/reminders/[id]/route.ts', ['PATCH', 'DELETE']);
assertMethods('observations collection', 'app/api/observations/route.ts', ['GET', 'POST']);
assertMethods('observations item', 'app/api/observations/[id]/route.ts', ['PATCH', 'DELETE']);
assertMethods('observations restore', 'app/api/observations/[id]/restore/route.ts', ['POST']);
assertMethods('wishlist collection', 'app/api/wishlist/route.ts', ['GET', 'POST']);
assertMethods('wishlist item', 'app/api/wishlist/[id]/route.ts', ['PATCH', 'DELETE']);
assertMethods('wishlist restore', 'app/api/wishlist/[id]/restore/route.ts', ['POST']);
assertMethods('zones collection', 'app/api/zones/route.ts', ['GET', 'POST']);
assertMethods('zones item', 'app/api/zones/[id]/route.ts', ['PATCH', 'DELETE']);
assertMethods('zones restore', 'app/api/zones/[id]/restore/route.ts', ['POST']);
assertMethods('map features collection', 'app/api/map/features/route.ts', ['GET', 'POST']);
assertMethods('map features item', 'app/api/map/features/[id]/route.ts', ['PATCH', 'DELETE']);
assertMethods('habits collection', 'app/api/habits/route.ts', ['GET', 'POST']);
assertMethods('habits item', 'app/api/habits/[id]/route.ts', ['PATCH', 'DELETE']);
assertMethods('documents collection', 'app/api/documents/route.ts', ['GET', 'POST']);
assertMethods('documents item', 'app/api/documents/[id]/route.ts', ['GET', 'DELETE']);
assertMethods('social profile lifecycle', 'app/api/social/profile/route.ts', ['GET', 'PUT', 'DELETE']);
assertMethods('walk signal lifecycle', 'app/api/social/signals/route.ts', ['GET', 'PUT', 'DELETE']);
assertMethods('public dog cards', 'app/api/dog-cards/route.ts', ['GET', 'POST', 'DELETE']);

const page = source('app/page.tsx');
const profileWorkspace = source('components/profile/ProfileMemoryWorkspace.tsx');
for (const marker of [
  'Удалить собаку',
  'Удалить аккаунт',
  'Очистить данные на этом устройстве',
  'editingWishlistId === item.id',
  'editingZoneId === zone.id',
  'updateOwnerRoute',
  'deleteOwnerRoute',
  'restoreObservation',
  'restoreWishlistItem',
  'restoreZone',
  'onDeleteDocument={(id) => void deletePetDocument(id)}',
]) assert.ok(page.includes(marker), `missing reachable CRUD UI marker: ${marker}`);

assert.ok(profileWorkspace.includes("item.entityKind === 'document'"), 'document actions must be reachable from history');
assert.ok(profileWorkspace.includes('props.onOpenDocument(item.entityId)'), 'document read action must be reachable');
assert.ok(profileWorkspace.includes('props.onDeleteDocument(item.entityId)'), 'document delete action must be reachable');

console.log('crud-matrix.behavior.test.ts: all assertions passed');
