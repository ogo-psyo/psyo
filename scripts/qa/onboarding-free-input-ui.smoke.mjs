import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:3101';
const screenshotDir = process.env.UX_SCREENSHOT_DIR;
const emptyBootstrap = {
  mode: 'supabase',
  connected: true,
  empty: true,
  user: null,
  pets: [],
};

if (screenshotDir) await fs.mkdir(screenshotDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 320, height: 780 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await page.route('**/api/app/bootstrap**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyBootstrap),
    }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1_000);
    await page.getByRole('button', { name: 'Добавить собаку', exact: true }).click();

    const dialog = page.getByRole('dialog').first();
    await dialog.waitFor();
    assert.equal(await dialog.locator('#dog-creation-name').evaluate((element) => document.activeElement === element), true, 'name input should receive focus for the under-one-minute flow');
    assert.equal(await dialog.getByRole('button', { name: 'Создать профиль' }).isDisabled(), true);
    await dialog.getByRole('button', { name: /Добавить детали/ }).click();
    assert.equal(await dialog.locator('input').count(), 3);
    assert.equal(await dialog.locator('#dog-creation-age').getAttribute('list'), 'dog-creation-age-options');
    assert.equal(await dialog.locator('#dog-creation-breed').getAttribute('list'), 'dog-creation-breed-options');
    await dialog.locator('#dog-creation-name').fill('Боня');
    assert.equal(await dialog.getByRole('button', { name: 'Создать профиль' }).isEnabled(), true);
    await dialog.locator('#dog-creation-age').fill('2 года 4 месяца');
    await dialog.locator('#dog-creation-breed').fill('австралийский лабрадудль');
    assert.equal(await dialog.locator('#dog-creation-age').inputValue(), '2 года 4 месяца');
    assert.equal(await dialog.locator('#dog-creation-breed').inputValue(), 'австралийский лабрадудль');

    const geometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewportWidth, `dialog overflows horizontally at ${viewport.width}px`);
    assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.viewportHeight, `dialog is clipped vertically at ${viewport.width}px`);
    assert.ok(geometry.documentWidth <= geometry.viewportWidth, `page overflows horizontally at ${viewport.width}px`);

    await dialog.locator('#dog-creation-breed').focus();
    await page.setViewportSize({ width: viewport.width, height: 520 });
    await page.waitForTimeout(180);
    const keyboardGeometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const action = element.querySelector('.onboarding-step-actions')?.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight, actionTop: action?.top, actionBottom: action?.bottom };
    });
    assert.ok(keyboardGeometry.top >= 0, `dialog top is hidden with keyboard-sized viewport at ${viewport.width}px`);
    assert.ok(keyboardGeometry.bottom <= keyboardGeometry.viewportHeight, `dialog bottom is hidden with keyboard-sized viewport at ${viewport.width}px`);
    assert.ok(keyboardGeometry.actionTop >= keyboardGeometry.top && keyboardGeometry.actionBottom <= keyboardGeometry.bottom, `dialog actions are hidden with keyboard-sized viewport at ${viewport.width}px`);

    if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/onboarding-${viewport.width}.png`, fullPage: false, animations: 'disabled' });
    await context.close();
  }
  console.log('onboarding free-input ui smoke ok');
} finally {
  await browser.close();
}
