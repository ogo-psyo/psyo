import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync('app/page.tsx', 'utf8');

assert.ok(page.includes('profileHydrated'), 'profile storage needs an explicit hydration gate');
assert.match(page, /if \(!profileHydrated\) return;/, 'initial default profile must not overwrite persisted data');
assert.match(page, /setProfileHydrated\(true\)/, 'profile hydration must open the persistence gate');

console.log('profile storage hydration contract ok');
