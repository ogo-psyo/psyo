import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3101';
const outDir = process.env.OUT_DIR || 'test-results/design-state-audit';
const captureOnly = process.env.CAPTURE_ONLY === '1';
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', breedCustom: '', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить', energyLevel: 'активный',
  temperament: 'нежная, любопытная',
  triggers: 'самокаты, резкий шум',
  neighborhood: 'Сокол / парк рядом',
  photos: [], selectedStyle: 'city', bio: 'Нежная, активная, иногда тревожится на шумных улицах.', backendPetId: 'guest-pet-qa', isPublic: false
};
const tabs = [
  { id: 'today', button: 'всё' },
  { id: 'profile', button: 'псё' },
  { id: 'map', button: 'карта' },
  { id: 'nearby', button: 'рядом' },
  { id: 'things', button: 'вещи' },
];
const sizes = [
  { name: 'm360', width: 360, height: 800 },
  { name: 'm390', width: 390, height: 844 },
  { name: 't768p', width: 768, height: 1024 },
  { name: 't1024l', width: 1024, height: 768 },
  { name: 'd1280', width: 1280, height: 800 },
  { name: 'd1440', width: 1440, height: 900 },
  { name: 'd1920', width: 1920, height: 1080 },
];
const results=[];
for (const size of sizes) {
  for (const tab of tabs) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
    await page.route(/(?:tile\.openstreetmap|basemaps|leaflet)/i, (route) => route.abort());
    await page.addInitScript(() => {
      const fixedNow = new Date('2026-09-01T12:00:00.000Z').valueOf();
      const RealDate = Date;
      class FixedDate extends RealDate {
        constructor(...args) { super(...(args.length ? args : [fixedNow])); }
        static now() { return fixedNow; }
      }
      globalThis.Date = FixedDate;
      globalThis.Telegram = { WebApp: { initData: '', ready() {}, expand() {}, enableClosingConfirmation() {} } };
    });
    await page.addInitScript((profile) => {
      localStorage.setItem('pso.topapp.onboarding.v1','done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(profile));
    }, profile);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.app-tabs').waitFor({ state: 'visible' });
    await page.getByRole('heading', { name: 'Мята', exact: true }).first().waitFor({ state: 'visible' });
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate((buttonLabel) => {
      const button = [...document.querySelectorAll('.app-tabs button')].find(
        (candidate) => candidate.textContent?.trim() === buttonLabel,
      );
      if (!(button instanceof HTMLButtonElement)) throw new Error(`missing tab button: ${buttonLabel}`);
      button.click();
    }, tab.button);
    await page.waitForFunction((buttonLabel) => (
      document.querySelector('.app-tabs [aria-current="page"]')?.textContent?.trim() === buttonLabel
    ), tab.button);
    await page.screenshot({ path: `${outDir}/${size.name}-${tab.id}.png`, fullPage: true });
    if (size.name === 'm390' && tab.id === 'today') {
      const carePreset = page.locator('.today-care-presets').getByRole('button', { name: /Обработка/ });
      if (await carePreset.count()) {
        await carePreset.click();
        await page.getByRole('status').filter({ hasText: 'Добавлено: Обработка от клещей и паразитов' }).waitFor();
        await page.screenshot({ path: `${outDir}/${size.name}-${tab.id}-with-care.png`, fullPage: true });
      } else if (!captureOnly) {
        throw new Error('Expected care preset: Обработка');
      }
    }
    const m = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      activeRoute: document.querySelector('.app-tabs [aria-current="page"]')?.textContent?.trim() || '',
      primaryTargetHeights: [...document.querySelectorAll('.app-tabs button, .care-action-notice button, .care-delete-dialog button')]
        .map((element) => Math.round(element.getBoundingClientRect().height)),
      bodyText: document.body.innerText.slice(0,300),
      overflow: [...document.querySelectorAll('body *')].map((el) => { const r=el.getBoundingClientRect(); return {tag:el.tagName, cls:String(el.className||''), text:(el.textContent||'').trim().slice(0,60), left:r.left, right:r.right, w:r.width}; }).filter(x => x.w>1 && !x.cls.includes('leaflet-tile') && (x.left<-1 || x.right>innerWidth+1)).slice(0,10)
    }));
    results.push({size:size.name, tab: tab.id, m});
    await page.close();
  }
}
await browser.close();
await fs.writeFile(`${outDir}/metrics.json`, JSON.stringify(results,null,2));
const overflowing = results.filter((result) => result.m.overflow.length > 0);
const undersized = results.filter((result) => result.m.primaryTargetHeights.some((height) => height < 44));
const wrongRoutes = results.filter((result) => result.m.activeRoute !== tabs.find((tab) => tab.id === result.tab)?.button);
if ((overflowing.length || undersized.length || wrongRoutes.length) && !captureOnly) {
  console.error(JSON.stringify({ ok: false, overflowing, undersized, wrongRoutes }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(results,null,2));
