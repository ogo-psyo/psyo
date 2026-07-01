import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const outDir = process.env.OUT_DIR || 'test-results/design-state-audit';
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
  { id: 'today', button: 'Открыть раздел Главная' },
  { id: 'calendar', button: 'Открыть раздел План' },
  { id: 'assistant', button: 'Открыть раздел Ассистент' },
  { id: 'nearby', button: 'Открыть раздел Рядом' },
  { id: 'map', button: 'Открыть раздел Карта' },
  { id: 'card', button: 'Открыть раздел Памятка' },
  { id: 'profile', button: 'Открыть раздел Профиль' },
];
const sizes = [{name:'m360', width:360, height:900},{name:'m390', width:390, height:950},{name:'d1280', width:1280, height:1000}];
const results=[];
for (const size of sizes) {
  for (const tab of tabs) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1 });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate((profile) => {
      localStorage.setItem('pso.topapp.onboarding.v1','done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(profile));
    }, profile);
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate((buttonLabel) => {
      const button = [...document.querySelectorAll('button')].find((candidate) => candidate.getAttribute('aria-label') === buttonLabel);
      if (!(button instanceof HTMLButtonElement)) throw new Error(`missing tab button: ${buttonLabel}`);
      button.click();
    }, tab.button);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outDir}/${size.name}-${tab.id}.png`, fullPage: true });
    const m = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
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
if (overflowing.length) {
  console.error(JSON.stringify({ ok: false, overflowing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(results,null,2));
