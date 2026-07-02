#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  dogCard: readFileSync('app/dog/[slug]/page.tsx', 'utf8'),
  dogCardActions: readFileSync('app/dog/[slug]/DogCardActions.tsx', 'utf8'),
  readiness: readFileSync('lib/readiness.ts', 'utf8'),
};

const failures = [];

const forbiddenUiTokens = [
  'ReadinessService',
  'BFF',
  'Backend',
  'БД /',
  'AssistantService',
  'MapZoneService',
  'WishlistService',
  'Supabase client env',
  'HMAC',
  'Raw Telegram ID',
  'TELEGRAM_',
  'WEBHOOK',
  'TOKEN',
  'SECRET',
  'commerce/rebuy loop',
];

for (const [name, content] of Object.entries({
  page: files.page,
  dogCard: files.dogCard,
  dogCardActions: files.dogCardActions,
})) {
  for (const token of forbiddenUiTokens) {
    if (content.includes(token)) failures.push(`${name} exposes technical UI token: ${token}`);
  }
}

for (const token of ['профиль в Supabase', 'commerce/rebuy loop']) {
  if (files.readiness.includes(token)) failures.push(`readiness model contains user-facing technical copy: ${token}`);
}

const requiredOwnerLanguage = [
  'Сегодня',
  'Памятка',
  'Что увидит другой человек',
  'Куда можно',
  'План заботы',
];

for (const token of requiredOwnerLanguage) {
  if (!files.page.includes(token)) failures.push(`owner-language UX copy missing: ${token}`);
}

const statusSurfaceCount = (files.page.match(/readiness-details|telegram-status-panel|service-state-strip/g) ?? []).length;
if (statusSurfaceCount > 1) failures.push(`too many status surfaces in page.tsx: ${statusSurfaceCount}`);

if (files.page.includes('service-state-strip')) {
  failures.push('readiness/service status strips must not be exposed in primary user screens');
}

const cardStart = files.page.indexOf("{tab === 'card'");
const cardEnd = files.page.indexOf("{tab === 'profile'", cardStart);
const cardBlock = cardStart >= 0 && cardEnd > cardStart ? files.page.slice(cardStart, cardEnd) : '';
if (!cardBlock) failures.push('public card tab block missing');

const forbiddenCardTokens = [
  'readiness',
  'status',
  'PNG',
  'viral',
  'export',
  'download',
  'ask_first',
  'do_not_approach',
  'calm_dogs_only',
  'known_only',
  'Кого встретить',
  'Свайпай',
  'dog-match-card',
  'swipe-actions',
  'match-brief-panel',
];

for (const token of forbiddenCardTokens) {
  if (cardBlock.includes(token)) failures.push(`public card tab exposes non-product token: ${token}`);
}

for (const token of ['public-card-review', 'public-card-checklist', 'public-card-actions-panel', 'public-card-privacy-note']) {
  if (!cardBlock.includes(token)) failures.push(`public card tab missing owner-safe surface: ${token}`);
}

if (!files.page.includes("profile.dogName.trim() && profile.socialMode && (profile.triggers || profile.bio) && profile.neighborhood")) {
  failures.push('public card must require name, contact rule, bio/triggers, and safe neighborhood before sharing');
}

const navStart = files.page.indexOf('<nav className="app-tabs"');
const navEnd = files.page.indexOf('</nav>', navStart);
const navBlock = navStart >= 0 && navEnd > navStart ? files.page.slice(navStart, navEnd) : '';
if (!navBlock) failures.push('primary app nav missing');
for (const token of ['всё', 'псё', 'карта', 'рядом', 'вещи']) {
  if (!navBlock.includes(token)) failures.push(`primary nav missing section: ${token}`);
}
if (!files.page.includes("{tab === 'things'")) failures.push('things/wishlist tab surface missing');
if (!files.page.includes("{tab === 'assistant'")) failures.push('assistant tab surface missing');
if (!files.page.includes("{tab === 'nearby'")) failures.push('socialization/nearby tab surface missing');

for (const token of ["saveOnboardingCarePlan('profile')", "saveOnboardingCarePlan('calendar')", 'Открыть приложение с первым делом']) {
  if (!files.page.includes(token)) failures.push(`onboarding reveal can bypass first care task, missing: ${token}`);
}

const mapStart = files.page.indexOf("{tab === 'map'");
const mapEnd = files.page.indexOf("{error &&", mapStart);
const mapBlock = mapStart >= 0 && mapEnd > mapStart ? files.page.slice(mapStart, mapEnd) : '';
if (!mapBlock) failures.push('map tab block missing');
for (const token of ['Поделиться ссылкой', 'В публичный слой', '>Общее<']) {
  if (mapBlock.includes(token)) failures.push(`map tab exposes public/community flow: ${token}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('ux surface contract ok');
