import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const outDir = process.env.OUT_DIR || 'artifacts/reference-kit-screenshots';
await fs.mkdir(outDir, { recursive: true });

const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить',
  energyLevel: 'активная', temperament: 'нежная, любопытная', triggers: 'самокаты, резкий шум',
  neighborhood: 'Сокол', photos: [], selectedStyle: 'city', bio: 'Любит долгие прогулки.',
  backendPetId: 'guest-reference-kit', isPublic: false,
};

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ name: 'm390', width: 390, height: 844 }, { name: 'd1280', width: 1280, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(8_000);
    await page.goto(`${base}?demo=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_500);
    if (await page.locator('.app-tabs').count() === 0) {
      throw new Error(`${viewport.name}: demo mode did not render navigation`);
    }

    for (const route of ['today', 'profile', 'map', 'nearby', 'things']) {
      await page.locator(`.app-tabs button[data-route="${route}"]`).click({ force: true });
      await page.waitForTimeout(route === 'map' ? 1_200 : 350);
      const metrics = await page.evaluate(() => ({
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        active: document.querySelector('.app-tabs [aria-current="page"]')?.getAttribute('data-route') || '',
        bodyOverflow: getComputedStyle(document.body).overflowX,
      }));
      await page.screenshot({ path: `${outDir}/${viewport.name}-${route}.png`, fullPage: false });
      results.push({ viewport: viewport.name, route, ...metrics });
    }
    await page.close();
  }
} finally {
  await browser.close();
}

const failures = results.filter((result) => result.scrollWidth > result.innerWidth || result.active !== result.route);
await fs.writeFile(`${outDir}/metrics.json`, JSON.stringify(results, null, 2));
if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, screens: results.length }, null, 2));
