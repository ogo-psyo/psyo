import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const outDir = process.env.OUT_DIR || '';
const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить',
  energyLevel: 'активный', photos: [], selectedStyle: 'city', backendPetId: 'guest-map-workspace',
};

async function openMap(page) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate((storedProfile) => {
    localStorage.setItem('pso.topapp.onboarding.v1', 'done');
    localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
  }, profile);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.app-tabs button[data-route="map"]').click({ force: true });
  await page.locator('[data-production-map-workspace]').waitFor();
    await page.locator('.leaflet-container').waitFor({ timeout: 10000 });
    if (await page.locator('.leaflet-container').getAttribute('aria-label') === null) throw new Error('map is missing an accessible name');
}

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, geolocation: { latitude: 55.744, longitude: 37.603 }, permissions: ['geolocation'] });
    const page = await context.newPage();
    await openMap(page);

    const geometry = await page.evaluate(() => {
      const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
      const workspace = rect('[data-production-map-workspace]');
      const map = rect('.live-map-frame');
      const sheet = rect('[data-map-snap-sheet]');
      const nav = rect('.app-tabs');
      const attribution = document.querySelector('.leaflet-control-attribution');
      return {
        workspace: workspace && { height: workspace.height },
        map: map && { height: map.height },
        sheet: sheet && { left: sheet.left, right: sheet.right, bottom: sheet.bottom },
        nav: nav && { top: nav.top },
        attribution: attribution && { clientWidth: attribution.clientWidth, scrollWidth: attribution.scrollWidth, text: attribution.textContent },
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    if (!geometry.workspace || !geometry.map || Math.abs(geometry.workspace.height - geometry.map.height) > 1) throw new Error(`${width}: map is not full height`);
    if (geometry.overflow) throw new Error(`${width}: horizontal overflow`);
    if (!geometry.sheet || geometry.sheet.left < 8 || geometry.sheet.right > width - 8) throw new Error(`${width}: sheet escaped viewport`);
    if (!geometry.nav || geometry.sheet.bottom > geometry.nav.top + 1) throw new Error(`${width}: home sheet collides with navigation`);
    if (!geometry.attribution?.text?.includes('OpenStreetMap') || !geometry.attribution.text.includes('CARTO')) throw new Error(`${width}: full attribution is missing`);
    if (geometry.attribution.scrollWidth > geometry.attribution.clientWidth + 2) throw new Error(`${width}: attribution is clipped`);

    await page.getByRole('button', { name: /Начать прогулку/ }).waitFor();
    await page.getByRole('button', { name: /Построить заранее/ }).waitFor();
    await page.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 8000 }).catch(() => {});
    if (outDir) await page.screenshot({ path: `${outDir}/map-home-${width}.png`, fullPage: false });

    await page.locator('[data-route-action="start"]').click();
    await page.locator('[data-route-flow="recording"]').waitFor();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('pso.map.active-route.v1') || '{}').points?.length >= 1);
    const beforeDiscardContinue = await page.evaluate(() => JSON.parse(localStorage.getItem('pso.map.active-route.v1') || '{}').points.length);
    await page.getByRole('button', { name: 'Отменить', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor();
    const focusedInDialog = await page.evaluate(() => Boolean(document.activeElement?.closest('[role="alertdialog"]')));
    if (!focusedInDialog) throw new Error(`${width}: discard dialog did not receive focus`);
    await page.getByRole('button', { name: 'Продолжить маршрут' }).click();
    await context.setGeolocation({ latitude: 55.74425, longitude: 37.60325 });
    await page.waitForFunction((before) => JSON.parse(localStorage.getItem('pso.map.active-route.v1') || '{}').points?.length > before, beforeDiscardContinue);
    if (await page.locator('.app-tabs').isVisible()) throw new Error(`${width}: navigation remains visible during recording`);
    if (outDir) await page.screenshot({ path: `${outDir}/map-recording-${width}.png`, fullPage: false });
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await page.locator('[data-route-flow="paused"]').waitFor();
    await context.setGeolocation({ latitude: 55.7442, longitude: 37.6032 });
    await page.getByRole('button', { name: /Продолжить/ }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('pso.map.active-route.v1') || '{}').points?.length >= 2);
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await page.getByRole('button', { name: /Завершить/ }).click();
    await page.locator('[data-route-flow="record-review"]').waitFor();
    await page.waitForFunction(() => {
      const mapRect = document.querySelector('.leaflet-container')?.getBoundingClientRect();
      const routeRect = document.querySelector('.leaflet-overlay-pane path[stroke="#3df881"]')?.getBoundingClientRect();
      return Boolean(mapRect && routeRect && routeRect.left >= mapRect.left - 12 && routeRect.right <= mapRect.right + 12 && routeRect.top >= mapRect.top - 12 && routeRect.bottom <= mapRect.bottom + 12);
    }, undefined, { timeout: 2_000 }).catch(() => { throw new Error(`${width}: completed route is not fitted into the review map`); });
    if (outDir) await page.screenshot({ path: `${outDir}/map-walk-review-${width}.png`, fullPage: false });
    if (width === 390) {
      await page.getByRole('button', { name: 'Сохранить лично', exact: true }).click();
      await page.locator('[data-route-flow="idle"]').waitFor();
      await page.getByRole('button', { name: /Сохранённое на карте/ }).click();
      await page.locator('.production-map-saved-row.route p').getByText(/мин/).waitFor();
      await page.getByRole('button', { name: /Сохранённое на карте/ }).click();
    } else {
      await page.locator('[data-route-flow="record-review"]').getByRole('button', { name: 'Отменить', exact: true }).click();
      await page.getByRole('button', { name: 'Удалить черновик' }).click();
    }
    await page.locator('[data-route-flow="idle"]').waitFor();

    await page.locator('[data-route-action="plan"]').click();
    await page.locator('[data-route-flow="planning"]').waitFor();
    const map = page.locator('.leaflet-container');
    await map.focus();
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('button', { name: 'Добавить точку', exact: true }).click();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Добавить точку', exact: true }).click();
    await page.getByText(/2 точ/).waitFor();
    if (outDir) await page.screenshot({ path: `${outDir}/map-planning-${width}.png`, fullPage: false });
    await page.getByRole('button', { name: 'Готово', exact: true }).click();
    await page.locator('[data-route-flow="plan-review"]').waitFor();
    await page.getByRole('button', { name: 'Сохранить лично', exact: true }).click();
    await page.locator('[data-route-flow="idle"]').waitFor();
    await page.getByText('Маршрут сохранён. Он появился на карте.').waitFor();

    await page.locator('[data-route-action="risk"]').click();
    await page.getByRole('button', { name: 'По ссылке' }).click();
    if (await page.getByRole('button', { name: 'По ссылке' }).getAttribute('aria-pressed') !== 'true') throw new Error(`${width}: share privacy choice did not activate`);
    await page.locator('.risk-sheet .production-map-simple-heading').getByRole('button', { name: 'Отменить', exact: true }).click();
    await page.locator('[data-route-action="risk"]').click();
    if (await page.getByRole('button', { name: 'Только мне' }).getAttribute('aria-pressed') !== 'true') throw new Error(`${width}: privacy did not reset to private`);
    await map.click({ position: { x: 170, y: 220 } });
    await page.getByText('Примерное место выбрано', { exact: true }).waitFor();
    await page.locator('.risk-sheet .production-map-simple-heading').getByRole('button', { name: 'Отменить', exact: true }).click();
    await context.close();
  }

  const restoreContext = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 55.744, longitude: 37.603 }, permissions: ['geolocation'] });
  const restorePage = await restoreContext.newPage();
  await openMap(restorePage);
  await restorePage.locator('[data-route-action="start"]').click();
  await restorePage.locator('[data-route-flow="recording"]').waitFor();
  await restorePage.waitForFunction(() => JSON.parse(localStorage.getItem('pso.map.active-route.v1') || '{}').points?.length >= 1);
  await restorePage.waitForTimeout(1100);
  await restorePage.reload({ waitUntil: 'networkidle' });
  await restorePage.locator('[data-route-flow="paused"]').waitFor();
  await restorePage.getByText('Прогулка восстановлена и поставлена на паузу.').waitFor();
  await restorePage.getByRole('button', { name: 'Отменить', exact: true }).click();
  await restorePage.getByRole('button', { name: 'Удалить черновик' }).click();
  await restoreContext.close();

  const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const deniedPage = await deniedContext.newPage();
  await openMap(deniedPage);
  await deniedPage.locator('[data-route-action="start"]').click();
  await deniedPage.locator('[data-route-flow="gps-error"]').waitFor();
  await deniedPage.getByRole('button', { name: 'Попробовать снова' }).waitFor();
  await deniedPage.getByRole('button', { name: 'Построить заранее' }).waitFor();
  await deniedContext.close();

  console.log('map workspace smoke: ok (two route scenarios, 320, 390)');
} finally {
  await browser.close();
}
