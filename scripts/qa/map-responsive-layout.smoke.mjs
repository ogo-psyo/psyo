import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const outDir = process.env.OUT_DIR || '';
const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить',
  energyLevel: 'активный', photos: [], selectedStyle: 'city', backendPetId: 'guest-map-layout',
};

async function openMap(page) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate((storedProfile) => {
    localStorage.setItem('pso.topapp.onboarding.v1', 'done');
    localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
  }, profile);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.app-tabs button[data-route="map"]').click({ force: true });
  await page.locator('[data-production-map-workspace]').waitFor();
}

async function assertAnchoredActions(page, label) {
  const geometry = await page.evaluate(() => {
    const controller = document.querySelector('[data-route-controller]')?.getBoundingClientRect();
    const body = document.querySelector('[data-route-controller-body]')?.getBoundingClientRect();
    const actions = document.querySelector('[data-route-controller-actions]')?.getBoundingClientRect();
    const navigation = document.querySelector('.app-tabs');
    const buttons = [...document.querySelectorAll('[data-route-controller-actions] button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
    });
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      controller: controller && { top: controller.top, right: controller.right, bottom: controller.bottom, left: controller.left },
      body: body && { top: body.top, bottom: body.bottom, scrollHeight: body.scrollHeight, clientHeight: body.clientHeight },
      actions: actions && { top: actions.top, right: actions.right, bottom: actions.bottom, left: actions.left },
      navigation: navigation ? { visible: getComputedStyle(navigation).visibility !== 'hidden', top: navigation.getBoundingClientRect().top } : null,
      buttons,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  if (geometry.overflow || !geometry.controller || !geometry.body || !geometry.actions || !geometry.buttons.length) throw new Error(`${label}: route layout is incomplete`);
  if (geometry.controller.left < 8 || geometry.controller.right > geometry.viewport.width - 8 || geometry.controller.top < 8 || geometry.controller.bottom > geometry.viewport.height - 8) throw new Error(`${label}: route controller escaped viewport`);
  if (geometry.body.bottom > geometry.actions.top + 1) throw new Error(`${label}: scroll body overlaps anchored actions`);
  if (geometry.buttons.some((button) => button.left < geometry.actions.left || button.right > geometry.actions.right || button.top < geometry.actions.top || button.bottom > geometry.actions.bottom)) throw new Error(`${label}: action escaped its anchored row`);
  if (geometry.viewport.width < 760 && geometry.navigation) throw new Error(`${label}: mobile navigation must be removed while route controls are active`);
  if (geometry.viewport.width < 760 && geometry.navigation?.visible && geometry.actions.bottom > geometry.navigation.top) throw new Error(`${label}: route actions overlap navigation`);
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 390, height: 844, label: 'portrait' }, { width: 844, height: 390, label: 'landscape' }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await openMap(page);
    await page.locator('[data-route-action="plan"]').click();
    await page.locator('[data-route-flow="planning"]').waitFor();
    await assertAnchoredActions(page, viewport.label);
    if (viewport.label === 'landscape') {
      const sideSheet = await page.evaluate(() => {
        const rect = document.querySelector('[data-route-controller]')?.getBoundingClientRect();
        return rect && { width: rect.width, left: rect.left };
      });
      if (!sideSheet || sideSheet.width > viewport.width * 0.5 || sideSheet.left < viewport.width * 0.5) throw new Error('landscape: controller did not become a side sheet');
    }
    if (outDir) await page.screenshot({ path: `${outDir}/map-route-${viewport.label}.png`, fullPage: false });
    await context.close();
  }

  const keyboardContext = await browser.newContext({ viewport: { width: 390, height: 500 } });
  const keyboardPage = await keyboardContext.newPage();
  await keyboardPage.route('**/api/map/search?**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ results: [{ id: 'vet-1', title: 'Ветклиника рядом', detail: 'Москва', category: 'ветклиника', kind: 'organization', point: { lat: 55.761, lng: 37.61 } }] }),
  }));
  await openMap(keyboardPage);
  const search = keyboardPage.getByRole('combobox', { name: 'Найти организацию, место или маршрут' });
  await search.focus();
  await search.fill('ветклиника');
  await keyboardPage.getByRole('option', { name: /Ветклиника рядом/ }).waitFor();
  const keyboardGeometry = await keyboardPage.evaluate(() => {
    const results = document.querySelector('.production-map-search-results')?.getBoundingClientRect();
    const home = document.querySelector('.home-sheet');
    return {
      results: results && { top: results.top, right: results.right, bottom: results.bottom, left: results.left },
      homeVisibility: home ? getComputedStyle(home).visibility : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  if (!keyboardGeometry.results || keyboardGeometry.results.left < 8 || keyboardGeometry.results.right > keyboardGeometry.viewport.width - 8 || keyboardGeometry.results.bottom > keyboardGeometry.viewport.height - 8) throw new Error('keyboard: search results escaped the reduced viewport');
  if (keyboardGeometry.homeVisibility !== 'hidden') throw new Error('keyboard: map actions still compete with focused search');
  if (outDir) await keyboardPage.screenshot({ path: `${outDir}/map-search-keyboard.png`, fullPage: false });

  await keyboardPage.getByRole('option', { name: /Ветклиника рядом/ }).click();
  await keyboardPage.locator('[data-route-action="risk"]').click();
  if (await keyboardPage.locator('.app-tabs').count()) throw new Error('keyboard: mobile navigation must be removed while the risk form is active');
  await keyboardPage.getByRole('textbox', { name: /Название/ }).focus();
  const riskActions = keyboardPage.locator('.risk-sheet .production-map-composer-actions');
  await riskActions.scrollIntoViewIfNeeded();
  const riskGeometry = await riskActions.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const sheet = element.closest('[data-map-snap-sheet]')?.getBoundingClientRect();
    const navigation = document.querySelector('.app-tabs');
    return { top: rect.top, bottom: rect.bottom, sheetTop: sheet?.top, sheetBottom: sheet?.bottom, viewportHeight: window.innerHeight, navigationPresent: Boolean(navigation) };
  });
  if (riskGeometry.navigationPresent) throw new Error('keyboard: navigation remounted behind the risk form');
  if (riskGeometry.sheetTop === undefined || riskGeometry.sheetBottom === undefined || riskGeometry.top < riskGeometry.sheetTop || riskGeometry.bottom > Math.min(riskGeometry.sheetBottom, riskGeometry.viewportHeight)) throw new Error('keyboard: form actions are not reachable inside the sheet');
  if (outDir) await keyboardPage.screenshot({ path: `${outDir}/map-risk-keyboard.png`, fullPage: false });
  await keyboardContext.close();

  console.log('map responsive layout smoke: ok (portrait, landscape, keyboard-sized viewport)');
} finally {
  await browser.close();
}
