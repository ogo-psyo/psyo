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

  const firstViewport = page.getByTestId('today-first-viewport');
  await firstViewport.getByRole('heading', { name: /Сегодня с/ }).waitFor();
  const firstViewportPrimaryCount = await firstViewport.getByRole('button', { name: /Готово|Добавить дело|Открыть историю/ }).count();
  if (firstViewportPrimaryCount !== 1) throw new Error(`expected one primary care action, got ${firstViewportPrimaryCount}`);
  if (await page.getByText('Псё Плюс', { exact: false }).count()) throw new Error('Today still exposes Plus');
  if (await page.locator('.observation-disclosure[open]').count()) throw new Error('observation disclosure is open by default');

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

  await page.locator('.app-tabs button', { hasText: 'Сегодня' }).click();
  await firstViewport.getByRole('heading', { name: 'Обработка от клещей и паразитов' }).waitFor();
  await firstViewport.getByRole('button', { name: 'Готово', exact: true }).click();
  const task = page.locator('.care-task-card').filter({ hasText: 'Обработка от клещей и паразитов' });
  const completedNotice = page.getByRole('status').filter({ hasText: 'Готово: Обработка от клещей и паразитов' });
  await completedNotice.waitFor();
  await firstViewport.getByRole('heading', { name: 'На сегодня всё', exact: true }).waitFor();
  await completedNotice.getByRole('button', { name: 'Отменить', exact: true }).click();

  await page.locator('.app-tabs button', { hasText: 'План' }).click();
  await task.getByRole('button', { name: 'Готово', exact: true }).waitFor();

  await task.getByRole('button', { name: 'Удалить', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Удалить дело?' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await task.waitFor();

  await task.getByRole('button', { name: 'Удалить', exact: true }).click();
  const destructiveConfirm = dialog.getByRole('button', { name: 'Удалить дело', exact: true });
  await destructiveConfirm.dispatchEvent('pointerdown', { button: 0 });
  await page.waitForTimeout(1300);
  await destructiveConfirm.dispatchEvent('pointerup', { button: 0 });
  await task.waitFor({ state: 'detached' });

  await page.close();
  return { label, routeScrollReset: true, create: true, completeUndo: true, protectedDelete: true };
}

async function runOnboardingScenario() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await page.getByRole('button', { name: 'Создать питомца', exact: true }).click();
  await page.getByText('шаг 1 из 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Назад', exact: true }).waitFor();
  const continueButton = page.getByRole('button', { name: 'Продолжить', exact: true });
  if (await continueButton.isEnabled()) throw new Error('onboarding allows an empty dog name');
  await page.getByLabel('Имя', { exact: true }).fill('Мята');
  await continueButton.click();

  await page.getByText('шаг 2 из 2', { exact: true }).waitFor();
  await page.locator('.core-onboarding.care').getByRole('button', { name: /Обработка/ }).click();
  const finishButton = page.getByRole('button', { name: 'Добавить дело и открыть Сегодня', exact: true });
  await finishButton.click();
  await page.getByTestId('today-first-viewport').getByRole('heading', { name: 'Обработка от клещей и паразитов' }).waitFor();
  if (await page.getByText('Обработка от клещей и паразитов', { exact: true }).count() !== 2) {
    throw new Error('onboarding did not create exactly one reminder across Today and desktop context');
  }

  await page.close();
  return { label: 'onboarding-mobile', nameRequired: true, backAvailable: true, createsOneCareItem: true };
}

try {
  const results = [];
  results.push(await runOnboardingScenario());
  results.push(await runScenario({ width: 390, height: 844 }, 'mobile'));
  results.push(await runScenario({ width: 1280, height: 800 }, 'desktop'));
  console.log(JSON.stringify({ ok: true, results }));
} finally {
  await browser.close();
}
