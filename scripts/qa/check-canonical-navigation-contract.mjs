#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const navigation = readFileSync('components/app/AppNavigation.tsx', 'utf8');
const page = readFileSync('app/page.tsx', 'utf8');
const woof = readFileSync('components/social/ProductionWoofWorkspace.tsx', 'utf8');

const failures = [];
const tools = readFileSync('components/app/ConnectedHome.tsx', 'utf8');
for (const destination of ['diary','calendar','health','habits','things','passport','card']) {
 if (!tools.includes(`id:'${destination}'`)) failures.push(`missing direct tool: ${destination}`);
}
if (!page.includes('onOpenJournalEntry=') || !page.includes('onOpenRecord={openPrivateRecord}')) failures.push('day and profile must resolve the same exact record');
const primaryRoutes = [
  ["id: 'today'", "label: 'Псё'"],
  ["id: 'map'", "label: 'Карта'"],
  ["id: 'nearby'", "label: 'Гав'"],
  ["id: 'all'", "label: 'Всё'"],
  ["id: 'profile'", "label: 'Профиль'"],
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

for (const route of ['today', 'profile', 'map', 'nearby', 'all']) {
  const surface = new RegExp(`\\{(?:hasDog\\s*&&\\s*)?tab\\s*===\\s*['\"]${route}['\"]`);
  const persistentMap = route === 'map' && page.includes("(tab === 'map' || mapVisited)") && page.includes("hidden={tab !== 'map'}");
  if (!surface.test(page) && !persistentMap) failures.push(`primary route has no reachable surface: ${route}`);
}

for (const route of ['calendar', 'card', 'things', 'diary']) {
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
for (const state of ["props.state === 'loading'", "props.state === 'error'"]) {
  if (!woof.includes(state)) failures.push(`nearby route missing honest state: ${state}`);
}
if (!page.includes("state={!hasConnectedAccount || !profile.backendPetId ? 'idle' : socialLoadedPet===profile.backendPetId?nearbyState:'loading'}")) failures.push('nearby route does not pass its state to the active workspace');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('canonical navigation contract ok');
