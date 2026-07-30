import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:3101';
const browser = await chromium.launch({ headless: true });

const profile = {
  dogName: 'Мята',
  breedId: 'mixed',
  breedGroupId: 'mixed',
  breedCustom: '',
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
  backendPetId: 'guest-pet-qa',
  isPublic: false,
};

async function runScenario(viewport, label) {
  const page = await browser.newPage({ viewport });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate((storedProfile) => {
    localStorage.setItem('pso.topapp.onboarding.v1', 'done');
    localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
  }, profile);
  await page.reload({ waitUntil: 'networkidle' });

  await page.evaluate(() => {
    const shell = document.querySelector('.phone-shell');
    if (!(shell instanceof HTMLElement)) throw new Error('phone shell is missing');
    shell.scrollTop = 600;
  });
  await page.locator('.app-tabs button', { hasText: 'План' }).click();
  await page.waitForTimeout(100);
  const shellScrollTop = await page.locator('.phone-shell').evaluate((element) => element.scrollTop);
  if (shellScrollTop !== 0) throw new Error(`route did not reset scroll: ${shellScrollTop}`);

  await page.getByRole('button', { name: 'Обработка', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Добавлено: Обработка от клещей и паразитов' }).waitFor();

  const task = page.locator('.care-task-card').filter({ hasText: 'Обработка от клещей и паразитов' });
  await task.getByRole('button', { name: 'Готово', exact: true }).click();
  const completedNotice = page.getByRole('status').filter({ hasText: 'Готово: Обработка от клещей и паразитов' });
  await completedNotice.waitFor();
  await completedNotice.getByRole('button', { name: 'Отменить', exact: true }).click();
  await task.getByRole('button', { name: 'Готово', exact: true }).waitFor();

  await task.getByRole('button', { name: 'Удалить', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Удалить дело?' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await task.waitFor();

  await task.getByRole('button', { name: 'Удалить', exact: true }).click();
  await dialog.getByRole('button', { name: 'Удалить дело', exact: true }).click();
  await task.waitFor({ state: 'detached' });

  await page.close();
  return { label, routeScrollReset: true, create: true, completeUndo: true, protectedDelete: true };
}

try {
  const results = [];
  results.push(await runScenario({ width: 390, height: 844 }, 'mobile'));
  results.push(await runScenario({ width: 1280, height: 800 }, 'desktop'));
  console.log(JSON.stringify({ ok: true, results }));
} finally {
  await browser.close();
}
