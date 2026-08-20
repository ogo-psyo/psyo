#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const navigation = readFileSync('components/app/AppNavigation.tsx', 'utf8');
const page = readFileSync('app/page.tsx', 'utf8');

const failures = [];
const primaryRoutes = [
  ["id: 'today'", "label: 'всё'"],
  ["id: 'profile'", "label: 'псё'"],
  ["id: 'map'", "label: 'карта'"],
  ["id: 'nearby'", "label: 'гав'"],
  ["id: 'things'", "label: 'вещи'"],
];

let cursor = -1;
for (const [route, label] of primaryRoutes) {
  const routeIndex = navigation.indexOf(route, cursor + 1);
  const labelIndex = navigation.indexOf(label, routeIndex);
  if (routeIndex < 0 || labelIndex < routeIndex) {
    failures.push(`canonical primary route missing or out of order: ${route} / ${label}`);
    continue;
  }
  cursor = labelIndex;
}

for (const forbidden of ["id: 'calendar'", "id: 'card'", "id: 'assistant'", "label: 'План'", "label: 'Памятка'"]) {
  if (navigation.includes(forbidden)) failures.push(`secondary surface leaked into primary navigation: ${forbidden}`);
}

for (const route of ['today', 'profile', 'map', 'nearby', 'things']) {
  const surface = new RegExp(`\\{(?:hasDog\\s*&&\\s*)?tab\\s*===\\s*['\"]${route}['\"]`);
  if (!surface.test(page)) failures.push(`primary route has no reachable surface: ${route}`);
}

for (const route of ['calendar', 'card']) {
  const surface = new RegExp(`\\{(?:hasDog\\s*&&\\s*)?tab\\s*===\\s*['\"]${route}['\"]`);
  if (!surface.test(page)) failures.push(`secondary in-app surface was removed: ${route}`);
}

for (const token of ["setTab('calendar')", "setTab('card')"]) {
  if (!page.includes(token)) failures.push(`secondary surface lost its in-app entry point: ${token}`);
}
for (const route of ['app/legal/privacy/page.tsx', 'app/legal/terms/page.tsx', 'app/support/page.tsx']) {
  if (!existsSync(route)) failures.push(`secondary legal/support route was removed: ${route}`);
}

if (navigation.includes('Beta') || navigation.includes('beta')) {
  failures.push('primary nearby route must not be labelled as a Beta placeholder');
}

if (!page.includes('/api/social/candidates?petId=')) {
  failures.push('nearby route is not connected to the existing real-candidate endpoint');
}
if (page.includes('nearbyDogs.map')) {
  failures.push('nearby route still renders fixture dogs as real candidates');
}
for (const state of ["nearbyState === 'loading'", "nearbyState === 'error'", "nearbyState === 'idle'", "nearbyState === 'ready'"]) {
  if (!page.includes(state)) failures.push(`nearby route missing honest state: ${state}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('canonical navigation contract ok');
