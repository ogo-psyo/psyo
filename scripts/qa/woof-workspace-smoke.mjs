import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'актуально', socialMode: 'сначала спросить',
  energyLevel: 'обычный', temperament: 'спокойная', triggers: '', neighborhood: 'Сокол',
  photos: [], selectedStyle: 'city', bio: '', backendPetId: 'guest-pet-woof-smoke', isPublic: false,
};

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, geolocation: { latitude: 55.76, longitude: 37.62 }, permissions: ['geolocation'] });
    const page = await context.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate((stored) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(stored));
    }, profile);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.app-tabs button[data-route="nearby"]').click({ force: true });
    await page.getByRole('button', { name: /Гав/, exact: true }).last().click({ force: true });
    await page.locator('.production-woof-workspace').waitFor();
    await page.getByRole('heading', { name: 'Знакомства', exact: true }).waitFor();
    await page.getByRole('region', { name: 'Фильтры знакомств' }).waitFor();
    await page.getByRole('button', { name: 'Свернуть фильтры', exact: true }).waitFor();

    await page.getByRole('button', { name: 'Сейчас рядом', exact: true }).click();
    await page.getByRole('button', { name: 'Сейчас рядом', exact: true }).waitFor();
    if (await page.getByRole('button', { name: 'Сейчас рядом', exact: true }).getAttribute('aria-pressed') !== 'true') throw new Error(`${viewport.width}px: live mode did not activate`);
    await page.getByRole('button', { name: 'Дать Гав', exact: true }).waitFor();

    await page.getByRole('button', { name: 'Дать Гав', exact: true }).click();
    await page.getByRole('dialog', { name: 'Когда идём?' }).waitFor();
    await page.keyboard.press('Shift+Tab');
    if (!await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))) throw new Error(`${viewport.width}px: focus escaped composer`);
    await page.getByRole('button', { name: /Выбрать район рядом со мной/ }).click();
    await page.getByText(/зона радиусом 700 м/).waitFor();
    await page.getByText(/Гав исчезнет автоматически через 2 часа/).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Когда идём?' }).waitFor({ state: 'hidden' });

    await page.getByRole('button', { name: 'Знакомства', exact: true }).click();
    await page.getByRole('heading', { name: 'Знакомства', exact: true }).waitFor();
    await page.getByRole('region', { name: 'Фильтры знакомств' }).waitFor();
    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const workspace = document.querySelector('.production-woof-workspace');
      const nav = document.querySelector('.app-tabs');
      const topbar = document.querySelector('.woof-topbar');
      if (!workspace || !nav || !topbar) throw new Error('missing workspace geometry');
      const w = workspace.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      const t = topbar.getBoundingClientRect();
      return { scrollWidth: root.scrollWidth, viewport: innerWidth, workspace: [w.top, w.bottom], nav: [n.top, n.bottom], topbar: [t.top, t.bottom] };
    });
    if (metrics.scrollWidth > metrics.viewport) throw new Error(`${viewport.width}px: horizontal overflow ${metrics.scrollWidth}`);
    if (metrics.topbar[1] >= metrics.nav[0]) throw new Error(`${viewport.width}px: topbar collides with navigation`);
    await context.close();
  }
  console.log('woof workspace smoke: PASS');
} finally {
  await browser.close();
}
