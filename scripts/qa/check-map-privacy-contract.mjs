#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  mapApi: readFileSync('app/api/map/features/route.ts', 'utf8'),
  mapItemApi: readFileSync('app/api/map/features/[id]/route.ts', 'utf8'),
  bootstrapApi: readFileSync('app/api/app/bootstrap/route.ts', 'utf8'),
  mapSharePage: readFileSync('app/map/share/[id]/page.tsx', 'utf8'),
  zonesApi: readFileSync('app/api/zones/route.ts', 'utf8'),
  secureMigration: readFileSync('supabase/migrations/20260813183000_secure_map_projection.sql', 'utf8'),
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
  "requesting_owner_id: ownerId ?? null",
  "shareUrl: visibility === 'shared' ? shareUrl(request, data.share_token) : null",
]) {
  if (!files.mapApi.includes(token)) failures.push(`map feature API privacy boundary missing: ${token}`);
}

for (const token of [
  "eq('share_token', id)",
  "eq('visibility', 'shared')",
  'Приватная карта не раскрывается',
  'не показывает точные координаты',
  'Открыто только по ссылке',
  'Детальная география остаётся у владельца',
]) {
  if (!files.mapSharePage.includes(token)) failures.push(`map share page privacy boundary missing: ${token}`);
}

for (const token of [
  "visibility: 'private'",
  'share_token: null',
  "body.visibility === 'shared' ? crypto.randomUUID() : null",
  ".eq('owner_id', ownerId)",
]) {
  if (!files.mapItemApi.includes(token)) failures.push(`map route revoke boundary missing: ${token}`);
}

for (const token of [
  ".from('map_routes')",
  ".eq('owner_id', ownerId)",
  'routes: routesResult.error ? [] : routesResult.data ?? []',
]) {
  if (!files.bootstrapApi.includes(token)) failures.push(`map route bootstrap persistence missing: ${token}`);
}

for (const token of [
  "when auth.uid() is not null then auth.uid()",
  "request.jwt.claim.role",
  "case when r.owner_id = c.owner_id then st_asgeojson(r.path)::json else null::json end",
  "share_token = case when visibility = 'shared'",
]) {
  if (!files.secureMigration.includes(token)) failures.push(`secure map SQL boundary missing: ${token}`);
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
