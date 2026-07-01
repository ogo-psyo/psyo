#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  copy: readFileSync('lib/copy.ts', 'utf8'),
  hld: readFileSync('docs/pso-hld-soa-2026-06-24/01-HLD.md', 'utf8'),
};

const failures = [];

const requiredCopyApi = [
  'formatTodayTitle',
  'inflectPetName',
  'formatCount',
  'formatReadinessLabel',
  'formatReminderGroupLine',
  'formatWishlistMeta',
  'formatZoneMeta',
];

for (const token of requiredCopyApi) {
  if (!files.copy.includes(`function ${token}`)) failures.push(`lib/copy.ts missing formatter: ${token}`);
  if (token !== 'inflectPetName' && !files.page.includes(token)) failures.push(`page.tsx does not use formatter: ${token}`);
}

const forbiddenUiSnippets = [
  ['preview mode', 'browser preview must be human Russian copy'],
  ['web preview', 'telegram pill must not expose product preview jargon'],
  ['{item.category} · {item.priority}', 'wishlist must not expose raw category/priority enums'],
  ['{item.category}{item.reason', 'wishlist history must not expose raw category enum'],
  ['{zone.type} ·', 'zones must not expose raw zone type enum'],
  ['активн. задач', 'counter must use pluralized Russian phrase'],
  ["blocked: 'блок'", 'readiness badge must not display raw blocker label'],
];

for (const [snippet, reason] of forbiddenUiSnippets) {
  if (files.page.includes(snippet)) failures.push(`${reason}: ${snippet}`);
}

const requiredPolicy = 'Raw enum/status labels in UI are forbidden';
if (!files.hld.includes(requiredPolicy)) failures.push(`HLD missing copy validation policy: ${requiredPolicy}`);

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('human copy contract ok');
