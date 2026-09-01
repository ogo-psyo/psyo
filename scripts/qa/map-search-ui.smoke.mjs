import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const outDir = process.env.OUT_DIR || '';
const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить',
  energyLevel: 'активный', photos: [], selectedStyle: 'city', backendPetId: 'guest-map-search',
};

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 844 } });
    const page = await context.newPage();
    await page.route('**/api/map/search?**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [{ id: 'osm-vet-1', title: 'Ветклиника Айболит', detail: 'Тверская улица, Москва', category: 'ветклиника', kind: 'organization', point: { lat: 55.761, lng: 37.61 } }] }),
    }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate((storedProfile) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
    }, profile);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.app-tabs button[data-route="map"]').click({ force: true });
    await page.locator('[data-production-map-workspace]').waitFor();

    const search = page.getByRole('combobox', { name: 'Найти организацию, место или маршрут' });
    await search.fill('ветклиника');
    const result = page.getByRole('option', { name: /Ветклиника Айболит/ });
    await result.waitFor();
    const openState = await page.evaluate(() => {
      const workspace = document.querySelector('[data-production-map-workspace]')?.getBoundingClientRect();
      const searchPanel = document.querySelector('.production-map-search-results')?.getBoundingClientRect();
      const actionPanel = document.querySelector('[data-map-snap-sheet]')?.getBoundingClientRect();
      return {
        workspace: workspace && { width: workspace.width, height: workspace.height },
        searchPanel: searchPanel && { left: searchPanel.left, right: searchPanel.right, bottom: searchPanel.bottom },
        actionPanel: actionPanel && { top: actionPanel.top },
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    if (openState.overflow || !openState.searchPanel || !openState.actionPanel) throw new Error(`${width}: search layout is incomplete`);
    if (openState.searchPanel.left < 8 || openState.searchPanel.right > width - 8) throw new Error(`${width}: search results escaped viewport`);
    if (openState.searchPanel.bottom > openState.actionPanel.top) throw new Error(`${width}: search results collide with map actions`);

    await result.click();
    await page.getByText('Показываю «Ветклиника Айболит».').waitFor();
    await page.locator('.leaflet-overlay-pane path[fill="#07814d"]').waitFor();
    if (outDir) await page.screenshot({ path: `${outDir}/map-search-${width}.png`, fullPage: false });
    await context.close();
  }
  console.log('map search UI smoke: ok (organizations, marker, 320, 390, 1280)');
} finally {
  await browser.close();
}
