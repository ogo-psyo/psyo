import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3104';
const outDir = process.env.OUT_DIR || 'artifacts/care-calendar';
await fs.mkdir(outDir, { recursive: true });

const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая',
  photos: [], selectedStyle: 'city', backendPetId: 'guest-care-calendar',
};
const reminders = [
  { id: 'care-1', petId: profile.backendPetId, type: 'custom', title: 'Вернуться к вопросу по уходу', dueAt: '2026-09-02T09:00:00+03:00', recurrence: 'none', status: 'active' },
  { id: 'care-2', petId: profile.backendPetId, type: 'vaccine', title: 'Проверить дату вакцинации', dueAt: '2026-09-03T10:00:00+03:00', recurrence: 'yearly', status: 'active' },
  { id: 'care-3', petId: profile.backendPetId, type: 'custom', title: 'Купить корм', dueAt: '2026-09-03T18:00:00+03:00', recurrence: 'none', status: 'active' },
  { id: 'care-4', petId: profile.backendPetId, type: 'grooming', title: 'Подстричь когти', dueAt: '2026-09-05T12:00:00+03:00', recurrence: 'monthly', status: 'active' },
];

async function seed(page) {
  await page.goto(`${base}?demo=1`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ storedProfile, storedReminders }) => {
    localStorage.setItem('pso.topapp.onboarding.v1', 'done');
    localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
    localStorage.setItem(`pso.product.entities.v1:${storedProfile.backendPetId}`, JSON.stringify({ reminders: storedReminders, wishlist: [], zones: [], routes: [] }));
  }, { storedProfile: profile, storedReminders: reminders });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.app-tabs button[data-route="profile"]').click({ force: true });
  await page.locator('[data-profile-memory]').waitFor();
  await page.getByRole('button', { name: /План заботы/ }).click();
  await page.locator('[data-care-calendar]').waitFor();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 320, height: 720, name: 'narrow' }, { width: 390, height: 844, name: 'telegram-ios' }, { width: 1280, height: 900, name: 'desktop' }]) {
    const page = await browser.newPage({ viewport });
    page.setDefaultTimeout(10_000);
    await seed(page);

    const calendar = page.locator('[data-care-calendar]');
    if (!/сентябрь 2026/i.test(await calendar.locator('.calendar-toolbar b').textContent() || '')) throw new Error(`${viewport.name}: wrong calendar month`);
    if (await calendar.getByRole('gridcell', { name: /3 сентября, 2 дела/ }).count() !== 1) throw new Error(`${viewport.name}: date count is missing`);
    if (!/2 сентября/.test(await page.locator('.selected-day-panel b').textContent() || '')) throw new Error(`${viewport.name}: nearest active day was not selected`);

    await calendar.getByRole('gridcell', { name: /3 сентября, 2 дела/ }).click();
    const taskList = page.locator('.care-calendar-view .care-task-list');
    if (await taskList.locator('.care-task-card').count() !== 2) throw new Error(`${viewport.name}: selected day did not limit the list`);
    if (await taskList.getByText('Подстричь когти', { exact: true }).count()) throw new Error(`${viewport.name}: another day leaked into the list`);

    await calendar.getByRole('gridcell', { name: '4 сентября, 0 дел', exact: true }).click();
    if (!await taskList.getByText('На этот день дел нет', { exact: true }).isVisible()) throw new Error(`${viewport.name}: empty day state is missing`);
    await page.locator('.selected-day-panel').getByRole('button', { name: 'Добавить', exact: true }).click();
    if (await page.locator('.care-composer input[type="date"]').inputValue() !== '2026-09-04') throw new Error(`${viewport.name}: add form did not inherit selected date`);

    await calendar.getByRole('button', { name: 'Предыдущий месяц' }).click();
    if (!/август 2026/i.test(await calendar.locator('.calendar-toolbar b').textContent() || '')) throw new Error(`${viewport.name}: previous month navigation failed`);
    await calendar.getByRole('button', { name: 'Следующий месяц' }).click();
    const selectedCell = calendar.locator('[aria-pressed="true"]');
    if (!/^4 сентября/.test(await selectedCell.getAttribute('aria-label') || '')) throw new Error(`${viewport.name}: selected day was lost after month navigation`);
    const selectedStyle = await selectedCell.evaluate((element) => ({ className: element.className, background: getComputedStyle(element).backgroundColor }));
    if (!selectedStyle.className.includes('selected') || selectedStyle.background !== 'rgb(23, 24, 20)') throw new Error(`${viewport.name}: selected day has no visible state (${JSON.stringify(selectedStyle)})`);

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (geometry.scrollWidth > geometry.viewport) throw new Error(`${viewport.name}: horizontal overflow ${geometry.scrollWidth}/${geometry.viewport}`);
    await calendar.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/${viewport.name}.png`, fullPage: false });
    await page.close();
  }
  console.log(JSON.stringify({ ok: true, viewports: ['320x720', '390x844', '1280x900'], mode: 'selected-day' }, null, 2));
} finally {
  await browser.close();
}
