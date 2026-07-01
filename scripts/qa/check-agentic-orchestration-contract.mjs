#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const doc = readFileSync('docs/agentic-orchestration-2026-06-29.md', 'utf8');
const packageJson = readFileSync('package.json', 'utf8');

const failures = [];

for (const token of [
  'Agentic Orchestration Control Tower',
  'No role is advisory-only',
  'Agent Roster',
  'Product / IA',
  'Frontend / UX',
  'Backend / Auth / Privacy',
  'QA / Release',
  'Orchestrator',
  'Veto If',
  'P0 Execution Pipeline',
  'Trustworthy First Session',
  'Public Memo Worth Sharing',
  'Durable Care Loop',
  'Release Discipline',
  'Owner Isolation And Public Privacy',
  'Integration Decision Format',
  'No production deploy without Руслан approval',
  'IDOR tests',
  'Telegram fixture smoke',
  'persisted publish/unpublish',
  'service-role routes',
]) {
  if (!doc.includes(token)) failures.push(`orchestration doc missing required token: ${token}`);
}

for (const token of ['Leibniz', 'Darwin', 'Lorentz', 'Wegener']) {
  if (!doc.includes(token)) failures.push(`current parallel audit missing agent: ${token}`);
}

if (!packageJson.includes('check-agentic-orchestration-contract.mjs')) {
  failures.push('qa:local must include check-agentic-orchestration-contract.mjs');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('agentic orchestration contract ok');
