import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const output = process.env.OUTPUT_DIR || '/tmp';
const profile = {
  dogName: 'Локи', breedId: 'mixed', breedGroupId: 'companion', age: '2 года', lifeStage: 'взрослая', sex: 'кобель',
  habits: [], photos: [], selectedStyle: 'city', avatarImageUrl: '', avatarSource: 'none',
};

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/api/app/bootstrap*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ empty: true, user: null }),
  }));
  await page.route('**/api/billing/entitlements*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ active: false }),
  }));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate((storedProfile) => {
    localStorage.setItem('pso.topapp.onboarding.v1', 'done');
    localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
  }, profile);
  await page.reload({ waitUntil: 'networkidle' });

  await page.locator('.app-tabs button[data-route="profile"]').click({ force: true });
  await page.getByRole('button', { name: /Настройки и приватность/ }).click();
  const danger = page.getByRole('region', { name: 'Удаление данных' });
  await danger.waitFor();
  const dogDeleteSummary = danger.locator('summary').filter({ hasText: 'Удалить собаку' });
  const localDeleteSummary = danger.locator('summary').filter({ hasText: 'Очистить данные на этом устройстве' });
  await dogDeleteSummary.waitFor();
  await localDeleteSummary.waitFor();
  const metrics = await danger.evaluate((node) => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    actions: [...node.querySelectorAll('summary,button')].map((item) => {
      const rect = item.getBoundingClientRect();
      return { text: item.textContent?.trim(), width: rect.width, height: rect.height };
    }),
  }));
  if (metrics.scrollWidth > metrics.viewport) throw new Error(`horizontal overflow ${metrics.scrollWidth}/${metrics.viewport}`);
  const undersized = metrics.actions.filter((item) => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44));
  if (undersized.length) throw new Error(`undersized delete controls: ${JSON.stringify(undersized)}`);
  await page.screenshot({ path: `${output}/guest-delete-settings-390.png`, fullPage: true });

  await dogDeleteSummary.click();
  await danger.getByLabel('Введите имя собаки полностью').fill('Локи');
  const deleteButton = danger.getByRole('button', { name: 'Удалить собаку' });
  if (await deleteButton.isDisabled()) throw new Error('exact dog-name confirmation did not enable delete');
  await deleteButton.click();
  await page.waitForFunction(() => !localStorage.getItem('pso.product.profile.v5') || !localStorage.getItem('pso.product.profile.v5')?.includes('Локи'));
  console.log('guest delete UI smoke: ok (390px, anonymous bootstrap, confirmed delete)');
} finally {
  await browser.close();
}
