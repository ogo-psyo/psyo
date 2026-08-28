import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const outDir = process.env.OUT_DIR || 'artifacts/redesign-reachability';
await fs.mkdir(outDir, { recursive: true });
const profile = { dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить', energyLevel: 'активная', temperament: 'нежная', triggers: 'самокаты', photos: [], selectedStyle: 'city', backendPetId: 'guest-redesign' };

async function seed(page) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate((value) => {
    localStorage.setItem('pso.topapp.onboarding.v1', 'done');
    localStorage.setItem('pso.product.profile.v5', JSON.stringify(value));
  }, profile);
  await page.reload({ waitUntil: 'networkidle' });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    await seed(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw new Error(`${viewport.width}: Today overflows horizontally`);
    await page.screenshot({ path: `${outDir}/today-${viewport.width}.png`, fullPage: false });

    const assistant = page.getByRole('button', { name: 'Спросить Псё', exact: true }).first();
    await assistant.evaluate((button) => button.click());
    await page.getByRole('dialog', { name: 'Спросить Псё' }).waitFor();
    await page.goBack();
    await page.getByRole('dialog', { name: 'Спросить Псё' }).waitFor({ state: 'detached' });
    if (!await page.locator('[data-production-journey="today"]').isVisible()) throw new Error(`${viewport.width}: Back changed route under assistant`);

    await page.locator('.app-tabs button[data-route="profile"]').evaluate((button) => button.click());
    await page.locator('[data-profile-memory]').waitFor();
    await page.getByRole('button', { name: /Здоровье/ }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Здоровье/ }).click();
    await page.locator('.health-screen').waitFor();
    await page.getByText('Постоянные данные здоровья').waitFor();
    await page.screenshot({ path: `${outDir}/health-${viewport.width}.png`, fullPage: false });
    await page.getByRole('button', { name: /Назад во Всё/ }).click();

    await page.locator('.app-tabs button[data-route="profile"]').evaluate((button) => button.click());
    await page.locator('[data-profile-memory]').waitFor();
    await page.getByRole('button', { name: /План заботы/ }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /План заботы/ }).click();
    await page.locator('.calendar-composition').waitFor();
    await page.screenshot({ path: `${outDir}/calendar-${viewport.width}.png`, fullPage: false });
    await page.getByRole('button', { name: /Назад во Всё/ }).click();

    await page.locator('.app-tabs button[data-route="profile"]').evaluate((button) => button.click());
    await page.locator('[data-profile-memory]').waitFor();
    await page.getByRole('button', { name: /Настройки и приватность/ }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Настройки и приватность/ }).click();
    await page.locator('.profile-settings-screen').waitFor();
    await page.goBack();
    await page.locator('[data-profile-memory]').waitFor();
    if (await page.locator('.profile-settings-screen').count()) throw new Error(`${viewport.width}: Back did not close profile detail`);
    await page.close();
  }
  console.log('redesign reachability smoke: ok (320, 390, desktop; Back, calendar, health, settings)');
} finally {
  await browser.close();
}
