import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3000';
const outDir = process.env.OUT_DIR || 'artifacts/public-card-lifecycle';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 1280, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(10_000);
    await page.goto(`${base}?demo=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('.app-tabs button[data-route="profile"]').click({ force: true });
    await page.getByRole('button', { name: /Памятка/ }).first().click({ force: true });
    await page.getByRole('heading', { name: 'Публичная карточка' }).waitFor();
    await page.getByText('Демо без входа').waitFor();

    const create = page.getByRole('button', { name: 'Создать публичную карточку' });
    await create.waitFor();
    await page.screenshot({ path: `${outDir}/draft-${viewport.width}.png`, fullPage: true });
    await create.click();
    await page.getByRole('heading', { name: 'Карточка опубликована' }).waitFor();
    await page.getByRole('button', { name: /Скопировать ссылку/ }).waitFor();

    await page.getByRole('button', { name: /Порода/ }).click();
    await page.getByRole('heading', { name: 'Обнови опубликованную карточку' }).waitFor();
    await page.getByRole('button', { name: 'Опубликовать изменения' }).click();
    await page.getByRole('heading', { name: 'Карточка опубликована' }).waitFor();
    await page.screenshot({ path: `${outDir}/published-${viewport.width}.png`, fullPage: true });

    await page.getByRole('button', { name: 'Отозвать доступ' }).click();
    await page.getByRole('button', { name: 'Да, отозвать' }).click();
    await page.getByRole('button', { name: 'Создать публичную карточку' }).waitFor();
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (geometry.scrollWidth > geometry.viewport) throw new Error(`${viewport.width}px: public-card flow overflows horizontally`);
    results.push({ viewport: viewport.width, ...geometry });
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
