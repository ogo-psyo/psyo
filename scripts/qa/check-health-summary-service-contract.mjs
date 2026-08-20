import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const files = [
  'lib/server/healthTimelineService.ts',
  'lib/server/dogSummaryService.ts',
  'app/api/health/route.ts',
  'app/api/pets/[id]/summary/route.ts',
];
for (const file of files) assert.ok(existsSync(file), `target service missing file: ${file}`);

const health = readFileSync(files[0], 'utf8');
const summary = readFileSync(files[1], 'utf8');
const healthRoute = readFileSync(files[2], 'utf8');
const summaryRoute = readFileSync(files[3], 'utf8');

for (const token of ['listHealthTimelineForOwner', "from('pet_observations')", "eq('pets.owner_id', ownerId)", "is('deleted_at', null)"]) {
  assert.ok(health.includes(token), `HealthTimeline missing: ${token}`);
}
for (const token of ['buildDogSummary', 'getDogSummaryForOwner', 'attention', 'No medical inference']) {
  assert.ok(summary.includes(token), `DogSummary missing: ${token}`);
}
for (const source of [healthRoute, summaryRoute]) {
  assert.ok(source.includes('getAppSessionFromRequest'), 'route must support verified Telegram session');
  assert.ok(source.includes("problem('AUTH_REQUIRED'"), 'route must reject unauthenticated access');
}

console.log('health timeline and dog summary contracts ok');
