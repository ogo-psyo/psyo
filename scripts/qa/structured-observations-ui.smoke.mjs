import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3103';
const outDir = process.env.OUT_DIR || 'artifacts/structured-observations';
await fs.mkdir(outDir, { recursive: true });

const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', age: '4 года', sex: 'девочка',
  size: 'средняя', energyLevel: 'активная', neighborhood: 'Сокол', photos: [], selectedStyle: 'city',
  backendPetId: 'guest-pet-structured-observations', isPublic: false,
};
const observations = [
  { id: 'structured-o1', createdAt: '2026-09-02T09:10:00.000Z', mood: 'спокойное', appetite: 'обычный', stool: 'обычный', energy: 'обычная', note: 'После обычной утренней прогулки.' },
  { id: 'structured-o2', createdAt: '2026-09-03T08:40:00.000Z', mood: 'вялое', appetite: 'ниже обычного', stool: 'мягкий', energy: 'ниже обычного', note: 'После позднего возвращения домой.' },
  { id: 'structured-o3', createdAt: '2026-09-02T17:25:00.000Z', mood: 'радостное', appetite: 'обычный' },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 320, height: 720, name: 'narrow' }, { width: 390, height: 844, name: 'telegram-ios' }, { width: 1280, height: 900, name: 'desktop' }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ storedProfile, storedObservations }) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
      localStorage.setItem(`pso.topapp.observations.v2:${storedProfile.backendPetId}`, JSON.stringify(storedObservations));
    }, { storedProfile: profile, storedObservations: observations });
    await page.reload({ waitUntil: 'networkidle' });

    const activePetId = await page.evaluate(() => JSON.parse(localStorage.getItem('pso.product.profile.v5') || '{}').backendPetId);
    await page.evaluate(({ key, storedObservations }) => localStorage.setItem(key, JSON.stringify(storedObservations)), {
      key: `pso.topapp.observations.v2:${activePetId}`,
      storedObservations: observations,
    });
    await page.reload({ waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /Изменилось самочувствие/ }).click();
    await page.locator('[data-scenario-workspace="health"]').waitFor();
    await page.getByRole('button', { name: 'Открыть историю', exact: true }).click();
    const screen = page.locator('.health-screen');
    await screen.waitFor();

    if (await screen.locator('.health-choice').count() !== 4) throw new Error(`${viewport.name}: expected four structured metric groups`);
    if (await screen.locator('.health-capture-progress').textContent() !== '0/4') throw new Error(`${viewport.name}: wrong empty capture progress`);
    await screen.getByRole('button', { name: 'спокойное', exact: true }).first().click();
    await screen.getByRole('button', { name: 'обычный', exact: true }).first().click();
    if (await screen.locator('.health-capture-progress').textContent() !== '2/4') throw new Error(`${viewport.name}: capture progress did not update`);

    const captureContext = screen.locator('.health-capture-context');
    if (await captureContext.getAttribute('open') !== null) throw new Error(`${viewport.name}: optional owner context should start collapsed`);
    await captureContext.locator('summary').click();
    if (!await captureContext.locator('textarea').isVisible()) throw new Error(`${viewport.name}: owner context did not open`);

    const calendar = screen.locator('[data-observation-calendar]');
    if (await calendar.locator('.health-calendar-grid > button').count() !== 30) throw new Error(`${viewport.name}: September calendar did not render`);
    if (!/3 сентября, наблюдений: 1/.test(await calendar.locator('.health-calendar-grid > button[aria-pressed="true"]').getAttribute('aria-label') || '')) throw new Error(`${viewport.name}: latest observed day is not selected by default`);
    await calendar.getByRole('button', { name: 'Предыдущий месяц' }).click();
    if (!/август/i.test(await calendar.locator('.health-calendar-toolbar b').textContent() || '')) throw new Error(`${viewport.name}: previous month navigation failed`);
    await calendar.getByRole('button', { name: 'Следующий месяц' }).click();
    await calendar.getByRole('button', { name: /2 сентября, наблюдений: 2/ }).click();

    const records = screen.locator('.health-timeline article');
    if (await records.count() !== 2) throw new Error(`${viewport.name}: calendar did not limit records to the selected day`);
    const firstGrid = records.first().locator('.health-observation-grid');
    if (await firstGrid.locator('div').count() !== 4) throw new Error(`${viewport.name}: record is not a four-metric matrix`);
    if (!await records.nth(1).getByText('не отмечено', { exact: true }).first().isVisible()) throw new Error(`${viewport.name}: missing metric is not explicit`);
    if (!await records.first().getByText('Контекст владельца', { exact: false }).isVisible()) throw new Error(`${viewport.name}: owner context disclosure missing`);

    await screen.locator('.health-timeline').scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${outDir}/${viewport.name}-history.png`, fullPage: false });

    await records.first().getByRole('button', { name: 'Изменить', exact: true }).click();
    const editor = records.first().locator('.structured-observation-editor');
    await editor.waitFor();
    if (await editor.locator('input').count()) throw new Error(`${viewport.name}: metric editor fell back to free text`);
    if (await editor.locator('.health-choice').count() !== 4) throw new Error(`${viewport.name}: edit form lost structured metric groups`);

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (geometry.scrollWidth > geometry.viewport) throw new Error(`${viewport.name}: horizontal overflow ${geometry.scrollWidth}/${geometry.viewport}`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${outDir}/${viewport.name}.png`, fullPage: false });
    await page.close();
  }
  console.log(JSON.stringify({ ok: true, metrics: 4, viewports: ['320x720', '390x844', '1280x900'], editMode: 'structured' }, null, 2));
} finally {
  await browser.close();
}
