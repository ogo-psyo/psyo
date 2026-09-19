import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium, webkit } from 'playwright';

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

const engine = process.env.ENGINE || 'chromium';
const browser = await ({chromium,webkit}[engine]).launch({ headless: true });
try {
  for (const viewport of [{ width: 320, height: 780 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, isMobile:true, hasTouch:true, reducedMotion:'reduce' });
    const page = await context.newPage();
    await page.route('**/api/app/bootstrap**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyBootstrap),
    }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.telegram-pill:not(.mode-loading)').waitFor();await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
    await page.getByRole('button', { name: 'Добавить собаку', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Профиль собаки' });
    await dialog.waitFor();
    await page.waitForFunction(() => document.activeElement === document.querySelector('.dog-creation-sheet'));
    assert.equal(await dialog.evaluate((element) => document.activeElement === element), true, 'dialog should receive focus without opening the keyboard');
    assert.equal(await dialog.locator('input:not([type=radio])').count(), 3);
    assert.deepEqual(await dialog.getByRole('radio').evaluateAll(items=>items.map(el=>el.value)), ['', 'кобель', 'сука']);
    assert.equal(await dialog.locator('datalist').count(),0);
    assert.equal(await page.locator('#pso-exact-content').evaluate(el=>el.inert),true);
    await dialog.evaluate(el=>Promise.all(el.getAnimations().map(animation=>animation.finished)));
    const stableTop = await dialog.evaluate(el=>el.getBoundingClientRect().top);
    await page.evaluate(()=>{Object.defineProperty(visualViewport,'offsetTop',{value:90,configurable:true});visualViewport.dispatchEvent(new Event('scroll'));});
    assert.equal(await dialog.evaluate(el=>el.getBoundingClientRect().top),stableTop,'visual viewport scroll must not reposition the sheet');
    await page.evaluate(()=>{delete visualViewport.offsetTop;});
    assert.equal(await dialog.locator('#dog-creation-age').getAttribute('list'), null);
    assert.equal(await dialog.locator('#dog-creation-breed').getAttribute('list'), null);
    assert.equal(await dialog.getByRole('button', { name: 'Добавить собаку' }).isDisabled(), true);

    await dialog.locator('#dog-creation-name').fill('Боня');
    assert.equal(await dialog.getByRole('button', { name: 'Добавить собаку' }).isEnabled(), true);
    await dialog.locator('#dog-creation-age').fill('2 года 4 месяца');
    await dialog.locator('#dog-creation-breed').fill('австралийский лабрадудль');
    assert.equal(await dialog.locator('#dog-creation-age').inputValue(), '2 года 4 месяца');
    assert.equal(await dialog.locator('#dog-creation-breed').inputValue(), 'австралийский лабрадудль');

    assert.ok(await dialog.locator('.pso-choice span').evaluateAll(items=>items.every(el=>el.getBoundingClientRect().height>=44)), 'radio targets are touch sized');
    const labelGaps = await dialog.locator('.dog-creation-field').evaluateAll(fields=>fields.map(field=>{const label=field.querySelector('label').getBoundingClientRect(),input=field.querySelector('input,select').getBoundingClientRect();return input.top-label.bottom;}));
    assert.ok(labelGaps.every(gap=>gap>=8),'focus perimeter must not touch a label');
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
    await dialog.getByRole('button',{name:'Добавить собаку'}).scrollIntoViewIfNeeded();
    const keyboardGeometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const action = element.querySelector('.onboarding-step-actions')?.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight, actionTop: action?.top, actionBottom: action?.bottom };
    });
    assert.ok(keyboardGeometry.top >= 0, `dialog top is hidden with keyboard-sized viewport at ${viewport.width}px`);
    assert.ok(keyboardGeometry.bottom <= keyboardGeometry.viewportHeight, `dialog bottom is hidden with keyboard-sized viewport at ${viewport.width}px`);
    assert.ok(keyboardGeometry.actionTop >= keyboardGeometry.top && keyboardGeometry.actionBottom <= keyboardGeometry.bottom, `dialog actions are hidden with keyboard-sized viewport at ${viewport.width}px`);

    await dialog.locator('#dog-creation-breed').focus();
    await dialog.evaluate(el=>{el.scrollTop=Math.max(0,el.scrollTop-50);});
    const manualScroll=await dialog.evaluate(el=>el.scrollTop);
    await page.waitForTimeout(250);
    assert.equal(await dialog.evaluate(el=>el.scrollTop),manualScroll,'no delayed forced centering after focus/manual scroll');
    if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/${engine}-onboarding-${viewport.width}.png`, fullPage: false, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
    assert.equal(await page.locator('#pso-exact-content').evaluate(el=>el.inert),false);
    assert.equal(await page.getByRole('button',{name:'Добавить собаку',exact:true}).evaluate(el=>document.activeElement===el),true);
    await page.getByRole('button',{name:'Добавить собаку',exact:true}).click();
    assert.equal(await dialog.locator('#dog-creation-name').inputValue(),'Боня');
    assert.equal(await dialog.locator('#dog-creation-age').inputValue(),'2 года 4 месяца');
    await dialog.getByRole('button',{name:'Добавить собаку'}).click();
    try { await dialog.waitFor({state:'hidden',timeout:10000}); } catch(error) { console.error(await page.locator('body').innerText()); throw error; }
    await page.getByRole('button',{name:'Боня',exact:true}).waitFor();
    await page.getByRole('heading',{name:'Фото собаки',exact:true}).waitFor();
    await page.getByRole('button',{name:'Не сейчас',exact:true}).click();
    await page.locator('.nav [data-route=today]').click();
    await page.getByRole('button',{name:'Добавить фото: Боня',exact:true}).click();
    await page.getByRole('heading',{name:'Фото собаки',exact:true}).waitFor();
    await context.close();
  }
  console.log('onboarding free-input ui smoke ok');
} finally {
  await browser.close();
}
