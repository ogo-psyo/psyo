import { chromium } from 'playwright';
import fs from 'node:fs';

const imagePath = '/tmp/pso-avatar-test.png';
const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAXElEQVR4nO3PQQ3AIADAQMD+JY5gIYjE0TksS9bE7J4+gP8e4DkAAADg0vUAAABQZAEAAECBBQAAAgsAAASWAAAILAAAECywAABAYAEAgMACAACBBQAAAgsAAASWAAAILAAAECywAABAYAEAgMACAACBBQAAgrsAGvUBfDJ+4hAAAAAASUVORK5CYII=';
fs.writeFileSync(imagePath, Buffer.from(b64, 'base64'));

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pso.topapp.onboarding.v1', 'done'); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Собака' }).click();
  await page.getByText('Герой и фото').click();
  await page.locator('input[type="file"]').last().setInputFiles(imagePath);
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('pso.product.profile.v5');
    if (!raw) return false;
    const profile = JSON.parse(raw);
    return profile.avatarSource === 'uploaded' && typeof profile.avatarImageUrl === 'string' && profile.avatarImageUrl.startsWith('data:image/jpeg');
  }, null, { timeout: 10000 });
  const result = await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem('pso.product.profile.v5') || '{}');
    return {
      source: profile.avatarSource,
      imagePrefix: String(profile.avatarImageUrl || '').slice(0, 23),
      imageLength: String(profile.avatarImageUrl || '').length,
      imgCount: document.querySelectorAll('.avatar-image').length,
    };
  });
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
