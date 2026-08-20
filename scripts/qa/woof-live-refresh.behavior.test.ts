import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../../components/social/ProductionWoofWorkspace.tsx', import.meta.url), 'utf8');

test('an open Gav surface refreshes signals and responses while visible', () => {
  assert.match(workspace, /window\.setInterval\(/);
  assert.match(workspace, /document\.visibilityState\s*!==\s*['"]visible['"]/);
  assert.match(workspace, /window\.addEventListener\(['"]focus['"]/);
  assert.match(page, /refreshLiveSocial/);
  assert.match(page, /onRefresh=\{refreshLiveSocial\}/);
  assert.match(page, /\/api\/social\/signals\?/);
  assert.match(page, /\/api\/social\/requests\?petId=/);
});
