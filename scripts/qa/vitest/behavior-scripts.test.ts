import { execFileSync } from 'node:child_process';
import { test } from 'vitest';

const cases = [
  ['tsx', 'scripts/qa/avatar-identity.behavior.test.ts'],
  ['tsx', 'scripts/qa/onboarding-core-profile.behavior.test.ts'],
  ['tsx', 'scripts/qa/dog-summary.behavior.test.ts'],
  ['tsx', 'scripts/qa/pet-name-inflection.behavior.test.ts'],
  ['tsx', 'scripts/qa/habit-period.behavior.test.ts'],
  ['tsx', 'scripts/qa/map-privacy.behavior.test.ts'],
  ['tsx', 'scripts/qa/map-routes-ui.behavior.test.ts'],
  ['tsx', 'scripts/qa/verified-contact.behavior.test.ts'],
  ['tsx', 'scripts/qa/social-profile.behavior.test.ts'],
  ['tsx', 'scripts/qa/social-discovery.behavior.test.ts'],
  ['tsx', 'scripts/qa/social-connections.behavior.test.ts'],
  ['tsx', 'scripts/qa/walk-signals.behavior.test.ts'],
  ['tsx', 'scripts/qa/walk-signal-discovery.behavior.test.ts'],
  ['tsx', 'scripts/qa/woof-live-refresh.behavior.test.ts'],
  ['tsx', 'scripts/qa/care-crud.behavior.test.ts'],
  ['tsx', 'scripts/qa/profile-lifecycle.behavior.test.ts'],
  ['tsx', 'scripts/qa/recoverable-delete.behavior.test.ts'],
  ['tsx', 'scripts/qa/guest-crud.behavior.test.ts'],
  ['tsx', 'scripts/qa/crud-matrix.behavior.test.ts'],
  ['tsx', 'scripts/qa/all-screen.behavior.test.ts'],
  ['tsx', 'scripts/qa/assistant-route.behavior.test.ts'],
  ['tsx', 'scripts/qa/wishlist-plan-contract.behavior.test.ts'],
  ['tsx', 'scripts/qa/assistant-context.behavior.test.ts'],
  ['tsx', 'scripts/qa/assistant-answer-service.behavior.test.ts'],
  ['tsx', 'scripts/qa/assistant-rate-limit.behavior.test.ts'],
  ['tsx', 'scripts/qa/groq-assistant.behavior.test.ts'],
  ['tsx', 'scripts/qa/observation-ingestion.behavior.test.ts'],
  ['tsx', 'scripts/qa/structured-observations.behavior.test.ts'],
  ['tsx', 'scripts/qa/observation-extraction-service.behavior.test.ts'],
  ['tsx', 'scripts/qa/observation-extraction-route.behavior.test.ts'],
  ['tsx', 'scripts/qa/wellbeing-scoring.behavior.test.ts'],
  ['tsx', 'scripts/qa/recommendation-contracts.behavior.test.ts'],
  ['tsx', 'scripts/qa/recommendation-storage.behavior.test.ts'],
  ['tsx', 'scripts/qa/recommendation-engine.behavior.test.ts'],
  ['tsx', 'scripts/qa/recommendation-client.behavior.test.ts'],
  ['tsx', 'scripts/qa/recommendation-retry.behavior.test.ts'],
  ['tsx', 'scripts/qa/voice-ingestion-service.behavior.test.ts'],
  ['tsx', 'scripts/qa/stt-rate-limit.behavior.test.ts'],
  ['tsx', 'scripts/qa/groq-stt.behavior.test.ts'],
  ['tsx', 'scripts/qa/stt-route.behavior.test.ts'],
  ['tsx', 'scripts/qa/voice-capture.behavior.test.ts'],
  ['node', 'scripts/qa/smoke-free-shell.mjs'],
  ['node', 'scripts/qa/smoke-nearby-ui.mjs'],
  ['node', 'scripts/qa/care-ui.behavior.test.mjs'],
] as const;

test.each(cases)('%s %s', (runner, file) => {
  const executable = runner === 'tsx' ? 'node_modules/.bin/tsx' : process.execPath;
  execFileSync(executable, [file], { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' });
});
