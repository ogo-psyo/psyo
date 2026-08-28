import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3000';
const outDir = process.env.OUT_DIR || 'artifacts/reference-kit-deep';
await fs.mkdir(outDir, { recursive: true });

const flows = [
  { name: 'health', button: /Здоровье/, ready: '.health-screen' },
  { name: 'plan', button: /План заботы/, ready: '.calendar-composition' },
  { name: 'habits', button: /Повторяемые привычки/, ready: '.habit-screen' },
  { name: 'settings', button: /Настройки и приватность/, ready: '.profile-settings-screen' },
  { name: 'public-card', button: /Памятка/, ready: '.public-card-screen' },
];

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ name: 'm390', width: 390, height: 844 }, { name: 'd1280', width: 1280, height: 900 }]) {
    for (const flow of flows) {
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(10_000);
      await page.goto(`${base}?demo=1`, { waitUntil: 'domcontentloaded' });
      await page.locator('.app-tabs button[data-route="profile"]').waitFor({ state: 'attached' });
      await page.locator('.app-tabs button[data-route="profile"]').click({ force: true });
      await page.locator('[data-profile-memory]').waitFor();
      const trigger = page.getByRole('button', { name: flow.button }).first();
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click({ force: true });
      await page.locator(flow.ready).waitFor();
      await page.waitForTimeout(300);
      const metrics = await page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      await page.screenshot({ path: `${outDir}/${viewport.name}-${flow.name}.png`, fullPage: false });
      results.push({ viewport: viewport.name, flow: flow.name, ...metrics });
      await page.close();
    }
  }
} finally {
  await browser.close();
}

const failures = results.filter((item) => item.scrollWidth > item.innerWidth);
await fs.writeFile(`${outDir}/metrics.json`, JSON.stringify(results, null, 2));
if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, screens: results.length }, null, 2));
