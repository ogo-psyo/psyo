#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import {
  assertSafeFixtureConfig,
  assertSecretSafeText,
  buildSyntheticTopology,
  cookieHasRequiredSecurityFlags,
  extractTelegramUserId,
} from './lib/owner-isolation-harness.mjs';

const topology = buildSyntheticTopology();
assert.equal(topology.owners.length, 2, 'fixture topology must contain exactly two owners');
assert.equal(topology.owners[0].pets.length, 2, 'owner A must have two dogs for active-pet isolation');
assert.equal(topology.owners[1].pets.length, 1, 'owner B must have a dog for cross-owner isolation');

const allPetIds = topology.owners.flatMap((owner) => owner.pets.map((pet) => pet.id));
assert.equal(new Set(allPetIds).size, allPetIds.length, 'pet fixture ids must be unique');

assert.equal(
  cookieHasRequiredSecurityFlags('psyo_session=opaque; Path=/; Max-Age=60; HttpOnly; SameSite=Lax; Secure'),
  true,
  'app session cookie must be HttpOnly, SameSite=Lax and Secure',
);
assert.equal(cookieHasRequiredSecurityFlags('psyo_session=opaque; Path=/'), false, 'weak cookies must fail');

const initData = new URLSearchParams({
  auth_date: '1700000000',
  user: JSON.stringify({ id: 10101, first_name: 'Fixture A' }),
  hash: 'not-a-secret-for-parser-test',
}).toString();
assert.equal(extractTelegramUserId(initData), '10101');
assert.equal(extractTelegramUserId('auth_date=1700000000'), null);

assert.doesNotThrow(() => assertSecretSafeText('owner A session accepted', [initData]));
assert.throws(() => assertSecretSafeText(`failed: ${initData}`, [initData]), /secret material/);

const safeConfig = {
  enabled: true,
  baseUrl: 'http://127.0.0.1:3100',
  targetEnvironment: 'qa',
  isolationAck: 'isolated-fixtures-only',
  ownerAInitData: initData,
  ownerBInitData: initData.replace('10101', '20202'),
  ownerAPet1Id: '00000000-0000-4000-8000-0000000000a1',
  ownerAPet2Id: '00000000-0000-4000-8000-0000000000a2',
  ownerBPet1Id: '00000000-0000-4000-8000-0000000000b1',
};
assert.doesNotThrow(() => assertSafeFixtureConfig(safeConfig));
assert.throws(
  () => assertSafeFixtureConfig({ ...safeConfig, baseUrl: 'https://pso-mvp.vercel.app' }),
  /loopback/,
);
assert.throws(
  () => assertSafeFixtureConfig({ ...safeConfig, targetEnvironment: 'production' }),
  /qa environment/,
);

const token = '123456:synthetic-token';
const fields = new URLSearchParams({ auth_date: '1700000000', query_id: 'fixture', user: JSON.stringify({ id: 30303 }) });
const dataCheckString = Array.from(fields.entries())
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${key}=${value}`)
  .join('\n');
const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
fields.set('hash', createHmac('sha256', secretKey).update(dataCheckString).digest('hex'));
assert.equal(extractTelegramUserId(fields.toString()), '30303');

console.log('owner isolation foundation ok (synthetic only; no live RLS claim)');
