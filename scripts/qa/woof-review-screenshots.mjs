import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3101';
const outDir = process.env.OUT_DIR || 'artifacts/woof-review';
await fs.mkdir(outDir, { recursive: true });

const pet = { id: 'pet-mint', name: 'Мята', owner_id: 'owner-review', breed_id: 'mixed', breed_group_id: 'mixed', life_stage: 'adult' };
const appProfile = { dogName: 'Мята', backendPetId: pet.id, breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя', vaccineStatus: 'актуально', parasiteStatus: 'актуально', socialMode: 'сначала спросить', energyLevel: 'обычный', temperament: 'спокойная', neighborhood: 'Сокол', photos: [], selectedStyle: 'city' };
const socialProfile = { petId: pet.id, discoverable: true, city: 'moscow', district: 'САО', coarseLocation: { lat: 55.76, lng: 37.62 }, scenarios: ['meet', 'walk'] };
const signals = [
  { id: 'signal-luna', petId: 'pet-luna', name: 'Луна', avatarUrl: null, city: 'moscow', district: 'район парка', approximateLocation: { lat: 55.765, lng: 37.61 }, privacyRadiusMeters: 700, startsAt: new Date(Date.now() + 25 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(), pace: 'calm', note: 'Идём вокруг пруда', temperament: 'calm', dogFriendly: 'friendly', isMine: false, contactVisibility: 'hidden_until_mutual_consent' },
  { id: 'signal-bim', petId: 'pet-bim', name: 'Бим', avatarUrl: null, city: 'moscow', district: 'САО', approximateLocation: { lat: 55.753, lng: 37.635 }, privacyRadiusMeters: 700, startsAt: new Date(Date.now() + 50 * 60_000).toISOString(), expiresAt: new Date(Date.now() + 3 * 60 * 60_000).toISOString(), pace: 'active', note: 'Быстрый круг перед сном', temperament: 'active', dogFriendly: 'selective', isMine: false, contactVisibility: 'hidden_until_mutual_consent' },
];
const candidates = [{ petId: 'pet-luna', name: 'Луна', avatarUrl: null, lifeStage: 'adult', weightKg: 18, temperament: 'calm', energyLevel: 'balanced', dogFriendly: 'friendly', playStyle: 'gentle', city: 'moscow', district: 'САО', scenarios: ['meet', 'walk'], sharedScenarios: ['meet', 'walk'], distance: 'до 5 км', reasons: ['Один район', 'Спокойный ритм прогулок'], contactVisibility: 'hidden_until_mutual_consent' }];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, geolocation: { latitude: 55.76, longitude: 37.62 }, permissions: ['geolocation'] });
    await context.addInitScript(() => { Object.defineProperty(window, 'Telegram', { configurable: false, value: { WebApp: { initData: 'review-fixture', ready() {}, expand() {}, enableClosingConfirmation() {}, openTelegramLink() {} } } }); });
    const page = await context.newPage();
    await page.route('**/api/v1/session/telegram', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'telegram', session: { psyoUserId: 'review', ownerId: 'owner-review', firstName: 'Review', username: 'review_owner' } }) }));
    await page.route('**/api/app/bootstrap**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'owner', pet, pets: [pet], profile: appProfile, activePetId: pet.id, reminders: [], wishlist: [], zones: [], routes: [], observations: [], documents: [] }) }));
    await page.route('**/api/social/profile**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ profile: socialProfile }) }));
    await page.route('**/api/social/candidates**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nearby: candidates, city: [] }) }));
    await page.route('**/api/social/requests**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requests: [], missingTelegramUsernameAction: null }) }));
    await page.route('**/api/social/signals**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signals }) }));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.evaluate((stored) => { localStorage.setItem('pso.topapp.onboarding.v1', 'done'); localStorage.setItem('pso.product.profile.v5', JSON.stringify(stored)); }, appProfile);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.app-tabs button[data-route="nearby"]').click({ force: true });
    await page.getByRole('button', { name: /Гав/, exact: true }).last().click({ force: true });
    await page.locator('.production-woof-workspace').waitFor();
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/live-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Дать Гав', exact: true }).click();
    await page.screenshot({ path: `${outDir}/composer-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.getByRole('button', { name: 'Знакомства', exact: true }).click();
    await page.screenshot({ path: `${outDir}/meet-${viewport.width}.png` });
    await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
    await page.getByRole('region', { name: 'Фильтры знакомств' }).waitFor();
    await page.screenshot({ path: `${outDir}/meet-filters-${viewport.width}.png`, fullPage: true });
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (geometry.scrollWidth > geometry.viewport) throw new Error(`${viewport.width}px: filters overflow horizontally`);
    await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
    const luna = page.getByRole('button', { name: /Луна/ }).first();
    if (await luna.count()) await luna.click();
    else await page.getByRole('button', { name: 'Создать анкету', exact: true }).first().click();
    await page.screenshot({ path: `${outDir}/profile-${viewport.width}.png` });
    await context.close();
  }
  console.log(`woof review screenshots: ${outDir}`);
} finally { await browser.close(); }
