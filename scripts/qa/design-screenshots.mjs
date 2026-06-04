import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const outDir = process.env.OUT_DIR || 'test-results/design-audit';
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const sizes = [
  { name: 'mobile-360', width: 360, height: 900 },
  { name: 'mobile-390', width: 390, height: 1000 },
  { name: 'mobile-430', width: 430, height: 1000 },
  { name: 'tablet-768', width: 768, height: 1100 },
  { name: 'desktop-1280', width: 1280, height: 1000 },
];
const results = [];
for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${outDir}/${size.name}.png`, fullPage: true });
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const overflowEls = [...document.querySelectorAll('body *')].map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { tag: el.tagName, cls: el.className?.toString?.() || '', text: (el.textContent || '').trim().slice(0,80), left: r.left, right: r.right, width: r.width, display: cs.display, position: cs.position };
    }).filter((x) => x.width > 1 && (x.left < -1 || x.right > window.innerWidth + 1));
    const tinyTapTargets = [...document.querySelectorAll('button,a,input,textarea,select')].map((el) => {
      const r = el.getBoundingClientRect();
      return { tag: el.tagName, cls: el.className?.toString?.() || '', text: (el.textContent || el.getAttribute('placeholder') || '').trim().slice(0,60), w: r.width, h: r.height };
    }).filter((x) => x.w > 0 && x.h > 0 && (x.w < 44 || x.h < 44));
    return { innerWidth: window.innerWidth, scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth), overflowEls: overflowEls.slice(0,20), tinyTapTargets: tinyTapTargets.slice(0,20) };
  });
  results.push({ size, metrics });
  await page.close();
}
await browser.close();
await fs.writeFile(`${outDir}/metrics.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
