import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

test('planned wishlist creation is one idempotent database mutation', () => {
  const migration = source('supabase/migrations/20260903210000_wishlist_plan_link.sql');
  const route = source('app/api/wishlist/route.ts');

  assert.match(migration, /add column if not exists planned_for date/);
  assert.match(migration, /add column if not exists reminder_id uuid/);
  assert.match(migration, /create or replace function public\.wishlist_create_plan_atomic/);
  assert.match(migration, /insert into public\.reminders/);
  assert.match(migration, /insert into public\.wishlist_items/);
  assert.match(migration, /create trigger wishlist_sync_completed_reminder/);
  assert.match(migration, /create trigger wishlist_remove_linked_reminder/);
  assert.match(migration, /before delete on public\.reminders/);
  assert.match(migration, /update public\.wishlist_items[\s\S]*status = 'bought'/);
  assert.match(route, /wishlist_create_plan_atomic/);
  assert.match(route, /readCareIdempotencyKey/);
});

test('the interface preserves and exposes the wishlist-calendar link', () => {
  const page = source('app/page.tsx');

  assert.match(page, /plannedFor\?: string/);
  assert.match(page, /reminderId\?: string/);
  assert.match(page, /Добавить в вещи и план/);
  assert.match(page, /Открыть в плане/);
  assert.match(page, /setSelectedCalendarDate\(item\.plannedFor\)/);
  assert.match(page, /async function completeWishlistItem/);
  assert.match(page, /completeWishlistItem\(item\)/);
  assert.match(page, /setReminders\(\(current\) => current\.filter\(\(reminder\) => reminder\.id !== item\.reminderId\)\)/);

  const itemRoute = source('app/api/wishlist/[id]/route.ts');
  assert.match(itemRoute, /body\.status === 'wanted'[\s\S]*patch\.planned_for = null/);
  assert.match(itemRoute, /body\.status === 'wanted'[\s\S]*patch\.reminder_id = null/);
});
