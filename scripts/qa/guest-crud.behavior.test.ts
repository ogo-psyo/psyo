import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  guestEntityStorageKey,
  loadGuestEntityState,
  resetAllLocalPsoData,
  saveGuestEntityState,
} from '../../lib/guestEntityStorage';

class MemoryStorage implements Storage {
  #data = new Map<string, string>();
  get length() { return this.#data.size; }
  clear() { this.#data.clear(); }
  getItem(key: string) { return this.#data.get(key) ?? null; }
  key(index: number) { return Array.from(this.#data.keys())[index] ?? null; }
  removeItem(key: string) { this.#data.delete(key); }
  setItem(key: string, value: string) { this.#data.set(key, value); }
}

const storage = new MemoryStorage();
const petId = 'guest-pet-a';
const state = {
  reminders: [{ id: 'reminder-a', title: 'Клещи' }],
  wishlist: [{ id: 'wish-a', title: 'Адресник' }],
  zones: [{ id: 'zone-a', title: 'Парк' }],
  routes: [{ id: 'route-a', title: 'Вечерний круг' }],
};

saveGuestEntityState(storage, petId, state);
assert.deepEqual(loadGuestEntityState(storage, petId), state, 'guest CRUD must survive reload');
assert.match(guestEntityStorageKey(petId), /guest-pet-a/);

storage.setItem('unrelated.preference', 'keep');
storage.setItem('pso.product.profile.v5', '{}');
storage.setItem('pso.topapp.observations.v2:guest-pet-a', '[]');
resetAllLocalPsoData(storage);
assert.equal(storage.getItem('unrelated.preference'), 'keep', 'local deletion must not erase unrelated site data');
assert.equal(storage.getItem('pso.product.profile.v5'), null);
assert.equal(storage.getItem(guestEntityStorageKey(petId)), null);
assert.equal(storage.getItem('pso.topapp.observations.v2:guest-pet-a'), null);

const page = readFileSync('app/page.tsx', 'utf8');
for (const marker of [
  'loadGuestEntityState',
  'saveGuestEntityState',
  'resetAllLocalPsoData',
  'Очистить данные на этом устройстве',
  'const nextRoute = { ...currentRoute, ...patch }',
  'setOwnerRoutes((routes) => removeOwnerRoute(routes, route.id))',
]) {
  assert.ok(page.includes(marker), `guest CRUD contract is missing: ${marker}`);
}

console.log('guest CRUD persistence and deletion behavior ok');
