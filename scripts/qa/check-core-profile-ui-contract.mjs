import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../../app/page.tsx', import.meta.url), 'utf8');

for (const token of [
  'name: nextName',
  'lifeStage: profile.lifeStage',
  'sex: profile.sex',
  'breedId: profile.breedId',
  'breedGroupId: profile.breedGroupId',
  'breedCustom: profile.breedCustom',
]) {
  assert.ok(page.includes(token), `onboarding must send persisted core field: ${token}`);
}

console.log('core profile UI contract ok');
