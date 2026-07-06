#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  css: readFileSync('app/globals.css', 'utf8'),
  dogCard: readFileSync('app/dog/[slug]/page.tsx', 'utf8'),
  dogCardsRoute: readFileSync('app/api/dog-cards/route.ts', 'utf8'),
  schema: readFileSync('supabase/schema.sql', 'utf8'),
  migration: readFileSync('supabase/migrations/20260706133500_public_dog_cards.sql', 'utf8'),
};

const failures = [];

for (const token of [
  "type PublicCardFieldKey = 'breed' | 'character' | 'triggers' | 'area'",
  'defaultPublicCardFields',
  'publicCardFieldOptions',
  'publicCardVisibleFields',
  'togglePublicCardField',
  'aria-label="Что показать в памятке"',
  'Точный адрес, контакты владельца, лекарства и внутренние заметки сюда не попадают',
]) {
  if (!files.page.includes(token)) failures.push(`public card owner field controls missing: ${token}`);
}

for (const token of [
  "triggers: show('triggers') ?",
  "area: show('area') ? safePublicArea(profile.neighborhood) : 'район скрыт'",
  "character: show('character') ?",
  "breed: show('breed') ?",
]) {
  if (!files.page.includes(token)) failures.push(`public card share params do not honor field controls: ${token}`);
}

for (const token of ['.public-card-fields-panel', '.public-card-fields-panel button.active']) {
  if (!files.css.includes(token)) failures.push(`public card field controls CSS missing: ${token}`);
}

for (const token of [
  "import { notFound } from 'next/navigation';",
  "if (slug !== 'card' && !dbFields) notFound();",
  "const image = /^(https?:\\/\\/|data:image\\/(png|jpe?g|webp);base64,)/i.test(rawImage) ? rawImage : '';",
  "const area = cleanDisplay(dbFields?.area || read('area', 'район скрыт'), 'район скрыт');",
]) {
  if (!files.dogCard.includes(token)) failures.push(`public dog card page missing safe reader token: ${token}`);
}

for (const token of [
  'publishPublicDogCard',
  'regeneratePublicDogCard',
  'revokePublicDogCard',
  "fetch('/api/dog-cards'",
  "visibility: 'unlisted'",
  'setPublishedPublicCardPath(result.path)',
  'Пересоздать ссылку',
  'Отозвать',
]) {
  if (!files.page.includes(token)) failures.push(`public card persisted share flow missing: ${token}`);
}

for (const token of [
  'resolveOwnerPet',
  "eq('owner_id', ownerId)",
  'normalizePublicDogCardFields',
  'regenerate',
  "update({ revoked_at: new Date().toISOString() })",
  'export async function DELETE',
  'public_slug',
  'revoked_at',
]) {
  if (!files.dogCardsRoute.includes(token)) failures.push(`dog cards API missing owner/privacy token: ${token}`);
}

if (files.schema.includes('dog cards public read') || files.migration.includes('dog cards public read" on public.dog_cards\ncreate policy')) {
  failures.push('dog_cards must not expose unlisted cards through broad public Supabase RLS');
}

if (!files.migration.includes('create unique index if not exists dog_cards_public_slug_key')) {
  failures.push('dog_cards migration must enforce unique public_slug');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('public card privacy contract ok');
