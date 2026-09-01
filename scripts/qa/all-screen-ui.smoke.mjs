import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://localhost:3102';
const outDir = process.env.OUT_DIR || 'artifacts/pso-all-screen';
await fs.mkdir(outDir, { recursive: true });

const profile = {
  dogName: 'Мята', breedId: 'mixed', breedGroupId: 'mixed', lifeStage: 'взрослая', age: '4 года', sex: 'девочка',
  size: 'средняя', energyLevel: 'активная', neighborhood: 'Сокол', photos: [], selectedStyle: 'city',
  backendPetId: 'guest-pet-all-screen', isPublic: false,
};
const observations = [
  { id: 'o1', createdAt: '2026-08-25T09:00:00.000Z', mood: 'спокойное', appetite: 'обычный', stool: 'обычный', energy: 'как обычно' },
  { id: 'o2', createdAt: '2026-08-28T09:00:00.000Z', mood: 'тревожное', appetite: 'меньше', stool: 'мягкий', energy: 'ниже' },
  { id: 'o3', createdAt: '2026-09-01T09:00:00.000Z', mood: 'радостное', appetite: 'хороший', stool: 'обычный', energy: 'бодрая' },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of [{ width: 320, height: 720, name: 'narrow' }, { width: 390, height: 844, name: 'mobile' }, { width: 1280, height: 900, name: 'desktop' }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ storedProfile, storedObservations }) => {
      localStorage.setItem('pso.topapp.onboarding.v1', 'done');
      localStorage.setItem('pso.product.profile.v5', JSON.stringify(storedProfile));
      localStorage.setItem(`pso.topapp.observations.v2:${storedProfile.backendPetId}`, JSON.stringify(storedObservations));
    }, { storedProfile: profile, storedObservations: observations });
    await page.reload({ waitUntil: 'networkidle' });

    const persisted = await page.evaluate(() => ({
      profile: JSON.parse(localStorage.getItem('pso.product.profile.v5') || '{}'),
      observationKeys: Object.keys(localStorage).filter((key) => key.startsWith('pso.topapp.observations.v2:')),
    }));
    if (!persisted.profile.backendPetId) throw new Error('guest profile lost its pet id during bootstrap');
    const activeObservationKey = `pso.topapp.observations.v2:${persisted.profile.backendPetId}`;
    await page.evaluate(({ key, storedObservations }) => localStorage.setItem(key, JSON.stringify(storedObservations)), { key: activeObservationKey, storedObservations: observations });
    await page.reload({ waitUntil: 'networkidle' });

    const screen = page.locator('[data-production-journey="today"]');
    await screen.waitFor();
    const ordered = await screen.locator('[data-all-profile], [data-all-scenarios], [data-all-observation-trends]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-all-profile') !== null ? 'profile' : node.getAttribute('data-all-scenarios') !== null ? 'scenarios' : 'trends'));
    if (ordered.join(',') !== 'profile,scenarios,trends') throw new Error(`wrong block order: ${ordered.join(',')}`);
    if (await page.locator('[data-observation-timeline] .all-observation-row').count() !== 4) throw new Error('expected four observation rows on one timeline');
    if (await page.locator('[data-observation-timeline] .all-observation-track path').count() !== 4) throw new Error(`real observation data was not rendered; persisted keys: ${persisted.observationKeys.join(',')}`);
    if (!await page.locator('.all-observation-summary').getByText('В последней записи меньше отклонений').isVisible()) throw new Error('observation summary does not explain the latest comparison');
    if (!await page.locator('.all-observation-row').first().getByText('Ближе к обычному').isVisible()) throw new Error('metric comparison does not use the shared ordinary-state baseline');
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    if (layout.scrollWidth > layout.width) throw new Error(`horizontal overflow ${layout.scrollWidth}/${layout.width}`);

    await page.getByRole('button', { name: /Изменилось самочувствие/ }).click();
    await page.locator('[data-scenario-workspace="health"]').waitFor();
    await page.locator('[data-all-scenarios]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${outDir}/${viewport.name}-scenario.png`, fullPage: false });
    await page.getByRole('button', { name: /Записать наблюдение/ }).click();
    await page.locator('.all-scenario-capture .voice-observation-capture').waitFor();
    await page.getByRole('button', { name: /Открыть профиль Мята в Псё/ }).click();
    await page.locator('[data-profile-memory]').waitFor();
    await page.locator('.app-tabs button[data-route="today"]').click({ force: true });
    await screen.waitFor();

    await page.screenshot({ path: `${outDir}/${viewport.name}.png`, fullPage: false });
    if (viewport.name === 'mobile') {
      await page.locator('[data-all-observation-trends]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${outDir}/mobile-trends.png`, fullPage: false });
    }
    await page.close();
  }
  console.log(JSON.stringify({ ok: true, blocks: ['profile', 'scenarios', 'trends'], timelineRows: 4, scenarioWorkspace: true, scenarioCapture: true, profileNavigation: true }, null, 2));
} finally {
  await browser.close();
}
