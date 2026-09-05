import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3102';
const outDir = process.env.OUT_DIR || 'artifacts/pso-all-screen';
await fs.mkdir(outDir, { recursive: true });

const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', age: '4 года', sex: 'девочка',
  size: 'средняя', energyLevel: 'активная', neighborhood: 'Сокол', photos: [], selectedStyle: 'city',
  backendPetId: 'guest-pet-all-screen', isPublic: false,
};
const observations = [
  { id: 'o1', createdAt: '2026-08-25T09:00:00.000Z', mood: 'спокойное', appetite: 'обычный', stool: 'обычный', energy: 'как обычно' },
  { id: 'o2', createdAt: '2026-08-28T09:00:00.000Z', mood: 'тревожное', appetite: 'меньше', stool: 'мягкий', energy: 'ниже' },
  { id: 'o3', createdAt: '2026-09-01T09:00:00.000Z', mood: 'радостное', appetite: 'хороший', stool: 'обычный', energy: 'бодрая' },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 320, height: 720, name: 'narrow' }, { width: 390, height: 844, name: 'mobile' }, { width: 1280, height: 900, name: 'desktop' }]) {
    const page = await browser.newPage({ viewport });
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
    await page.goto(base, { waitUntil: 'networkidle' });

    const persisted = await page.evaluate(() => ({
      profile: JSON.parse(localStorage.getItem('pso.product.profile.v5') || '{}'),
      observationKeys: Object.keys(localStorage).filter((key) => key.startsWith('pso.topapp.observations.v2:')),
    }));
    if (!persisted.profile.backendPetId) throw new Error('guest profile lost its pet id during bootstrap');
    const activeObservationKey = `pso.topapp.observations.v2:${persisted.profile.backendPetId}`;
    await page.evaluate(({ key, storedObservations }) => localStorage.setItem(key, JSON.stringify(storedObservations)), { key: activeObservationKey, storedObservations: observations });
    await page.reload({ waitUntil: 'networkidle' });

    const screen = page.locator('[data-production-journey="today"]');
    await screen.waitFor();
    const ordered = await screen.locator('[data-home-today], [data-home-secondary], [data-home-scenarios], [data-home-snapshot]').evaluateAll((nodes) => nodes.map((node) => node.hasAttribute('data-home-today') ? 'today' : node.hasAttribute('data-home-secondary') ? 'secondary' : node.hasAttribute('data-home-scenarios') ? 'scenarios' : 'snapshot'));
    if (ordered.join(',') !== 'today,secondary,scenarios,snapshot') throw new Error(`wrong home hierarchy: ${ordered.join(',')}`);
    if (!await page.getByRole('heading', { name: /Как Мята сегодня/ }).isVisible()) throw new Error('personalized today heading is missing');
    if (await page.locator('[data-home-primary]').count() !== 1) throw new Error('home must expose exactly one primary check-in action');
    if (await page.locator('[data-home-secondary] > button').count() !== 2) throw new Error('home must expose exactly two secondary actions');
    await page.locator('[data-home-primary]').click();
    const observationCapture = page.locator('[data-home-capture] .voice-observation-capture');
    await observationCapture.waitFor();
    await page.getByRole('button', { name: 'Записать голосом' }).waitFor();
    const navigationState = await page.evaluate(() => ({
      capture: Boolean(document.querySelector('[data-home-capture]')),
      bodyHasCapture: document.body.matches(':has([data-home-capture])'),
      display: document.querySelector('.app-tabs') ? getComputedStyle(document.querySelector('.app-tabs')).display : 'none',
    }));
    if (navigationState.display !== 'none') throw new Error(`navigation overlaps the expanded observation input: ${JSON.stringify(navigationState)}`);
    const observationInputGeometry = await page.evaluate(() => {
      const section = document.querySelector('[data-production-home]')?.getBoundingClientRect();
      const capture = document.querySelector('[data-home-capture]')?.getBoundingClientRect();
      return { section, capture };
    });
    if (!observationInputGeometry.section || !observationInputGeometry.capture) throw new Error('observation input layout is incomplete');
    if (observationInputGeometry.capture.top < observationInputGeometry.section.top || observationInputGeometry.capture.left < observationInputGeometry.section.left || observationInputGeometry.capture.right > observationInputGeometry.section.right) throw new Error('voice capture escaped the observation input section');
    await observationCapture.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${outDir}/${viewport.name}-observation-input.png`, fullPage: false });
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (layout.scrollWidth > layout.width) throw new Error(`horizontal overflow ${layout.scrollWidth}/${layout.width}`);

    await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.getByRole('button', { name: /Изменилось самочувствие/ }).click();
    await page.locator('[data-home-scenarios] article').waitFor();
    await page.locator('[data-home-scenarios]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${outDir}/${viewport.name}-scenario.png`, fullPage: false });
    await page.getByRole('button', { name: /Записать наблюдение/ }).click();
    await page.locator('[data-home-capture] .voice-observation-capture').waitFor();
    await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await page.getByRole('button', { name: /Найти компанию на прогулку/ }).click();
    await page.locator('[data-home-scenarios] article').waitFor();
    const scenarioButtons = page.locator('[data-home-scenarios] > div > button');
    if (await scenarioButtons.count() !== 4) throw new Error('expected four guided scenarios including Gav');
    const scenarioGeometry = await scenarioButtons.evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }));
    if (scenarioGeometry.some(({ width, height }) => width < 260 || height < 44)) throw new Error(`scenario list is too cramped: ${JSON.stringify(scenarioGeometry)}`);
    await page.screenshot({ path: `${outDir}/${viewport.name}-gav-scenario.png`, fullPage: false });
    await page.getByRole('button', { name: 'Открыть карту «Гав»', exact: true }).click();
    await page.locator('[data-production-journey="nearby"]').waitFor();
    await page.locator('.app-tabs button[data-route="today"]').click({ force: true });
    await screen.waitFor();
    await page.getByRole('button', { name: /Открыть профиль Мята/ }).click();
    await page.locator('[data-profile-memory]').waitFor();
    await page.locator('.app-tabs button[data-route="today"]').click({ force: true });
    await screen.waitFor();
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${outDir}/${viewport.name}.png`, fullPage: false });
    if (viewport.name === 'mobile') {
      await page.locator('[data-home-snapshot]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${outDir}/mobile-trends.png`, fullPage: false });
    }
    await page.close();
  }
  console.log(JSON.stringify({ ok: true, hierarchy: ['today', 'secondary', 'scenarios', 'snapshot'], primaryActions: 1, secondaryActions: 2, scenarioWorkspace: true, scenarioCapture: true, profileNavigation: true }, null, 2));
} finally {
  await browser.close();
}
