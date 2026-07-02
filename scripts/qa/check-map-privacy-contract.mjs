#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  mapApi: readFileSync('app/api/map/features/route.ts', 'utf8'),
  zonesApi: readFileSync('app/api/zones/route.ts', 'utf8'),
};

const failures = [];

for (const token of [
  "type MapSaveMode = 'private' | 'shared' | 'public_pending'",
  "const [mapSaveMode, setMapSaveMode]",
  'aria-label="Приватность карты"',
  'Только мне',
  'По ссылке',
  'На модерацию',
  'mapSaveMode === \'public_pending\' ? \'public\' : mapSaveMode',
  'Точные координаты не показываются',
]) {
  if (!files.page.includes(token)) failures.push(`map privacy UI missing: ${token}`);
}

for (const token of [
  "const visibilityModes = new Set(['private', 'shared', 'public'])",
  "const moderationStatus = visibility === 'public' ? 'pending' : 'approved'",
  'blurPublicZoneInput',
  "shareUrl: visibility === 'shared' ? shareUrl(request, data.id) : null",
]) {
  if (!files.mapApi.includes(token)) failures.push(`map feature API privacy boundary missing: ${token}`);
}

for (const token of [
  "const allowedVisibility = new Set(['private', 'shared', 'public'])",
  "const visibility = type === 'home_area' && requestedVisibility !== 'private' ? 'private' : requestedVisibility",
  'blurPublicZoneInput',
]) {
  if (!files.zonesApi.includes(token)) failures.push(`zone API privacy boundary missing: ${token}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('map privacy contract ok');
