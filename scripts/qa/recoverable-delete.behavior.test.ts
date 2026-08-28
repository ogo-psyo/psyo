import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  listActiveRecords,
  restoreRecord,
  softDeleteRecord,
  type RecoverableRecord,
} from '../../lib/server/recoverableDelete';

const now = '2026-08-13T15:30:00.000Z';
const active: RecoverableRecord = { id: 'item-a', deletedAt: null };
const removed = softDeleteRecord(active, now);

assert.equal(removed.deletedAt, now, 'removal records when the item was hidden');
assert.deepEqual(listActiveRecords([removed]), [], 'removed items stay out of normal lists');
assert.deepEqual(listActiveRecords([restoreRecord(removed)]), [{ id: 'item-a', deletedAt: null }], 'restore returns the item after reload');
assert.throws(() => softDeleteRecord(active, 'not-a-date'), /INVALID_DATE/);

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const wishlistList = source('app/api/wishlist/route.ts');
const wishlistItem = source('app/api/wishlist/[id]/route.ts');
const wishlistRestore = source('app/api/wishlist/[id]/restore/route.ts');
const zoneList = source('app/api/zones/route.ts');
const zoneItem = source('app/api/zones/[id]/route.ts');
const zoneRestore = source('app/api/zones/[id]/restore/route.ts');
const bootstrap = source('app/api/app/bootstrap/route.ts');
const sharedZone = source('app/map/share/[id]/page.tsx');
const migration = source('supabase/migrations/20260813223000_recoverable_wishlist_zones.sql');
const page = source('app/page.tsx');
const styles = source('app/globals.css');

for (const listSource of [wishlistList, zoneList]) {
  assert.match(listSource, /is\('deleted_at', null\)/, 'normal list excludes removed records');
}
for (const deleteSource of [wishlistItem, zoneItem]) {
  assert.doesNotMatch(deleteSource, /\.delete\(\)/, 'DELETE must be recoverable');
  assert.match(deleteSource, /deleted_at:\s*new Date\(\)\.toISOString\(\)/, 'DELETE timestamps the record');
}
for (const restoreSource of [wishlistRestore, zoneRestore]) {
  assert.match(restoreSource, /deleted_at:\s*null/, 'restore clears the removal timestamp');
  assert.match(restoreSource, /pets\.owner_id/, 'restore is owner-scoped');
}
assert.equal((bootstrap.match(/is\('deleted_at', null\)/g) ?? []).length >= 3, true, 'bootstrap excludes removed wishlist items, zones and observations');
assert.match(bootstrap, /from\('pet_observations'\)[\s\S]*?is\('deleted_at', null\)/, 'removed observations do not return after bootstrap reload');
assert.match(sharedZone, /from\('map_zones'\)[\s\S]*?is\('deleted_at', null\)/, 'removed shared places do not remain public');
assert.match(migration, /alter table public\.wishlist_items[\s\S]*deleted_at timestamptz/);
assert.match(migration, /alter table public\.map_zones[\s\S]*deleted_at timestamptz/);
assert.match(migration, /z\.deleted_at is null/, 'map discovery excludes removed places');

for (const token of [
  'restoreWishlistItem',
  'restoreZone',
  '/restore',
  'Вернуть',
]) {
  assert.ok(page.includes(token), `recoverable UI is missing: ${token}`);
}
assert.match(styles, /\.restore-notice\s*\{/, 'the undo control needs a visible, reusable style');

console.log('recoverable wishlist and zones behavior ok');
