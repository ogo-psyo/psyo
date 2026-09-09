#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  css: readFileSync('app/editorial.css', 'utf8'),
  direction: readFileSync('DESIGN_DIRECTION.md', 'utf8'),
  navigation: readFileSync('components/app/AppNavigation.tsx', 'utf8'),
  nextCare: readFileSync('components/today/NextCareCard.tsx', 'utf8'),
  journey: readFileSync('components/journey/ProductionJourney.tsx', 'utf8'),
};

const failures = [];

for (const token of [
  'Living Field Guide',
  'editorial utility',
  'one focal care action',
]) {
  if (!files.direction.includes(token)) failures.push(`DESIGN_DIRECTION.md missing concept token: ${token}`);
}

for (const token of [
  'living field guide',
  '--kit-ink: #233b30',
  '--kit-paper: #f4f6f2',
  '--kit-paper-raised: #fffefa',
  '--kit-sage: #e0eee3',
  '--kit-lime: #dceee0',
  '--kit-blue: #deedf0',
  '--kit-lilac: #e8e3f3',
  '--kit-coral: #a63f3f',
  '--kit-yellow: #f5e9c6',
  '--kit-pink: #efdde3',
  '.production-today-summary',
  '.production-journey-woof',
  '.v3-things-hero',
]) {
  if (!files.css.includes(token)) failures.push(`editorial.css missing reference-kit token: ${token}`);
}

if (!files.journey.includes('production-today-summary')) {
  failures.push('active journey missing focused Today care card');
}
if (!files.nextCare.includes('data-testid="today-first-viewport"')) {
  failures.push('NextCareCard missing first-viewport marker');
}

for (const token of [
  'план ухода и памятка',
  'ближайшее дело',
  'Памятка',
]) {
  if (!`${files.page}\n${files.nextCare}\n${files.journey}`.includes(token)) failures.push(`focused experience missing concept copy: ${token}`);
}

for (const section of ["label: 'Псё'", "label: 'Профиль'", "label: 'Карта'", "label: 'Гав'", "label: 'Всё'"]) {
  if (!files.navigation.includes(section)) failures.push(`primary nav must keep section: ${section}`);
}

for (const route of ["id: 'today'", "id: 'profile'", "id: 'map'", "id: 'nearby'", "id: 'all'"]) {
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
