import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:3101';
const output = process.env.OUTPUT_DIR || '/tmp';
const profile = {
  dogName: 'Очень Длинное Имя Собаки', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'актуально', socialMode: 'сначала спросить', energyLevel: 'спокойная',
  photos: [], selectedStyle: 'city', avatarImageUrl: '', avatarSource: 'none', backendPetId: 'guest-avatar-layout',
};

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.route('**/api/app/bootstrap*', async (route) => {
      const pet = { id: profile.backendPetId, owner_id: 'owner-a', name: profile.dogName, breed_id: 'mixed', breed_group_id: 'mixed', avatar_source: 'none', photo_urls: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        mode: 'demo', connected: true, activePetId: pet.id, pet, pets: [pet], passport: {}, social: {},
        reminders: [], zones: [], routes: [], wishlist: [], observations: [], documents: [],
        avatarCapabilities: { identityEnabled: true, uploadsEnabled: true, generationEnabled: true, providerReady: true },
      }) });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate((storedProfile) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
    }, profile);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.app-tabs button[data-route="profile"]').click({ force: true });
    await page.locator('[data-production-journey="profile"]').waitFor();
    await page.getByRole('button', { name: 'Изменить' }).first().click();
    await page.locator('#dog-identity-title').waitFor({ state: 'attached' });
    const details = page.locator('details').filter({ hasText: 'Фото и заметки' });
    await details.locator('summary').click();
    await page.locator('#dog-identity-title').waitFor();
    await page.locator('.dog-identity-editor').scrollIntoViewIfNeeded();

    const result = await page.locator('.dog-identity-editor').evaluate((node) => {
      const controls = [...node.querySelectorAll('button, textarea, input:not([type="file"]):not([type="checkbox"]), label.identity-source-action')];
      const undersized = controls.map((control) => {
        const rect = control.getBoundingClientRect();
        return { text: control.textContent?.trim().slice(0, 60), width: rect.width, height: rect.height };
      }).filter((item) => item.width < 44 || item.height < 44);
      const fontSizes = [...node.querySelectorAll('textarea, input[type="text"]')].map((input) => parseFloat(getComputedStyle(input).fontSize));
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        sourceActions: node.querySelectorAll('.identity-source-action').length,
        hasUnexpectedImage: Boolean(node.querySelector('img[src*="demo-avatar"]')),
        undersized,
        fontSizes,
      };
    });
    if (result.documentWidth > result.viewportWidth) throw new Error(`${width}: horizontal overflow ${result.documentWidth}/${result.viewportWidth}`);
    if (result.sourceActions !== 3) throw new Error(`${width}: identity source choice is incomplete`);
    if (result.hasUnexpectedImage) throw new Error(`${width}: demo avatar leaked into empty identity`);
    if (result.undersized.length) throw new Error(`${width}: undersized controls ${JSON.stringify(result.undersized)}`);
    if (result.fontSizes.some((size) => size < 16)) throw new Error(`${width}: an editable input can trigger iOS zoom`);

    const fileInput = page.locator('.identity-source-action input[type="file"]');
    await fileInput.focus();
    const focusVisible = await fileInput.locator('..').evaluate((label) => getComputedStyle(label).outlineStyle !== 'none');
    if (!focusVisible) throw new Error(`${width}: upload choice has no visible keyboard focus`);

    await page.getByRole('button', { name: /Создать образ/ }).first().click();
    await page.locator('#avatar-owner-prompt').waitFor();
    const honestyCopy = await page.getByText(/художественный образ.*не точная копия/i).isVisible();
    if (!honestyCopy) throw new Error(`${width}: text-only generation lacks likeness honesty copy`);

    await page.screenshot({ path: `${output}/avatar-identity-${width}.png`, fullPage: true });
    await page.close();
  }
  console.log('avatar identity UI smoke: ok (320, 390)');
} finally {
  await browser.close();
}
