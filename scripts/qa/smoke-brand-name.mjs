#!/usr/bin/env node
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3111';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('pso.topapp.onboarding.v1', 'done');
    localStorage.setItem('pso.product.profile.v5', JSON.stringify({
      dogName: 'Мята',
      breedId: 'mixed',
      lifeStage: 'взрослая',
      size: 'средняя',
      selectedStyle: 'city',
      photos: [],
      isPublic: false,
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  const wordmark = (await page.locator('.app-wordmark h1').textContent())?.trim();
  const visibleText = await page.locator('body').innerText();
  const title = await page.title();

  if (wordmark !== 'Псё') throw new Error(`Unexpected wordmark: ${wordmark}`);
  if (/\bPSYO\b|\bPso\b/.test(visibleText)) throw new Error('Legacy Latin product name is visible');
  if (!title.startsWith('Псё')) throw new Error(`Unexpected document title: ${title}`);

  console.log(JSON.stringify({ ok: true, base, wordmark, title }));
} finally {
  await browser.close();
}
