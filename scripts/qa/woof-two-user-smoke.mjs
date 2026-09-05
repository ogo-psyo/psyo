import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://localhost:3101';
let activeSignal = null;
let sharedRequest = null;
const requestReads = new Map();

const appProfile = (pet) => ({ dogName: pet.name, backendPetId: pet.id, breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя', vaccineStatus: 'актуально', parasiteStatus: 'актуально', socialMode: 'сначала спросить', energyLevel: 'обычный', temperament: 'спокойная', neighborhood: 'Сокол', photos: [], selectedStyle: 'city' });

async function makeUser(browser, { ownerId, pet, location }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: location, permissions: ['geolocation'] });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'Telegram', { configurable: false, value: { WebApp: { initData: 'two-user-fixture', ready() {}, expand() {}, enableClosingConfirmation() {}, openTelegramLink() {} } } });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
  const page = await context.newPage();
  await page.route('**/api/v1/session/telegram', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'telegram', session: { psyoUserId: ownerId, ownerId, firstName: pet.name, username: ownerId } }) }));
  await page.route('**/api/app/bootstrap**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'owner', pet, pets: [pet], profile: appProfile(pet), activePetId: pet.id, reminders: [], wishlist: [], zones: [], routes: [], observations: [], documents: [] }) }));
  await page.route('**/api/social/profile**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile: null }) }));
  await page.route('**/api/social/candidates**', (route) => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'DISCOVERY_NOT_ENABLED' }) }));
  await page.route('**/api/social/signals**', async (route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      const body = route.request().postDataJSON();
      activeSignal = { id: 'signal-a', petId: pet.id, name: pet.name, avatarUrl: null, city: 'moscow', district: 'Сокол', approximateLocation: { lat: 55.76, lng: 37.62 }, privacyRadiusMeters: 700, startsAt: body.startsAt, expiresAt: new Date(Date.now() + 7_200_000).toISOString(), pace: body.pace, note: body.note, temperament: 'calm', dogFriendly: 'friendly', isMine: false, contactVisibility: 'hidden_until_mutual_consent' };
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ signal: activeSignal }) });
    }
    const visible = activeSignal ? [{ ...activeSignal, isMine: activeSignal.petId === pet.id }] : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signals: visible, viewer: { approximateLocation: { lat: location.latitude, lng: location.longitude }, radiusMeters: 3000, city: 'moscow' } }) });
  });
  await page.route('**/api/social/requests**', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      sharedRequest = { id: 'request-b', senderPetId: body.senderPetId, recipientPetId: body.recipientPetId, scenario: body.scenario, status: 'pending', telegramContactUrl: null, otherDog: { name: pet.name, avatarUrl: null } };
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ request: sharedRequest }) });
    }
    requestReads.set(ownerId, (requestReads.get(ownerId) || 0) + 1);
    const requests = sharedRequest && [sharedRequest.senderPetId, sharedRequest.recipientPetId].includes(pet.id) ? [{ ...sharedRequest, otherDog: { name: sharedRequest.senderPetId === pet.id ? 'Мята' : 'Луна', avatarUrl: null } }] : [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requests, missingTelegramUsernameAction: null }) });
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate((stored) => { localStorage.setItem('pso.topapp.onboarding.v1', 'done'); localStorage.setItem('pso.product.profile.v5', JSON.stringify(stored)); }, appProfile(pet));
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.app-tabs button[data-route="nearby"]').click({ force: true });
  await page.waitForTimeout(250);
  if (!await page.locator('.production-woof-workspace').count()) {
    await page.locator('.production-journey-woof').getByRole('button', { name: /Гав/ }).click({ force: true });
  }
  await page.locator('.production-woof-workspace').waitFor();
  const requestsDialog = page.getByRole('dialog', { name: 'Отклики и связи' });
  if (await requestsDialog.isVisible().catch(() => false)) {
    await requestsDialog.getByRole('button', { name: 'Закрыть' }).click();
  }
  await page.waitForTimeout(500);
  return { context, page };
}

const browser = await chromium.launch({ headless: true });
try {
  const userA = await makeUser(browser, { ownerId: 'owner-a', pet: { id: 'pet-a', name: 'Мята', owner_id: 'owner-a' }, location: { latitude: 55.76, longitude: 37.62 } });
  await userA.page.getByRole('button', { name: 'Дать Гав', exact: true }).click();
  await userA.page.locator('.woof-composer .woof-primary').click();
  await userA.page.getByText('ваш Гав').waitFor();

  const userB = await makeUser(browser, { ownerId: 'owner-b', pet: { id: 'pet-b', name: 'Луна', owner_id: 'owner-b' }, location: { latitude: 55.761, longitude: 37.621 } });
  await userB.page.locator('.woof-signal-card').filter({ hasText: 'Мята' }).waitFor();
  await userB.page.getByRole('button', { name: 'Откликнуться', exact: true }).click();
  assert.equal(sharedRequest?.senderPetId, 'pet-b');
  assert.equal(sharedRequest?.recipientPetId, 'pet-a');
  assert.equal(sharedRequest?.scenario, 'walk');

  const readsBeforeRefresh = requestReads.get('owner-a') || 0;
  await userA.page.bringToFront();
  await userA.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await userA.page.waitForTimeout(500);
  assert.ok((requestReads.get('owner-a') || 0) > readsBeforeRefresh, 'user A should poll requests while Gav stays open');
  const labels = await userA.page.locator('.woof-topbar button').evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') || button.textContent));
  assert.ok(labels.includes('Отклики и связи: 1'), `user A should receive the response badge; got ${labels.join(' | ')}`);
  console.log('woof two-user smoke: PASS');
  await userA.context.close();
  await userB.context.close();
} finally {
  await browser.close();
}
