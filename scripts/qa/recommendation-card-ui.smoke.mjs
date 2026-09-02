import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3102';
const outDir = process.env.OUT_DIR || 'artifacts/recommendation-card';
await fs.mkdir(outDir, { recursive: true });

const pet = {
  id: 'pet-mint-recommendation',
  name: 'Мята',
  owner_id: 'owner-recommendation-review',
  breed_id: 'mixed',
  breed_group_id: 'mixed',
  life_stage: 'adult',
};
const profile = {
  dogName: pet.name,
  backendPetId: pet.id,
  breedId: 'mixed',
  breedGroupId: 'mixed',
  lifeStage: 'взрослая',
  sex: 'девочка',
  size: 'средняя',
  energyLevel: 'обычный',
  temperament: 'спокойная',
  photos: [],
  selectedStyle: 'city',
};
const baseRecommendation = {
  id: 'recommendation-review-1',
  petId: pet.id,
  scenarioKey: 'care.reminder_due',
  policyVersion: 'care.reminder_due.v1',
  category: 'care',
  risk: 'routine',
  status: 'eligible',
  createdAt: '2026-09-02T15:00:00.000Z',
  freshUntil: '2026-09-03T15:00:00.000Z',
  expiresAt: '2026-09-04T15:00:00.000Z',
  evidence: [{ sourceType: 'reminder', sourceId: 'rem-1', capturedAt: '2026-09-02T15:00:00.000Z', dueAt: '2026-09-02T18:00:00.000Z', ownerConfirmed: true }],
  missingData: [],
  conflicts: [],
  suppressionReasons: [],
  confidence: { dataSufficiency: 'high', sourceReliability: 'high', ruleCertainty: 'high' },
  rank: { tier: 2, urgency: 90, actionability: 95, relevance: 90, annoyancePenalty: 0 },
  title: 'Вернуться к вечерней чистке зубов',
  whyNow: ['Дело запланировано на сегодня и ещё не выполнено.', 'Оно уже есть в плане ухода Мяты.'],
  limitation: 'Это напоминание об уходе, а не медицинская рекомендация.',
  primaryAction: { intent: 'open_reminder', reminderId: 'rem-1' },
  fingerprint: 'a'.repeat(64),
};

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  const viewports = [
    { width: 320, height: 720, name: 'narrow', action: 'snooze' },
    { width: 390, height: 844, name: 'telegram-ios', action: 'accept' },
    { width: 1280, height: 900, name: 'wide', action: 'dismiss' },
  ].filter((viewport) => !process.env.VIEWPORT || viewport.name === process.env.VIEWPORT);
  for (const viewport of viewports) {
    let status = 'eligible';
    const context = await browser.newContext({ viewport });
    await context.addInitScript(() => {
      Object.defineProperty(window, 'Telegram', {
        configurable: false,
        value: { WebApp: { initData: 'recommendation-review-fixture', ready() {}, expand() {}, enableClosingConfirmation() {} } },
      });
    });
    await context.addInitScript((storedProfile) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
    }, profile);
    const page = await context.newPage();
    const recommendationRequests = [];
    const apiRequests = [];
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') pageErrors.push(message.text());
    });
    page.on('request', (request) => {
      if (request.url().includes('/api/')) apiRequests.push(`${request.method()} ${request.url()}`);
      if (request.url().includes('/api/recommendations')) recommendationRequests.push(`${request.method()} ${request.url()}`);
    });
    await page.route('**/api/v1/session/telegram', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ mode: 'telegram', session: { psyoUserId: 'review', ownerId: 'owner-recommendation-review', firstName: 'Review', username: 'review_owner' } }),
    }));
    await page.route('**/api/app/bootstrap**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mode: 'owner', pet, pets: [pet], profile, activePetId: pet.id,
        reminders: [{ id: 'rem-1', petId: pet.id, type: 'dental', title: 'Почистить зубы', dueAt: '2026-09-02T18:00:00.000Z', status: 'pending' }],
        wishlist: [], zones: [], routes: [], observations: [], documents: [],
      }),
    }));
    await page.route('**/api/recommendations**', async (route) => {
      const request = route.request();
      if (request.method() === 'PATCH') {
        const command = request.postDataJSON();
        status = command.action === 'show' ? 'shown' : command.action === 'accept' ? 'accepted' : command.action === 'snooze' ? 'snoozed' : 'dismissed';
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ recommendation: { ...baseRecommendation, status } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ main: { ...baseRecommendation, status } }) });
    });

    await page.goto(base, { waitUntil: 'networkidle' });

    const card = page.locator('[data-recommendation-card]');
    try {
      await card.waitFor({ timeout: 15_000 });
    } catch (error) {
      const diagnostic = await page.evaluate(() => ({
        body: document.body.innerText.slice(0, 1200),
        profile: localStorage.getItem('pso.product.profile.v5'),
        telegram: window.Telegram?.WebApp ? { initData: window.Telegram.WebApp.initData } : null,
      }));
      console.error(JSON.stringify({ viewport: viewport.name, apiRequests, recommendationRequests, pageErrors, diagnostic }, null, 2));
      throw error;
    }
    await card.scrollIntoViewIfNeeded();
    if (viewport.name === 'narrow') {
      await page.locator('[data-production-journey="today"]').evaluate((screen) => screen.scrollBy({ top: 180, behavior: 'instant' }));
    }
    const geometry = await page.evaluate(() => {
      const cardNode = document.querySelector('[data-recommendation-card]');
      const buttons = [...document.querySelectorAll('[data-recommendation-card] button')];
      const dock = document.querySelector('.app-tabs')?.getBoundingClientRect();
      const shell = document.querySelector('[data-production-journey="today"]');
      const cardBox = cardNode?.getBoundingClientRect();
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        card: cardBox && { left: cardBox.left, right: cardBox.right, top: cardBox.top, bottom: cardBox.bottom },
        buttonHeights: buttons.map((button) => button.getBoundingClientRect().height),
        actionBottom: buttons.length ? buttons.at(-1).getBoundingClientRect().bottom : null,
        dockTop: dock?.top ?? null,
        shell: shell && { scrollTop: shell.scrollTop, scrollHeight: shell.scrollHeight, clientHeight: shell.clientHeight, overflowY: getComputedStyle(shell).overflowY },
      };
    });
    if (geometry.scrollWidth > geometry.width) throw new Error(`${viewport.name}: horizontal overflow ${geometry.scrollWidth}/${geometry.width}`);
    if (!geometry.card || geometry.card.left < 0 || geometry.card.right > geometry.width) throw new Error(`${viewport.name}: recommendation card is clipped`);
    if (geometry.buttonHeights.some((height) => height < 44)) throw new Error(`${viewport.name}: recommendation action below 44px`);
    if (viewport.width < 760 && geometry.dockTop !== null && geometry.actionBottom !== null && geometry.actionBottom > geometry.dockTop) throw new Error(`${viewport.name}: recommendation actions remain behind the mobile dock (${geometry.actionBottom}/${geometry.dockTop}; ${JSON.stringify(geometry.shell)})`);
    await page.screenshot({ path: `${outDir}/${viewport.name}.png`, fullPage: false });

    if (viewport.action === 'accept') {
      await page.getByRole('button', { name: 'Открыть дело', exact: true }).click();
      await page.getByRole('heading', { name: 'План заботы', exact: true }).waitFor();
    } else if (viewport.action === 'snooze') {
      await page.getByRole('button', { name: 'На завтра', exact: true }).click();
      await card.waitFor({ state: 'detached' });
    } else {
      await page.getByRole('button', { name: 'Скрыть', exact: true }).click();
      await card.waitFor({ state: 'detached' });
    }
    results.push({ viewport: viewport.name, action: viewport.action, status, geometry });
    await context.close();
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  await browser.close();
}
