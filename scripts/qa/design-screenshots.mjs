import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3101';
const outDir = process.env.OUT_DIR || 'test-results/design-audit';
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const sizes = [
  { name: 'mobile-360', width: 360, height: 800 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 1000 },
  { name: 'tablet-768', width: 768, height: 1100 },
  { name: 'ipad-portrait-820', width: 820, height: 1180 },
  { name: 'ipad-landscape-1180', width: 1180, height: 820 },
  { name: 'desktop-1280', width: 1280, height: 1000 },
];
const results = [];
for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: 'networkidle' });
  // The dev server can finish network activity before React attaches delegated events.
  // Give hydration a brief deterministic window before exercising onboarding actions.
  await page.waitForTimeout(750);
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
    const onboardingCanvas = document.querySelector('.onboarding-canvas');
    const onboardingShell = document.querySelector('.onboarding-shell');
    const shellRect = onboardingShell?.getBoundingClientRect();
    return {
      innerWidth: window.innerWidth,
      scrollWidth: Math.max(doc.scrollWidth, body.scrollWidth),
      overflowEls: overflowEls.slice(0,20),
      tinyTapTargets: tinyTapTargets.slice(0,20),
      onboardingCoverage: onboardingCanvas && shellRect ? shellRect.width / window.innerWidth : null,
    };
  });
  results.push({ size, metrics });
  if (size.name === 'mobile-390' || size.name === 'ipad-portrait-820') {
    await page.getByRole('button', { name: 'Создать питомца', exact: true }).click();
    await page.getByText('шаг 1 из 2', { exact: true }).waitFor();
    await page.screenshot({ path: `${outDir}/${size.name}-pet.png`, fullPage: true });
    await page.getByLabel('Имя', { exact: true }).fill('Мята');
    await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.screenshot({ path: `${outDir}/${size.name}-care.png`, fullPage: true });
  }
  await page.close();
}
await browser.close();
await fs.writeFile(`${outDir}/metrics.json`, JSON.stringify(results, null, 2));
const failures = results.flatMap((result) => {
  const items = [];
  if (result.metrics.scrollWidth > result.metrics.innerWidth) {
    items.push({ size: result.size.name, issue: 'document overflow', metrics: result.metrics });
  }
  if (result.metrics.overflowEls.length) {
    items.push({ size: result.size.name, issue: 'element overflow', elements: result.metrics.overflowEls });
  }
  if (result.metrics.tinyTapTargets.length) {
    items.push({ size: result.size.name, issue: 'tiny tap targets', elements: result.metrics.tinyTapTargets });
  }
  if (result.size.width >= 768 && result.metrics.onboardingCoverage !== null && result.metrics.onboardingCoverage < 0.85) {
    items.push({ size: result.size.name, issue: 'tablet onboarding leaves excessive horizontal dead space', metrics: result.metrics });
  }
  return items;
});
if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(results, null, 2));
