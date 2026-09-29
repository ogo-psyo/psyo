import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:3117';
const outDir = process.env.OUT_DIR || '';
if (outDir) await mkdir(outDir, { recursive: true });
const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'актуально', socialMode: 'сначала спросить',
  energyLevel: 'активный', photos: [], selectedStyle: 'city', backendPetId: 'guest-category-search',
};

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const catalogRequests = [];
    let textSearchRequests = 0;
    await page.route('**/api/map/places?**', async route => {
      const url = new URL(route.request().url());
      catalogRequests.push(url);
      const [south, west, north, east] = url.searchParams.get('bounds').split(',').map(Number);
      const results = ['Рябиновый парк', 'Сквер им. Стрекалова', 'Парк у пруда'].map((title, index) => ({
        id: `osm-way-${index + 1}`, title, detail: 'Москва', category: 'парк', group: 'parks',
        point: { lat: south + (north - south) * (0.45 + index * 0.03), lng: west + (east - west) * (0.45 + index * 0.03) },
      }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results, bounds: { south, west, north, east }, category: url.searchParams.get('category'),
        total: results.length, truncated: false, updatedAt: '2026-09-29T00:00:00Z', source: 'OpenStreetMap',
        coverage: [{ id: 'central', title: 'Центральный федеральный округ' }],
      }) });
    });
    await page.route('**/api/map/search?**', async route => {
      textSearchRequests += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results: Array.from({ length: 6 }, (_, index) => ({
          id: `osm-node-${100 + index}`, title: 'Парк', detail: '', category: 'парк', kind: 'organization',
          point: { lat: 55.75 + index / 1000, lng: 37.61 + index / 1000 },
        })),
      }) });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(value => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(value));
    }, profile);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.app-tabs button[data-route="map"]').click({ force: true });
    await page.locator('[data-production-map-workspace]').waitFor();
    await page.locator('#production-map-search-input').focus();
    await page.locator('button.place-retry:not([disabled])').waitFor();
    await page.locator('#production-map-search-input').fill('Парки');
    await page.getByRole('button', { name: 'Найти', exact: true }).click();
    await page.waitForTimeout(300);

    assert.equal(textSearchRequests, 0, `${engine.name()}: category words must not use generic text search`);
    assert.equal(catalogRequests.length, 1, `${engine.name()}: category words must load the owned viewport catalog once`);
    assert.equal(catalogRequests[0].searchParams.get('category'), 'parks');
    await page.locator('.place-discovery-list').waitFor();
    await page.getByText('Рябиновый парк', { exact: true }).waitFor();
    assert.equal(await page.getByText('В пределах 3 км от центра карты').count(), 0);
    const panelBox = await page.locator('.map-refresh-panel').boundingBox();
    const firstResultBox = await page.locator('.place-discovery-list li').first().boundingBox();
    assert.ok(panelBox && firstResultBox && firstResultBox.y < panelBox.y + panelBox.height - 44,
      `${engine.name()}: at least the first useful result must be visible without scrolling`);
    if (outDir) await page.screenshot({ path: `${outDir}/${engine.name()}-parks.png`, fullPage: false });
    console.log(`${engine.name()}: category query uses named viewport catalog results`);
    await context.close();
  } finally {
    await browser.close();
  }
}
