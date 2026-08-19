import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3101';
const outDir = process.env.OUT_DIR || 'test-results/mineral-plum-final';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  localStorage.setItem('pso.topapp.onboarding.v1', 'done');
  localStorage.setItem('pso.product.profile.v5', JSON.stringify({
    dogName: 'Мята',
    breedId: 'mixed',
    lifeStage: 'взрослая',
    size: 'средняя',
    vaccineStatus: 'актуально',
    parasiteStatus: 'скоро нужно',
    socialMode: 'сначала спросить',
    energyLevel: 'активный',
    temperament: 'нежная, любопытная',
    triggers: 'самокаты, резкий шум',
    neighborhood: 'Сокол / парк рядом',
    photos: [],
    selectedStyle: 'city',
    bio: 'Нежная, активная, иногда тревожится на шумных улицах.',
    backendPetId: 'guest-pet-palette',
    isPublic: false,
  }));
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);

for (const [id, label] of [['today', 'всё'], ['profile', 'псё'], ['map', 'карта'], ['nearby', 'рядом'], ['things', 'вещи']]) {
  await page.evaluate((route) => {
    const button = document.querySelector(`.app-tabs button[data-route="${route}"]`);
    if (!(button instanceof HTMLButtonElement)) throw new Error(`missing tab button: ${route}`);
    button.click();
  }, id);
  await page.waitForTimeout(420);
  await page.screenshot({ path: `${outDir}/${id}.png`, fullPage: true });
}

await browser.close();
console.log(`saved ${outDir}`);
