import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить',
  energyLevel: 'активный', photos: [], selectedStyle: 'city', backendPetId: 'guest-profile-layout',
};

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate((storedProfile) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
    }, profile);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.app-tabs button[data-route="profile"]').click({ force: true });
    await page.locator('[data-production-journey="profile"]').waitFor();

    const layout = await page.evaluate(() => {
      const card = document.querySelector('[data-slot="card"]')?.getBoundingClientRect();
      const items = [...document.querySelectorAll('[data-slot="item"]')].map((node) => node.getBoundingClientRect());
      const footerButtons = [...document.querySelectorAll('[data-slot="card-footer"] button')].map((node) => node.getBoundingClientRect());
      return {
        scrollWidth: document.documentElement.scrollWidth,
        card: card && { left: card.left, right: card.right },
        items: items.map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })),
        footerButtons: footerButtons.map((rect) => ({ left: rect.left, right: rect.right })),
      };
    });
    if (layout.scrollWidth > width) throw new Error(`${width}: horizontal overflow ${layout.scrollWidth}/${width}`);
    if (!layout.card || layout.card.left < 14 || layout.card.right > width - 14) throw new Error(`${width}: card escaped content margins`);
    if (layout.items.length !== 2 || layout.items.some((item) => item.left < 14 || item.right > width - 14)) throw new Error(`${width}: item escaped content margins`);
    if (layout.items[0].bottom >= layout.items[1].top) throw new Error(`${width}: action items overlap`);
    if (layout.footerButtons.length !== 2 || layout.footerButtons[0].right > layout.footerButtons[1].left) throw new Error(`${width}: card footer actions overlap`);

    const wellbeing = page.locator('[data-profile-wellbeing]');
    await wellbeing.waitFor();
    const trendLayout = await wellbeing.evaluate((node) => {
      const chart = node.querySelector('.profile-wellbeing-chart')?.getBoundingClientRect();
      const summary = node.querySelector('summary')?.getBoundingClientRect();
      return { chart: chart && { left: chart.left, right: chart.right }, summary: summary && { left: summary.left, right: summary.right } };
    });
    if (!trendLayout.chart || trendLayout.chart.left < 14 || trendLayout.chart.right > width - 14) throw new Error(`${width}: wellbeing chart escaped content margins`);
    if (!trendLayout.summary || trendLayout.summary.left < 14 || trendLayout.summary.right > width - 14) throw new Error(`${width}: wellbeing summary escaped content margins`);
    await wellbeing.locator('summary').click();
    if (!(await wellbeing.locator('details').evaluate((node) => node.hasAttribute('open')))) throw new Error(`${width}: wellbeing conclusions did not expand`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(`${width}: expanded wellbeing caused horizontal overflow`);
    await wellbeing.locator('summary').click();

    const trigger = page.locator('[data-profile-journey-action="add-document"]');
    await trigger.click();
    const dialog = page.locator('.profile-document-dialog');
    await dialog.waitFor();
    const sheet = await page.evaluate(() => {
      const dialogNode = document.querySelector('.profile-document-dialog');
      const rect = document.querySelector('[data-slot="sheet-content"]')?.getBoundingClientRect();
      const fields = [...document.querySelectorAll('.profile-life-document-form [data-slot="field"]')].map((node) => node.getBoundingClientRect());
      const nativeFileInput = document.querySelector('.document-file-drop input[type="file"]');
      const fileDrop = document.querySelector('.document-file-drop')?.getBoundingClientRect();
      return {
        focusInside: Boolean(dialogNode?.contains(document.activeElement)),
        rect: rect && { left: rect.left, right: rect.right, bottom: rect.bottom },
        fields: fields.map((field) => ({ top: field.top, left: field.left })),
        nativeFileInputHidden: nativeFileInput ? getComputedStyle(nativeFileInput).position === 'absolute' && getComputedStyle(nativeFileInput).opacity === '0' && getComputedStyle(nativeFileInput).clipPath !== 'none' : false,
        fileDrop: fileDrop && { left: fileDrop.left, right: fileDrop.right },
      };
    });
    if (!sheet.focusInside) throw new Error(`${width}: focus did not move into sheet`);
    if (!sheet.rect || sheet.rect.left < 0 || sheet.rect.right > width || Math.abs(sheet.rect.bottom - 844) > 1) throw new Error(`${width}: sheet escaped viewport`);
    if (sheet.fields.some((field, index) => index > 0 && field.top <= sheet.fields[index - 1].top)) throw new Error(`${width}: form fields are not in a stable single column`);
    if (!sheet.nativeFileInputHidden) throw new Error(`${width}: native file control is still visible`);
    if (!sheet.fileDrop || sheet.fileDrop.left < 18 || sheet.fileDrop.right > width - 18) throw new Error(`${width}: file drop escaped sheet margins`);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.matches('[data-profile-journey-action="add-document"]'));
    if (!(await trigger.evaluate((node) => node === document.activeElement))) throw new Error(`${width}: focus did not return to trigger`);
    await page.close();
  }
  console.log('profile layout smoke: ok (320, 390)');
} finally {
  await browser.close();
}
