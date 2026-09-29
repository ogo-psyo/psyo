import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const outDir = process.env.OUT_DIR || 'artifacts/health-weight-design';
await fs.mkdir(outDir, { recursive: true });

const profile = {
  dogName: 'Плутон', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', age: '5 лет',
  birthDate: '2021-03-12', homeArrivalDate: '2021-05-01', vaccineStatus: 'актуально',
  parasiteStatus: 'актуально', allergies: 'не указано', photos: [], selectedStyle: 'city',
  backendPetId: 'guest-health-weight',
};
const observations = [
  { id: 'weight-1', petId: profile.backendPetId, type: 'weight', value: '14,2', observedAt: '2026-08-20T09:00:00.000Z', createdAt: '2026-08-20T09:00:00.000Z' },
  { id: 'weight-2', petId: profile.backendPetId, type: 'weight', value: '14,8', observedAt: '2026-09-20T09:00:00.000Z', createdAt: '2026-09-20T09:00:00.000Z' },
];

for (const [engine, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true });
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({ viewport: { width, height: width === 320 ? 700 : 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/app/bootstrap*', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'demo', connected: false, empty: true, pets: [], reminders: [], wishlist: [], zones: [], routes: [], observations: [], documents: [] }),
      }));
      await page.addInitScript(({ storedProfile, storedObservations }) => {
        localStorage.setItem('pso.topapp.onboarding.v1', 'done');
        localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
        localStorage.setItem(`pso.topapp.observations.v2:${storedProfile.backendPetId}`, JSON.stringify(storedObservations));
      }, { storedProfile: profile, storedObservations: observations });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.locator('#pso-exact-interface[data-auth-ready="true"]').waitFor();

      await page.locator('.app-tabs button[data-route="profile"]').click({ force: true });
      await page.locator('[data-exact-view="profile"]').waitFor();
      await page.getByText('12 марта 2021 г.').waitFor();
      await page.getByRole('button', { name: /^Здоровье/ }).click();

      const health = page.locator('[data-health-workspace]');
      await health.waitFor();
      await health.getByRole('heading', { name: 'Здоровье', exact: true }).waitFor();
      await health.locator('[data-weight-history]').getByText('14,8 кг', { exact: false }).first().waitFor();
      await health.locator('[data-health-facts]').getByText('Вакцинация', { exact: true }).waitFor();
      if (await page.locator('.app-tabs button[data-route="profile"]').getAttribute('aria-current') !== 'page') throw new Error(`${engine}/${width}: Health is not anchored to the profile`);
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      if (geometry.document > geometry.viewport) throw new Error(`${engine}/${width}: horizontal overflow ${geometry.document}/${geometry.viewport}`);
      await page.screenshot({ path: `${outDir}/${engine}-${width}.png`, fullPage: false });

      await health.getByRole('button', { name: /^Добавить наблюдение/ }).click();
      await page.locator('[data-exact-view="observe"]').waitFor();
      await page.getByRole('heading', { name: /Как дела у/ }).waitFor();
      await page.getByRole('button', { name: 'Назад', exact: true }).click();
      await health.waitFor();

      await page.getByRole('button', { name: 'Назад', exact: true }).click();
      await page.locator('[data-exact-view="profile"]').waitFor();
      await page.locator('.app-tabs button[data-route="all"]').click({ force: true });
      await page.getByRole('heading', { name: 'Все разделы', exact: true }).waitFor();
      if (await page.getByRole('button', { name: /^Здоровье/ }).count()) throw new Error(`${engine}/${width}: Health leaked out of the integrated care/profile logic`);
      await page.getByRole('button', { name: /^Уход/ }).click();
      await page.locator('.cw').waitFor();
      await page.getByRole('heading', { name: 'Забота', exact: true }).waitFor();

      if (errors.length) throw new Error(`${engine}/${width}: page errors: ${errors.join('; ')}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

console.log('health + weight design smoke: ok (Profile Health, integrated All → Care, dates, weight, observation return; Chromium/WebKit 320/390)');
