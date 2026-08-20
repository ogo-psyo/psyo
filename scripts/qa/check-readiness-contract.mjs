#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  readiness: readFileSync('lib/readiness.ts', 'utf8'),
  page: readFileSync('app/page.tsx', 'utf8'),
  journey: readFileSync('components/journey/ProductionJourney.tsx', 'utf8'),
  css: readFileSync('app/globals.css', 'utf8'),
};

const failures = [];

for (const token of [
  'export function buildAppReadiness',
  "service: 'ReadinessService'",
  'persistenceMode',
  'localOnly',
  'blockedPromises',
  'privacyState',
  'safetyState',
  'qaState',
]) {
  if (!files.readiness.includes(token)) failures.push(`Readiness contract missing ${token}`);
}

for (const token of [
  'buildAppReadiness({',
  'Что увидит другой человек',
  'Карта прогулок',
  'План заботы',
  'Памятка',
]) {
  if (!`${files.page}\n${files.journey}`.includes(token)) failures.push(`UI does not expose ${token}`);
}

for (const token of ['.readiness-details', '.readiness-badge']) {
  if (!files.css.includes(token)) failures.push(`CSS missing ${token}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('readiness contract ok');
