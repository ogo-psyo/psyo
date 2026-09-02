#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
for (const path of [
  'components/recommendations/RecommendationCard.tsx',
  'components/recommendations/RecommendationCard.module.css',
  'lib/recommendations/client.ts',
  'lib/server/recommendations/outcomeRetry.ts',
  'app/api/internal/recommendation-outcomes/route.ts',
]) if (!existsSync(path)) failures.push(`missing rollout file: ${path}`);

const page = read('app/page.tsx');
for (const token of ['loadMainRecommendation', "command: { action: 'show' }", "{ action: 'accept' }", "{ action: 'snooze'", "{ action: 'dismiss'", 'recommendationId']) {
  if (!page.includes(token)) failures.push(`recommendation lifecycle UI missing: ${token}`);
}
const card = read('components/recommendations/RecommendationCard.tsx');
for (const copy of ['Почему этот совет появился сейчас', 'На завтра', 'Скрыть', 'Решение всегда за вами']) {
  if (!card.includes(copy)) failures.push(`recommendation card copy missing: ${copy}`);
}
const lifecycle = read('lib/server/recommendations/lifecycle.ts');
for (const binding of [".eq('cadence'", ".eq('target_per_period'", ".eq('reason'", ".gte('created_at', input.notBefore)"]) {
  if (!lifecycle.includes(binding)) failures.push(`domain outcome binding is too broad: ${binding}`);
}
const retry = `${read('lib/server/recommendations/outcomeRetry.ts')}\n${read('app/api/internal/recommendation-outcomes/route.ts')}`;
for (const token of ['attemptCount + 1', 'nextRetryAt', 'countExhausted', 'CRON_SECRET', 'RECOMMENDATION_RETRY_FAILED']) {
  if (!retry.includes(token)) failures.push(`outcome retry/alert contract missing: ${token}`);
}
if (!read('vercel.json').includes('/api/internal/recommendation-outcomes')) failures.push('Vercel cron does not invoke recommendation outcome retries');
const habitRoute = read('app/api/habits/route.ts');
if (!habitRoute.includes('linkRecommendationOutcome') || !habitRoute.includes("domainType: 'habit'")) failures.push('recommended habit creation does not close its outcome');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('recommendation rollout contract ok');
