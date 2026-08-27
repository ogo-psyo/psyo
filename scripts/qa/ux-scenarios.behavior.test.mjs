import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3101';
const screenshotDir = process.env.UX_SCREENSHOT_DIR;
if (screenshotDir) await fs.mkdir(screenshotDir, { recursive: true });

const demoBootstrap = {
  mode: 'demo',
  user: { id: 'demo-user', displayName: 'Владелец' },
  pets: [
    { id: 'demo-pet', ownerId: 'demo-user', name: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', photoUrls: [] },
    { id: 'demo-pet-2', ownerId: 'demo-user', name: 'Груша', breedId: 'corgi', breedGroupId: 'herding', photoUrls: [] },
  ],
  pet: { id: 'demo-pet', ownerId: 'demo-user', name: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', photoUrls: [] },
  passport: { petId: 'demo-pet', vaccineStatus: 'unknown', parasiteStatus: 'unknown' },
  social: { petId: 'demo-pet', socialMode: 'ask_first', triggers: [] },
  reminders: [],
  zones: [],
  routes: [],
  wishlist: [],
  observations: [],
};

const emptyBootstrap = {
  mode: 'supabase',
  connected: true,
  empty: true,
  user: null,
  pets: [],
};

function luminance(rgb) {
  const channels = rgb.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  return channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function openScenario(browser, bootstrap) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error(`[pageerror] ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`[console] ${message.text()}`);
  });
  await page.route('**/api/app/bootstrap**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(bootstrap),
  }));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1700);
  return { context, page };
}

const browser = await chromium.launch({ headless: true });

try {
  const demo = await openScenario(browser, demoBootstrap);
  await demo.page.getByRole('heading', { name: 'Сегодня с Мятой', exact: true }).waitFor();
  await demo.page.getByRole('button', { name: 'Открыть профиль собаки' }).click();
  await demo.page.getByRole('heading', { name: 'Мята', exact: true }).waitFor();

  const selectedPetColors = await demo.page.locator('.pet-switcher button.active').evaluate((element) => {
    const styles = getComputedStyle(element);
    return { foreground: styles.color, background: styles.backgroundColor };
  });
  const selectedPetContrast = contrast(selectedPetColors.foreground, selectedPetColors.background);
  if (selectedPetContrast < 4.5) throw new Error(`selected pet contrast is ${selectedPetContrast.toFixed(2)}:1`);

  await demo.page.getByRole('button', { name: 'всё', exact: true }).click();
  await demo.page.getByRole('button', { name: 'Спросить', exact: true }).click();
  await demo.page.getByRole('button', { name: 'Назад во Всё', exact: true }).waitFor();
  const activeInternalRoute = await demo.page.locator('.app-tabs [aria-current="page"]').textContent();
  if (activeInternalRoute?.trim() !== 'всё') throw new Error(`assistant parent route is ${activeInternalRoute || 'empty'}`);

  await demo.page.getByRole('button', { name: 'карта', exact: true }).click();
  if (await demo.page.locator('.map-privacy-modes').count()) throw new Error('map privacy choice is visible before add flow starts');
  await demo.page.getByRole('button', { name: 'Добавить место или маршрут', exact: true }).click();
  await demo.page.getByRole('button', { name: 'Место', exact: true }).waitFor();
  if (screenshotDir) await demo.page.screenshot({ path: `${screenshotDir}/map-composer.png`, fullPage: true });

  await demo.page.getByRole('button', { name: 'вещи', exact: true }).click();
  if (await demo.page.locator('.thing-capture').count()) throw new Error('things form is open before the user asks to add an item');
  await demo.page.getByRole('button', { name: 'Добавить вещь', exact: true }).click();
  await demo.page.locator('.thing-capture').waitFor();
  if (screenshotDir) await demo.page.screenshot({ path: `${screenshotDir}/things-composer.png`, fullPage: true });
  await demo.context.close();

  const empty = await openScenario(browser, emptyBootstrap);
  await empty.page.getByRole('heading', { name: 'Добавь собаку', exact: true }).waitFor();
  const firstRunActions = await empty.page.locator('.first-run-activation button').count();
  if (firstRunActions !== 1) throw new Error(`first run exposes ${firstRunActions} actions instead of one`);
  if (await empty.page.locator('.app-tabs').count()) throw new Error('primary navigation is visible before the first dog exists');
  if (await empty.page.getByRole('button', { name: 'Спросить', exact: true }).count()) throw new Error('assistant is exposed before activation');
  if (screenshotDir) await empty.page.screenshot({ path: `${screenshotDir}/first-run.png`, fullPage: true });
  const firstRunButton = empty.page.getByRole('button', { name: 'Добавить собаку', exact: true });
  await firstRunButton.click();
  const dialog = empty.page.getByRole('dialog', { name: 'Профиль собаки' });
  await dialog.waitFor();
  if (await dialog.locator('input').count() !== 3) throw new Error('onboarding must expose free input for name, age and breed');
  if (await dialog.locator('#dog-creation-age').getAttribute('list') !== 'dog-creation-age-options') throw new Error('age input has no optional suggestions');
  if (await dialog.locator('#dog-creation-breed').getAttribute('list') !== 'dog-creation-breed-options') throw new Error('breed input has no optional suggestions');
  if (await empty.page.evaluate(() => document.activeElement?.id) !== 'dog-creation-name') throw new Error('onboarding does not focus the name field');
  await empty.page.keyboard.press('Shift+Tab');
  if (await empty.page.evaluate(() => document.activeElement?.textContent?.trim()) !== 'Не сейчас') throw new Error('onboarding focus is not trapped');
  if (screenshotDir) await empty.page.screenshot({ path: `${screenshotDir}/first-run-dialog.png`, fullPage: true });
  await empty.page.keyboard.press('Escape');
  await firstRunButton.waitFor();
  await empty.page.waitForFunction(() => document.activeElement?.closest('.first-run-activation') !== null);
  if (await firstRunButton.evaluate((button) => document.activeElement === button) !== true) throw new Error('onboarding does not restore focus');
  await empty.context.close();

  console.log(JSON.stringify({
    ok: true,
    scenarios: ['demo identity', 'selected-pet contrast', 'nested navigation', 'map disclosure', 'things disclosure', 'first run'],
  }));
} finally {
  await browser.close();
}
