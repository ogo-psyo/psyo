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

  const livingDay = page.locator('[data-production-journey="today"]');
  await livingDay.waitFor();
  await page.getByRole('heading', { name: `${profile.dogName} сегодня`, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Спросить Псё', exact: true }).waitFor();
  for (const item of ['всё', 'псё', 'карта', 'гав', 'вещи']) await page.locator('.app-tabs').getByText(item, { exact: true }).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (overflow) throw new Error(`horizontal overflow in ${label}`);
  await page.locator('.app-tabs button', { hasText: 'карта' }).click();
  await page.getByRole('heading', { name: 'Карта прогулок', exact: true }).waitFor();
  await page.locator('.app-tabs button', { hasText: 'гав' }).click();
  await page.getByRole('heading', { name: 'Гав', exact: true }).waitFor();

  await page.close();
  return { label, livingDay: true, navigation: true, assistant: true, map: true, woof: true, noHorizontalOverflow: true };
}

async function runOnboardingScenario() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  if (await page.locator('[data-production-journey="today"]').count()) {
    await page.getByRole('button', { name: 'Спросить Псё', exact: true }).waitFor();
    await page.locator('.app-tabs').getByText('гав', { exact: true }).waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) throw new Error('living day has horizontal overflow on 390px viewport');
    await page.close();
    return { label: 'production-journey-mobile', navigation: true, assistant: true, noHorizontalOverflow: true };
  }

  await page.getByRole('button', { name: 'Добавить собаку', exact: true }).first().click();
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
