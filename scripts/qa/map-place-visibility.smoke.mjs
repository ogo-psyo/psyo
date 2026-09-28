import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'актуально', socialMode: 'сначала спросить',
  energyLevel: 'активный', photos: [], selectedStyle: 'city', backendPetId: 'guest-place-visibility',
};

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    let requests = 0;
    await page.route('**/api/map/places?**', async route => {
      requests += 1;
      const url = new URL(route.request().url());
      const [south, west, north, east] = url.searchParams.get('bounds').split(',').map(Number);
      const results = Array.from({ length: 80 }, (_, index) => ({
        id: `osm-node-${index + 1}`, title: `Место ${index + 1}`, detail: '', category: 'парк', group: 'parks',
        point: { lat: south + (north - south) * (0.25 + (index % 8) / 16), lng: west + (east - west) * (0.25 + (index % 10) / 20) },
      }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results, bounds: { south, west, north, east }, category: url.searchParams.get('category') || 'all',
        total: results.length, truncated: false, updatedAt: '2026-09-28T00:00:00Z', source: 'OpenStreetMap',
        coverage: [{ id: 'test-region', title: 'Контрольный регион' }],
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
    await page.waitForTimeout(500);
    assert.equal(requests, 0, `${engine.name()}: opening the map must not load or pin the public catalog`);

    await page.locator('#production-map-search-input').focus();
    await page.waitForTimeout(100);
    assert.equal(requests, 0, `${engine.name()}: opening place tools must remain explicit`);
    await page.getByRole('button', { name: 'Показать места в этой области' }).click();
    await page.locator('.place-discovery-list').waitFor();
    assert.equal(requests, 1, `${engine.name()}: explicit place request must load once`);

    const map = page.locator('.leaflet-container');
    await map.focus();
    await page.keyboard.press('ArrowRight');
    await page.locator('.place-area-change').waitFor();
    assert.equal(await page.locator('.place-discovery-list').count(), 0, `${engine.name()}: moved map must not retain old local places`);
    console.log(`${engine.name()}: explicit places only; stale viewport cleared`);
    await context.close();
  } finally {
    await browser.close();
  }
}
