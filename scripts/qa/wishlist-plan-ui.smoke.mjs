import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3112';
const outDir = process.env.OUT_DIR || 'artifacts/wishlist-plan-ui';
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const plannedFor = [tomorrow.getFullYear(), String(tomorrow.getMonth() + 1).padStart(2, '0'), String(tomorrow.getDate()).padStart(2, '0')].join('-');
const profile = {
  dogName: 'Плутон', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослый',
  photos: [], selectedStyle: 'city', backendPetId: 'guest-wishlist-plan', isPublic: false,
};

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 320, height: 720, name: 'narrow' }, { width: 390, height: 844, name: 'telegram-ios' }, { width: 1280, height: 900, name: 'desktop' }]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(10_000);
    await page.route('**/api/assistant', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        answer: 'Добавлю покупку корма как одно действие: в вещи и в план.',
        provider: 'rules',
        mode: 'rules_fallback_test',
        actionSuggestions: [{
          intent: 'add_wishlist',
          humanLabel: 'Добавить в вещи и план',
          destination: { screen: 'things', mode: 'create' },
          payload: { title: 'Купить корм', category: 'food', dueDate: plannedFor },
        }],
      }),
    }));
    await page.goto(`${base}?demo=1`, { waitUntil: 'domcontentloaded' });
    await page.evaluate((storedProfile) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
    }, profile);
    await page.reload({ waitUntil: 'domcontentloaded' });

    const assistantTrigger = viewport.width >= 760
      ? page.getByRole('button', { name: 'Спросить Псё' }).first()
      : page.getByRole('button', { name: /Опишите своими словами/ }).first();
    await assistantTrigger.click();
    const dialog = page.getByRole('dialog', { name: 'Спросить Псё' });
    await dialog.getByLabel('Вопрос ассистенту').fill('Записать покупку корма');
    await dialog.getByLabel('Вопрос ассистенту').press('Enter');
    await dialog.getByRole('button', { name: 'Добавить в вещи и план' }).click();
    await dialog.getByText('Добавлено в вещи и план на', { exact: false }).waitFor();
    await dialog.getByRole('button', { name: 'Открыть вещи' }).waitFor();
    await dialog.getByRole('button', { name: 'Открыть план' }).waitFor();
    await page.screenshot({ path: `${outDir}/${viewport.name}-assistant.png`, fullPage: false });

    await dialog.getByRole('button', { name: 'Открыть вещи' }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.waitForTimeout(220);
    await page.locator('.things-masonry').getByText('Купить корм', { exact: true }).waitFor();
    await page.getByText('В плане на', { exact: false }).waitFor();
    await page.screenshot({ path: `${outDir}/${viewport.name}-things.png`, fullPage: false });
    await page.getByRole('button', { name: 'Добавить вещь', exact: true }).click();
    const planToggle = page.getByRole('checkbox', { name: /Добавить в план/ });
    if (!await planToggle.isChecked()) throw new Error(`${viewport.name}: plan link is not offered by default`);
    if (!await page.getByLabel('Купить до').inputValue()) throw new Error(`${viewport.name}: planned date is missing`);
    await planToggle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${outDir}/${viewport.name}-capture.png`, fullPage: false });
    await page.getByRole('button', { name: 'Закрыть добавление', exact: true }).click();

    await page.getByRole('button', { name: 'Открыть в плане' }).click();
    await page.locator('[data-care-calendar]').waitFor();
    const selected = page.locator('[data-care-calendar] [aria-pressed="true"]');
    if (!(await selected.getAttribute('aria-label'))?.includes('1 дело')) throw new Error(`${viewport.name}: linked calendar day was not selected`);
    await page.locator('.care-calendar-view .care-task-list').getByText('Купить корм', { exact: true }).waitFor();
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (geometry.scrollWidth > geometry.viewport) throw new Error(`${viewport.name}: horizontal overflow ${geometry.scrollWidth}/${geometry.viewport}`);
    await page.close();
  }
  console.log(JSON.stringify({ ok: true, viewports: ['320x720', '390x844', '1280x900'], flow: 'assistant -> things -> calendar' }, null, 2));
} finally {
  await browser.close();
}
