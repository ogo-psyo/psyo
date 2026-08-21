import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://127.0.0.1:3101';
const output = process.env.OUTPUT_DIR || '/tmp';
const profile = {
  dogName: 'Очень Длинное Имя Собаки', breedId: 'xoloitzcuintli', breedGroupId: 'primitive', age: '3 года', lifeStage: 'взрослая', sex: 'кобель',
  weight: '8,4 кг', size: 'средний', coatType: 'почти без шерсти', colorMarks: 'белое пятно на груди', microchip: '',
  vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить', energyLevel: 'активный', temperament: 'осторожный, но любопытный',
  trainability: 'быстро схватывает', playStyle: 'нюховые игры', childFriendly: 'осторожно', dogFriendly: 'только спокойные собаки', catFriendly: 'не знаю',
  triggers: 'самокаты и громкие пакеты', allergies: 'курица', medication: '', healthNotes: '', bio: 'Любит искать запахи', habits: [], photos: [], selectedStyle: 'city', avatarImageUrl: '/demo-avatar.png', avatarSource: 'uploaded', backendPetId: '11111111-1111-4111-8111-111111111111',
};

const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.route('**/api/app/bootstrap*', async (route) => {
      const pet = { id: profile.backendPetId, owner_id: 'owner-a', name: profile.dogName, breed_id: profile.breedId, breed_group_id: profile.breedGroupId, avatar_url: profile.avatarImageUrl, avatar_source: 'uploaded', photo_urls: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        mode: 'demo', connected: true, activePetId: pet.id, pet, pets: [pet],
        passport: { weight: profile.weight, allergies: profile.allergies, vaccine_status: profile.vaccineStatus, parasite_status: profile.parasiteStatus },
        social: { social_mode: profile.socialMode, triggers: [profile.triggers] }, reminders: [], zones: [], routes: [], wishlist: [], documents: [],
        observations: [{ id: 'observation-1', petId: pet.id, appetite: 'ниже обычного', energy: 'обычная', note: 'Ест меньше второй день', createdAt: new Date().toISOString() }],
        avatarCapabilities: { identityEnabled: true, uploadsEnabled: true, generationEnabled: false, providerReady: false },
      }) });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate((storedProfile) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
    }, profile);
    await page.reload({ waitUntil: 'networkidle' });
    const homeIdentity = page.getByRole('button', { name: /Изменить фото или образ/ });
    await homeIdentity.click();
    const homeIdentityDialog = page.locator('dialog[open]');
    await homeIdentityDialog.waitFor();
    if (!(await homeIdentityDialog.getByText('Использовать фото').isVisible())) throw new Error(`${width}: home portrait did not open identity chooser`);
    await page.keyboard.press('Escape');
    await homeIdentityDialog.waitFor({ state: 'hidden' });
    await page.locator('.app-tabs button[data-route="profile"]').click({ force: true });
    const workspace = page.locator('[data-profile-memory]');
    await workspace.waitFor();

    const overview = await workspace.evaluate((node) => {
      const controls = [...node.querySelectorAll('button, summary')].map((control) => {
        const rect = control.getBoundingClientRect();
        return { width: rect.width, height: rect.height, text: control.textContent?.trim().slice(0, 50) };
      });
      return { scrollWidth: document.documentElement.scrollWidth, viewport: window.innerWidth, controls, surface: node.getAttribute('data-surface') };
    });
    if (overview.surface !== 'overview') throw new Error(`${width}: profile did not open on overview`);
    if (overview.scrollWidth > overview.viewport) throw new Error(`${width}: horizontal overflow ${overview.scrollWidth}/${overview.viewport}`);
    const undersized = overview.controls.filter((item) => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44));
    if (undersized.length) throw new Error(`${width}: undersized overview controls ${JSON.stringify(undersized)}`);
    await page.screenshot({ path: `${output}/profile-memory-overview-${width}.png`, fullPage: true });

    await page.getByRole('button', { name: /Здоровье/ }).first().click();
    await page.getByRole('heading', { name: 'Здоровье', exact: true }).waitFor();
    if (await workspace.getAttribute('data-surface') !== 'health') throw new Error(`${width}: health drill-down did not open`);
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(`${width}: health caused horizontal overflow`);
    await page.screenshot({ path: `${output}/profile-memory-health-${width}.png`, fullPage: true });

    const healthEditorTrigger = page.getByRole('button', { name: /Изменить постоянные данные/ }).last();
    await healthEditorTrigger.scrollIntoViewIfNeeded();
    await healthEditorTrigger.click();
    const profileEditor = page.locator('dialog[aria-labelledby="profile-editor-title"]');
    await profileEditor.waitFor();
    if (!(await profileEditor.evaluate((node) => node.contains(document.activeElement)))) throw new Error(`${width}: profile editor did not receive focus`);
    await page.screenshot({ path: `${output}/profile-memory-editor-${width}.png`, fullPage: true });
    const allergyInput = profileEditor.getByLabel('Аллергии и непереносимости');
    await allergyInput.fill('курица и индейка');
    if (Number.parseFloat(await allergyInput.evaluate((node) => getComputedStyle(node).fontSize)) < 16) throw new Error(`${width}: profile editor input can trigger iOS zoom`);
    await profileEditor.getByRole('button', { name: 'Сохранить' }).click();
    await profileEditor.waitFor({ state: 'hidden' });
    if (!(await healthEditorTrigger.evaluate((node) => node === document.activeElement))) throw new Error(`${width}: profile editor did not restore focus`);
    if (!(await page.getByText('курица и индейка', { exact: true }).isVisible())) throw new Error(`${width}: saved health data did not return to the new read view`);

    const documentTrigger = page.locator('[data-profile-memory-action="add-document"]');
    await documentTrigger.scrollIntoViewIfNeeded();
    await documentTrigger.click();
    const documentDialog = page.locator('.profile-document-dialog');
    await documentDialog.waitFor();
    if (!(await documentDialog.evaluate((node) => node.contains(document.activeElement)))) throw new Error(`${width}: document sheet did not receive focus`);
    await documentDialog.getByRole('button', { name: 'Закрыть' }).click();
    await documentDialog.waitFor({ state: 'detached' });
    if (!(await documentTrigger.evaluate((node) => node === document.activeElement))) throw new Error(`${width}: document sheet did not restore focus`);

    await page.getByRole('button', { name: 'Вернуться к обзору' }).click();
    await page.getByRole('button', { name: /Изменить фото или образ/ }).click();
    const identity = page.locator('dialog[open]');
    await identity.waitFor();
    const paths = await identity.getByText(/Использовать фото|Создать образ|Без изображения/).count();
    if (paths < 3) throw new Error(`${width}: identity chooser is incomplete`);
    if (!(await identity.getByText('Появится после подключения генератора изображений').isVisible())) throw new Error(`${width}: disabled generation is not honest`);
    const disabledGenerator = identity.getByLabel('Создание образа пока недоступно');
    if (!(await disabledGenerator.isVisible())) throw new Error(`${width}: unavailable generator is not visibly explained`);
    if (await disabledGenerator.evaluate((node) => ['BUTTON', 'SUMMARY', 'DETAILS'].includes(node.tagName))) throw new Error(`${width}: unavailable generator still looks interactive`);
    await page.keyboard.press('Escape');
    await identity.waitFor({ state: 'hidden' });

    await page.getByRole('button', { name: /Характер/ }).first().click();
    await page.getByRole('heading', { name: 'Характер', exact: true }).waitFor();
    const characterBeforeCancel = await workspace.locator('article h2').first().textContent();
    const characterTrigger = page.getByRole('button', { name: /Уточнить портрет/ });
    await characterTrigger.scrollIntoViewIfNeeded();
    await characterTrigger.click();
    await profileEditor.waitFor();
    await profileEditor.getByLabel('Темперамент').selectOption({ label: 'уверенный' });
    await page.keyboard.press('Escape');
    await profileEditor.waitFor({ state: 'hidden' });
    if (!(await characterTrigger.evaluate((node) => node === document.activeElement))) throw new Error(`${width}: character editor did not restore focus`);
    if (await workspace.locator('article h2').first().textContent() !== characterBeforeCancel) throw new Error(`${width}: cancel mutated the character read view`);
    if (await page.locator('[data-profile-memory]').count() !== 1) throw new Error(`${width}: new profile flow escaped into the legacy profile editor`);

    for (const [surfaceName, editorButtonName] of [['С окружающими', /Уточнить повадки/], ['Паспорт и внешность', /Изменить постоянные данные/]]) {
      await page.getByRole('button', { name: 'Вернуться к обзору' }).click();
      await page.getByRole('button', { name: new RegExp(surfaceName) }).first().click();
      await page.getByRole('heading', { name: surfaceName, exact: true }).waitFor();
      const editorTrigger = page.getByRole('button', { name: editorButtonName }).last();
      await editorTrigger.scrollIntoViewIfNeeded();
      await editorTrigger.click();
      await profileEditor.waitFor();
      await profileEditor.getByRole('button', { name: 'Закрыть редактор' }).click();
      await profileEditor.waitFor({ state: 'hidden' });
      if (!(await editorTrigger.evaluate((node) => node === document.activeElement))) throw new Error(`${width}: ${surfaceName} editor did not restore focus`);
    }
    const inputSizes = await workspace.locator('input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="tel"], input[type="number"], textarea').evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
    if (inputSizes.some((size) => size < 16)) throw new Error(`${width}: editable input can trigger iOS zoom`);
    await page.close();
  }
  console.log('profile memory layout smoke: ok (320, 390)');
} finally {
  await browser.close();
}
