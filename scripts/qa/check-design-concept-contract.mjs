#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  css: readFileSync('app/globals.css', 'utf8'),
  direction: readFileSync('DESIGN_DIRECTION.md', 'utf8'),
  navigation: readFileSync('components/app/AppNavigation.tsx', 'utf8'),
  nextCare: readFileSync('components/today/NextCareCard.tsx', 'utf8'),
};

const failures = [];

for (const token of [
  'Living Companion OS',
  'cream/mint botanical base',
  'simple daily action card',
]) {
  if (!files.direction.includes(token)) failures.push(`DESIGN_DIRECTION.md missing concept token: ${token}`);
}

for (const token of [
  'UI/UX kit alignment 2026-06-25',
  '--bg: #F5F7F2',
  '--surface: #FFFFFF',
  '--ink: #19231D',
  '--muted: #7A837C',
  '--coral: #5E9F74',
  '--surface-quiet: #EAF5ED',
  '.kit-hero-card',
  '.kit-next-card',
  '.app-header .telegram-pill',
]) {
  if (!files.css.includes(token)) failures.push(`globals.css missing kit-alignment token: ${token}`);
}

if (!files.page.includes('<NextCareCard')) {
  failures.push('page.tsx missing focused Today care card');
}
if (!files.nextCare.includes('data-testid="today-first-viewport"')) {
  failures.push('NextCareCard missing first-viewport marker');
}

for (const token of [
  'план ухода и памятка',
  'ближайшее дело',
  'Памятка',
]) {
  if (!`${files.page}\n${files.nextCare}`.includes(token)) failures.push(`focused experience missing concept copy: ${token}`);
}

for (const section of ["label: 'всё'", "label: 'псё'", "label: 'карта'", "label: 'рядом'", "label: 'вещи'"]) {
  if (!files.navigation.includes(section)) failures.push(`primary nav must keep section: ${section}`);
}

for (const route of ["id: 'today'", "id: 'profile'", "id: 'map'", "id: 'nearby'", "id: 'things'"]) {
  if (!files.navigation.includes(route)) failures.push(`primary nav must keep route: ${route}`);
}

for (const forbidden of [
  'режим предпросмотра',
  'Псё · Telegram Mini App</p>',
]) {
  if (files.page.includes(forbidden)) failures.push(`page.tsx still exposes non-kit header copy: ${forbidden}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('design concept contract ok');
