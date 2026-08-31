import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3101';
const outDir = process.env.OUT_DIR || 'artifacts/voice-observation-ui';
await fs.mkdir(outDir, { recursive: true });

const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', size: 'средняя',
  vaccineStatus: 'актуально', parasiteStatus: 'скоро нужно', socialMode: 'сначала спросить',
  energyLevel: 'активный', temperament: 'нежная, любопытная', triggers: 'самокаты, резкий шум',
  neighborhood: 'Сокол', photos: [], selectedStyle: 'city', backendPetId: 'guest-pet-voice', isPublic: false,
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const results = [];
try {
  for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    let transcriptionMode = 'success';
    await page.route('**/api/stt/transcribe', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (transcriptionMode === 'error') {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'STT_PROVIDER_UNAVAILABLE' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ transcript: 'Мята сегодня больше спит со вчера, но ест как обычно.', durationSeconds: 4 }) });
    });
    await page.route('**/api/observations/extract', async (route) => {
      const body = route.request().postDataJSON();
      const candidates = String(body.transcript).includes('большого дерева') ? [] : [
        { id: `${body.captureId}:energy`, captureId: body.captureId, petId: body.petId, metric: 'energy', value: 'спит больше обычного', direction: 'down', observedAt: body.observedAt, onsetAt: body.observedAt, authorId: 'owner', source: body.source, confidence: .92, transcriptSpan: 'больше спит со вчера', confirmed: false },
        { id: `${body.captureId}:appetite`, captureId: body.captureId, petId: body.petId, metric: 'appetite', value: 'как обычно', direction: 'stable', observedAt: body.observedAt, onsetAt: body.observedAt, authorId: 'owner', source: body.source, confidence: .9, transcriptSpan: 'ест как обычно', confirmed: false },
      ];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates, decisions: candidates.map((candidate) => ({ candidateId: candidate.id, operation: 'create', analyticsEligible: true, reason: 'no_comparable_observation' })) }) });
    });
    await page.context().grantPermissions(['microphone'], { origin: base });
    let transcriptionRequests = 0;
    page.on('request', (request) => { if (request.url().includes('/api/stt/transcribe')) transcriptionRequests += 1; });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate((storedProfile) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
    }, profile);
    await page.reload({ waitUntil: 'networkidle' });

    const capture = page.locator('.voice-observation-capture');
    async function assertActivePhase(phase) {
      await capture.locator(`.voice-capture-${phase}`).waitFor();
      await page.waitForFunction(() => document.querySelector('.phone-shell')?.classList.contains('voice-capture-active'));
      const geometry = await page.evaluate(() => {
        const shell = document.querySelector('.phone-shell');
        const nav = document.querySelector('.app-tabs');
        const captureElement = document.querySelector('.voice-observation-capture');
        const rect = captureElement?.getBoundingClientRect();
        return {
          activeClass: shell?.classList.contains('voice-capture-active'),
          navigationHidden: nav ? getComputedStyle(nav).display === 'none' : true,
          captureBottom: rect?.bottom ?? 0,
          viewportHeight: innerHeight,
        };
      });
      if (!geometry.activeClass || !geometry.navigationHidden) throw new Error(`${viewport.width}: ${phase} phase does not suppress bottom navigation`);
      if (geometry.captureBottom > geometry.viewportHeight + 1) throw new Error(`${viewport.width}: ${phase} phase is clipped below the viewport`);
    }
    await capture.waitFor();
    await capture.getByText('Аудио отправится сервису распознавания и не сохранится в Псё.', { exact: true }).waitFor();
    await capture.getByRole('button', { name: 'Записать голосом' }).click();
    await assertActivePhase('recording');
    await capture.getByRole('button', { name: 'Закрыть голосовой ввод' }).click();
    await capture.locator('.voice-capture-input').waitFor();
    await page.waitForTimeout(400);
    if (transcriptionRequests !== 0) throw new Error(`${viewport.width}: cancelling a recording sent audio`);
    await capture.getByRole('button', { name: 'Записать голосом' }).click();
    await capture.getByRole('button', { name: 'Остановить' }).click();
    await assertActivePhase('progress');
    await capture.getByLabel('Проверь расшифровку').waitFor();
    const reviewNavigation = await page.evaluate(() => ({
      activeClass: document.querySelector('.phone-shell')?.classList.contains('voice-capture-active'),
      navigationHidden: getComputedStyle(document.querySelector('.app-tabs')).display === 'none',
    }));
    if (!reviewNavigation.activeClass || !reviewNavigation.navigationHidden) throw new Error(`${viewport.width}: review phase does not suppress bottom navigation`);
    await capture.getByRole('button', { name: 'Разобрать на показатели' }).click();
    await capture.getByText('Энергия', { exact: true }).waitFor();
    await capture.getByText('Аппетит', { exact: true }).waitFor();
    await capture.getByText('Без заметки', { exact: true }).waitFor();
    const noteChoice = capture.getByRole('checkbox', { name: /Сохранить ещё и приватную заметку/ });
    await noteChoice.waitFor();
    if (await noteChoice.isChecked()) throw new Error(`${viewport.width}: private note must be opt-in`);
    await noteChoice.check();
    await capture.getByText('1 приватная заметка', { exact: true }).waitFor();
    await capture.getByText('Будет сохранено:', { exact: false }).waitFor();
    await capture.getByText('Новая запись', { exact: false }).first().waitFor();
    await capture.locator('.voice-capture-facts input').first().fill('спит заметно больше обычного');

    const metrics = await page.evaluate(() => {
      const captureElement = document.querySelector('.voice-observation-capture');
      const controls = [...captureElement.querySelectorAll('button,textarea')].map((element) => {
        const rect = element.getBoundingClientRect();
        return { label: element.getAttribute('aria-label') || element.textContent?.trim(), width: rect.width, height: rect.height };
      });
      const textarea = captureElement.querySelector('textarea');
      return {
        viewport: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        inputFontSize: Number.parseFloat(getComputedStyle(textarea).fontSize),
        smallControls: controls.filter((control) => control.width > 0 && control.height > 0 && (control.width < 44 || control.height < 44)),
        navigationHidden: getComputedStyle(document.querySelector('.app-tabs')).display === 'none',
      };
    });
    if (metrics.scrollWidth > metrics.viewport) throw new Error(`${viewport.width}: horizontal overflow`);
    if (metrics.inputFontSize < 16) throw new Error(`${viewport.width}: input font triggers iOS zoom`);
    if (metrics.smallControls.length) throw new Error(`${viewport.width}: small controls ${JSON.stringify(metrics.smallControls)}`);
    if (!metrics.navigationHidden) throw new Error(`${viewport.width}: bottom navigation overlaps the active capture flow`);
    results.push(metrics);
    await page.screenshot({ path: `${outDir}/review-${viewport.width}.png`, fullPage: false });
    await capture.getByLabel('Проверь расшифровку').fill('Мы славно погуляли около большого дерева.');
    await capture.getByRole('button', { name: 'Разобрать на показатели' }).click();
    await capture.getByText('Показатели не найдены', { exact: true }).waitFor();
    await capture.getByText('Ничего не сохранено.', { exact: false }).waitFor();
    await capture.getByRole('button', { name: 'Закрыть голосовой ввод' }).click();
    transcriptionMode = 'error';
    await capture.getByRole('button', { name: 'Записать голосом' }).click();
    await capture.getByRole('button', { name: 'Остановить' }).click();
    await capture.locator('.voice-capture-error').waitFor();
    const errorNavigation = await page.evaluate(() => ({
      activeClass: document.querySelector('.phone-shell')?.classList.contains('voice-capture-active'),
      navigationHidden: getComputedStyle(document.querySelector('.app-tabs')).display === 'none',
    }));
    if (!errorNavigation.activeClass || !errorNavigation.navigationHidden) throw new Error(`${viewport.width}: error phase does not suppress bottom navigation`);
    await page.close();
  }
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  await browser.close();
}
