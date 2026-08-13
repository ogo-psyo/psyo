#!/usr/bin/env node
import { strict as assert } from 'node:assert';
import {
  assertSafeFixtureConfig,
  assertSecretSafeText,
  cookieHasRequiredSecurityFlags,
  extractTelegramUserId,
  fixtureConfigFromEnv,
} from './lib/owner-isolation-harness.mjs';

const config = fixtureConfigFromEnv();
if (!config.enabled) {
  console.log('owner isolation live fixtures skipped (set PSYO_QA_ISOLATION_RUN=1 for an isolated QA database)');
  process.exit(0);
}
assertSafeFixtureConfig(config);

const baseUrl = config.baseUrl.replace(/\/$/, '');
const secrets = [config.ownerAInitData, config.ownerBInitData];
const rawTelegramIds = secrets.map(extractTelegramUserId).filter(Boolean);
const created = [];

function safeLog(message) {
  assertSecretSafeText(message, [...secrets, ...rawTelegramIds]);
  console.log(message);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('accept', 'application/json');
  if (options.cookie) headers.set('cookie', options.cookie);
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    headers.set('origin', baseUrl);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || (options.body === undefined ? 'GET' : 'POST'),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  assertSecretSafeText(text, rawTelegramIds);
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  return { response, body };
}

async function authenticate(initData) {
  const { response, body } = await request('/api/v1/session/telegram', { body: { initData } });
  assert.equal(response.status, 200, 'fresh Telegram fixture must create a session');
  const setCookie = response.headers.getSetCookie?.()[0] || response.headers.get('set-cookie') || '';
  assert.equal(cookieHasRequiredSecurityFlags(setCookie), true, 'session cookie security flags are required');
  assert.ok(body?.session?.ownerId, 'fixture session must be connected to a storage owner');
  const cookie = setCookie.split(';', 1)[0];
  assert.ok(cookie.startsWith('psyo_session='), 'psyo_session cookie is required');
  return { cookie, ownerId: body.session.ownerId };
}

async function assertStatus(path, cookie, expectedStatus, options = {}) {
  const result = await request(path, { ...options, cookie });
  assert.equal(result.response.status, expectedStatus, `${options.method || 'GET'} ${path} expected ${expectedStatus}`);
  return result.body;
}

async function createReminder(cookie, petId, ownerKey, dogKey) {
  const body = await assertStatus('/api/reminders', cookie, 201, {
    body: {
      petId,
      title: `qa-isolation-${ownerKey}-${dogKey}-${Date.now()}`,
      dueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      type: 'custom',
      recurrence: 'none',
      source: 'qa-isolation',
    },
  });
  assert.equal(body?.reminder?.petId, petId);
  assert.ok(body?.reminder?.id, 'created reminder id is required for isolated cleanup');
  created.push({ cookie, id: body.reminder.id });
  return body.reminder;
}

async function cleanup() {
  const failures = [];
  for (const item of created.splice(0).reverse()) {
    try {
      const result = await request(`/api/reminders/${encodeURIComponent(item.id)}`, { method: 'DELETE', cookie: item.cookie, body: {} });
      if (result.response.status !== 200 && result.response.status !== 404) failures.push(item.id);
    } catch {
      failures.push(item.id);
    }
  }
  if (failures.length) throw new Error(`isolated cleanup failed for ${failures.length} QA record(s)`);
}

try {
  const health = await request('/api/internal/health');
  assert.equal(health.response.status, 200, 'QA app health endpoint must be available');
  assert.equal(health.body?.environment, 'qa', 'runner refuses writes unless the app reports APP_ENV=qa');
  assert.equal(health.body?.checks?.identityServiceReady, true, 'IdentityService must be configured');

  const ownerA = await authenticate(config.ownerAInitData);
  const ownerB = await authenticate(config.ownerBInitData);
  assert.notEqual(ownerA.ownerId, ownerB.ownerId, 'Telegram fixtures must bridge to distinct owners');

  const petsA = await assertStatus('/api/v1/pets', ownerA.cookie, 200);
  const petsB = await assertStatus('/api/v1/pets', ownerB.cookie, 200);
  const petIdsA = new Set((petsA?.pets || []).map((pet) => pet.id));
  const petIdsB = new Set((petsB?.pets || []).map((pet) => pet.id));
  assert.equal(petIdsA.has(config.ownerAPet1Id), true);
  assert.equal(petIdsA.has(config.ownerAPet2Id), true);
  assert.equal(petIdsA.has(config.ownerBPet1Id), false);
  assert.equal(petIdsB.has(config.ownerBPet1Id), true);
  assert.equal(petIdsB.has(config.ownerAPet1Id), false);

  await assertStatus(`/api/app/bootstrap?petId=${encodeURIComponent(config.ownerAPet1Id)}`, ownerA.cookie, 200);
  await assertStatus(`/api/app/bootstrap?petId=${encodeURIComponent(config.ownerAPet2Id)}`, ownerA.cookie, 200);
  await assertStatus(`/api/app/bootstrap?petId=${encodeURIComponent(config.ownerBPet1Id)}`, ownerA.cookie, 404);
  await assertStatus(`/api/app/bootstrap?petId=${encodeURIComponent(config.ownerAPet1Id)}`, ownerB.cookie, 404);

  const reminderA1 = await createReminder(ownerA.cookie, config.ownerAPet1Id, 'a', 'a1');
  const reminderA2 = await createReminder(ownerA.cookie, config.ownerAPet2Id, 'a', 'a2');
  const reminderB1 = await createReminder(ownerB.cookie, config.ownerBPet1Id, 'b', 'b1');

  const listA1 = await assertStatus(`/api/reminders?petId=${encodeURIComponent(config.ownerAPet1Id)}`, ownerA.cookie, 200);
  assert.equal((listA1?.reminders || []).some((item) => item.id === reminderA1.id), true);
  assert.equal((listA1?.reminders || []).some((item) => item.id === reminderA2.id), false);
  assert.equal((listA1?.reminders || []).some((item) => item.id === reminderB1.id), false);

  const crossOwnerRead = await assertStatus(`/api/reminders?petId=${encodeURIComponent(config.ownerBPet1Id)}`, ownerA.cookie, 200);
  assert.equal((crossOwnerRead?.reminders || []).some((item) => item.id === reminderB1.id), false);
  await assertStatus('/api/reminders', ownerB.cookie, 404, {
    body: { petId: config.ownerAPet1Id, title: 'qa-cross-owner-denied', dueAt: new Date().toISOString() },
  });
  await assertStatus(`/api/reminders/${encodeURIComponent(reminderB1.id)}`, ownerA.cookie, 404, {
    method: 'PATCH',
    body: { title: 'qa-cross-owner-update-denied' },
  });
  await assertStatus(`/api/reminders/${encodeURIComponent(reminderB1.id)}`, ownerA.cookie, 404, {
    method: 'DELETE',
    body: {},
  });

  await assertStatus(`/api/reminders/${encodeURIComponent(reminderA1.id)}`, ownerA.cookie, 200, {
    method: 'PATCH',
    body: { title: `qa-isolation-updated-${Date.now()}` },
  });

  safeLog('owner isolation live fixtures passed: two owners, A1/A2 separation, IDOR denial and cleanup');
} finally {
  await cleanup();
}
