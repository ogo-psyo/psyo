import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3101';
const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить', energyLevel: 'активная',
  temperament: 'нежная', triggers: 'самокаты', neighborhood: 'Сокол', photos: [], selectedStyle: 'city', backendPetId: 'guest-pet-assistant', isPublic: false,
};

const browser = await chromium.launch({ headless: true });
const results = [];
await fs.mkdir('artifacts/assistant-sheet-ui', { recursive: true });
try {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    let assistantRequest = 0;
    await page.route('**/api/assistant', async (route) => {
      assistantRequest += 1;
      return route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(assistantRequest === 1 ? {
          answer: 'Начните с более тихого участка и держите дистанцию до самокатов.', provider: 'groq', mode: 'groq_contextual', threadId: 'thread-1',
          suggestedQuestions: ['Как подготовиться к прогулке?', 'Что взять с собой?'],
          actionSuggestions: [{ intent: 'create_reminder', destination: { screen: 'calendar', mode: 'create' }, humanLabel: 'Поставить короткую тренировку', payload: { title: '10 минут спокойной прогулки' } }],
        } : {
          answer: 'Открою планирование маршрута без выдуманной стартовой точки.', provider: 'groq', mode: 'groq_contextual', threadId: 'thread-1',
          actionSuggestions: [{ intent: 'plan_walk', destination: { screen: 'map', mode: 'plan_walk' }, humanLabel: 'Запланировать прогулку', payload: { title: 'Спокойная прогулка', note: 'Избегать самокатов' } }],
        }),
      });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate((storedProfile) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
    }, profile);
    await page.reload({ waitUntil: 'networkidle' });

    const trigger = page.getByRole('button', { name: 'Спросить Псё' }).first();
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Спросить Псё' });
    await dialog.waitFor();
    await dialog.getByText('наблюдения, прогулки, документы и этот диалог', { exact: false }).waitFor();
    const input = dialog.getByLabel('Вопрос ассистенту');
    if (!(await input.evaluate((element) => element === document.activeElement))) throw new Error(`${viewport.width}: input did not receive focus`);
    const backgroundFocusBlocked = await page.evaluate(() => {
      const backgroundButton = document.querySelector('.app-tabs button');
      if (!(backgroundButton instanceof HTMLElement)) return false;
      backgroundButton.focus();
      return document.querySelector('dialog[open]')?.contains(document.activeElement) ?? false;
    });
    if (!backgroundFocusBlocked) throw new Error(`${viewport.width}: modal did not isolate background focus`);
    await input.fill('Как сделать вечернюю прогулку спокойнее?');
    await input.press('Enter');
    await dialog.getByText('Начните с более тихого участка', { exact: false }).waitFor();
    await dialog.getByRole('button', { name: 'Как подготовиться к прогулке?' }).waitFor();
    await dialog.getByRole('button', { name: 'Поставить короткую тренировку' }).waitFor();
    const metrics = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const composer = element.querySelector('.production-assistant-composer')?.getBoundingClientRect();
      return {
        open: element.hasAttribute('open'), provider: element.getAttribute('data-assistant-provider'), mode: element.getAttribute('data-assistant-mode'),
        top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight,
        composerBottom: composer?.bottom ?? 0,
      };
    });
    if (!metrics.open || metrics.provider !== 'groq' || metrics.mode !== 'groq_contextual') throw new Error(`${viewport.width}: diagnostics missing`);
    if (metrics.top < 0 || metrics.bottom > metrics.viewportHeight + 1 || metrics.composerBottom > metrics.viewportHeight + 1) throw new Error(`${viewport.width}: sheet/composer outside viewport ${JSON.stringify(metrics)}`);
    await page.screenshot({ path: `artifacts/assistant-sheet-ui/review-${viewport.width}.png`, fullPage: false });
    await dialog.getByRole('button', { name: 'Поставить короткую тренировку' }).click();
    await dialog.getByText('Готово', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Открыть' }).click();
    await dialog.waitFor({ state: 'detached' });
    if (!page.url().endsWith('#calendar')) throw new Error(`${viewport.width}: reminder did not navigate to calendar`);

    await page.locator('.app-tabs').getByRole('button', { name: 'всё', exact: true }).click();
    await page.waitForURL(/#today$/);
    await page.getByRole('button', { name: 'Спросить Псё' }).first().click();
    const routeDialog = page.getByRole('dialog', { name: 'Спросить Псё' });
    await routeDialog.getByLabel('Вопрос ассистенту').fill('Подбери спокойный маршрут');
    await routeDialog.getByLabel('Вопрос ассистенту').press('Enter');
    await routeDialog.getByRole('button', { name: 'Запланировать прогулку' }).click();
    await routeDialog.waitFor({ state: 'detached' });
    if (!page.url().endsWith('#map')) throw new Error(`${viewport.width}: plan_walk did not navigate to map`);
    await page.getByRole('region', { name: 'Построить заранее' }).waitFor();
    const routePointCount = await page.locator('[data-route-flow="planning"]').getByText('0 точек', { exact: false }).count();
    if (!routePointCount) throw new Error(`${viewport.width}: plan_walk fabricated route coordinates or did not open preplanning`);
    results.push(metrics);
    await page.close();
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  await browser.close();
}
