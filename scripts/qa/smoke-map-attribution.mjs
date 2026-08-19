#!/usr/bin/env node
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3111';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const tileRequests = [];

page.on('request', (request) => {
  if (/tile|cartocdn|yandex/i.test(request.url())) tileRequests.push(request.url());
});

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('pso.topapp.onboarding.v1', 'done');
    localStorage.setItem('pso.product.profile.v5', JSON.stringify({
      dogName: 'Мята',
      breedId: 'mixed',
      breedGroupId: 'mixed',
      lifeStage: 'взрослая',
      size: 'средняя',
      selectedStyle: 'city',
      photos: [],
      isPublic: false,
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.app-tabs button[data-route="map"]').click();
  await page.locator('.leaflet-control-attribution').waitFor();
  await page.waitForTimeout(800);

  const attribution = await page.locator('.leaflet-control-attribution').innerHTML();
  const cartoRequests = tileRequests.filter((url) => url.includes('cartocdn.com'));
  const yandexRequests = tileRequests.filter((url) => /yandex/i.test(url));

  if (/leaflet-attribution-flag|#4C7BE1|#FFD500/i.test(attribution)) {
    throw new Error(`Leaflet flag remains in attribution: ${attribution}`);
  }
  if (!/OpenStreetMap contributors/i.test(attribution) || !/CARTO/i.test(attribution)) {
    throw new Error(`Provider attribution is incomplete: ${attribution}`);
  }
  if (!cartoRequests.length) throw new Error('No CARTO tile request was observed');
  if (yandexRequests.length) throw new Error(`Yandex requests observed: ${yandexRequests.join(', ')}`);

  console.log(JSON.stringify({ ok: true, base, cartoTiles: cartoRequests.length, yandexRequests: 0, attribution }));
} finally {
  await browser.close();
}
