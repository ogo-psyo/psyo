import { execFileSync } from 'node:child_process';
import { test } from 'vitest';

const cases = [
  ['tsx', 'scripts/qa/map-privacy.behavior.test.ts'],
  ['tsx', 'scripts/qa/map-routes-ui.behavior.test.ts'],
  ['tsx', 'scripts/qa/verified-contact.behavior.test.ts'],
  ['tsx', 'scripts/qa/social-profile.behavior.test.ts'],
  ['tsx', 'scripts/qa/social-discovery.behavior.test.ts'],
  ['tsx', 'scripts/qa/social-connections.behavior.test.ts'],
  ['tsx', 'scripts/qa/care-crud.behavior.test.ts'],
  ['tsx', 'scripts/qa/profile-lifecycle.behavior.test.ts'],
  ['tsx', 'scripts/qa/recoverable-delete.behavior.test.ts'],
  ['node', 'scripts/qa/smoke-free-shell.mjs'],
  ['node', 'scripts/qa/smoke-nearby-ui.mjs'],
  ['node', 'scripts/qa/care-ui.behavior.test.mjs'],
] as const;

test.each(cases)('%s %s', (runner, file) => {
  const executable = runner === 'tsx' ? 'node_modules/.bin/tsx' : process.execPath;
  execFileSync(executable, [file], { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' });
});
