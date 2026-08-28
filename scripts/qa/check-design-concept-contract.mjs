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
  '--kit-ink: #171814',
  '--kit-paper: #f7f6f0',
  '--kit-paper-raised: #fffdf8',
  '--kit-sage: #dde3d2',
  '--kit-lime: #d8ff72',
  '--kit-blue: #a9c7c9',
  '--kit-lilac: #c6a9e6',
  '--kit-coral: #f05a3d',
  '--kit-yellow: #f3df64',
  '--kit-pink: #eba4bf',
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

for (const section of ["label: 'всё'", "label: 'псё'", "label: 'карта'", "label: 'гав'", "label: 'вещи'"]) {
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
