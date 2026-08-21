import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3101';
const outDir = process.env.OUT_DIR || 'artifacts/pso-production-journey-visual';
await fs.mkdir(outDir, { recursive: true });

const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить',
  energyLevel: 'активный', temperament: 'нежная, любопытная', triggers: 'самокаты, резкий шум',
  neighborhood: 'Сокол', photos: [], selectedStyle: 'city', bio: 'Любит долгие прогулки.',
  backendPetId: 'guest-pet-production-journey', isPublic: false,
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate((storedProfile) => {
    localStorage.setItem('pso.topapp.onboarding.v1', 'done');
    localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
  }, profile);
  await page.reload({ waitUntil: 'networkidle' });

  const routes = ['today', 'profile', 'map', 'nearby', 'things'];
  const metrics = [];
  for (const route of routes) {
    await page.locator(`.app-tabs button[data-route="${route}"]`).click({ force: true });
    const screen = page.locator(`[data-production-journey="${route}"]`);
    await screen.waitFor();
    if (route === 'map') await page.locator('.leaflet-container').waitFor();
    await page.waitForTimeout(route === 'map' ? 1200 : 240);
    const result = await page.evaluate((activeRoute) => {
      const root = document.documentElement;
      const navLabels = [...document.querySelectorAll('.app-tabs .ui-button-content > span:last-child')].map((node) => {
        const rect = node.getBoundingClientRect();
        return { text: node.textContent?.trim(), height: rect.height, lineHeight: Number.parseFloat(getComputedStyle(node).lineHeight) || rect.height };
      });
      return {
        route: activeRoute,
        viewport: window.innerWidth,
        scrollWidth: root.scrollWidth,
        navLabels,
        authVisible: Boolean(document.querySelector('.auth-inline-panel') && getComputedStyle(document.querySelector('.auth-inline-panel')).display !== 'none'),
      };
    }, route);
    if (result.scrollWidth > result.viewport) throw new Error(`${route}: horizontal overflow ${result.scrollWidth}/${result.viewport}`);
    if (result.authVisible) throw new Error(`${route}: auth panel overlaps journey header`);
    if (result.navLabels.some((label) => label.height > label.lineHeight * 1.5)) throw new Error(`${route}: wrapped nav label`);
    metrics.push(result);
    await page.screenshot({ path: `${outDir}/${route}.png`, fullPage: false });
  }

  await page.getByRole('button', { name: 'Спросить Псё', exact: true }).click({ force: true });
  await page.getByRole('dialog', { name: 'Спросить Псё' }).waitFor();
  await page.screenshot({ path: `${outDir}/assistant.png`, fullPage: false });
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click({ force: true });

  await page.locator('.app-tabs button[data-route="profile"]').click({ force: true });
  await page.locator('[data-profile-journey-action="add-document"]').click({ force: true });
  await page.locator('.profile-life-document-form').waitFor();
  await page.screenshot({ path: `${outDir}/profile-document.png`, fullPage: false });
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click({ force: true });
  await page.getByRole('button', { name: 'Изменить', exact: true }).click({ force: true });
  await page.locator('.profile-ux-2025').waitFor();
  await page.locator('.app-tabs button[data-route="map"]').click({ force: true });
  await page.getByRole('button', { name: 'Все', exact: true }).click({ force: true });
  await page.locator('.places-composition').waitFor();
  await page.locator('.app-tabs button[data-route="nearby"]').click({ force: true });
  await page.getByRole('button', { name: /Гав/, exact: true }).last().click({ force: true });
  await page.locator('.production-woof-workspace').waitFor();
  await page.locator('.app-tabs button[data-route="things"]').click({ force: true });
  await page.getByRole('button', { name: /Добавить/, exact: false }).first().click({ force: true });
  await page.locator('.things-composition').waitFor();

  console.log(JSON.stringify({ ok: true, routes: metrics, assistant: true, detailFlows: true }, null, 2));
} finally {
  await browser.close();
}
