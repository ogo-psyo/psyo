#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const page = read('app/page.tsx');
const nav = read('components/app/AppNavigation.tsx');
const today = read('lib/today.ts');
const careNotice = read('components/care/CareActionNotice.tsx');
const deleteDialog = read('components/care/DeleteCareDialog.tsx');
const desktopContext = read('components/app/DesktopContextPanel.tsx');
const nextCareCard = read('components/today/NextCareCard.tsx');
const observationDisclosure = read('components/today/ObservationDisclosure.tsx');
const onboarding = read('components/onboarding/CoreOnboarding.tsx');
const css = read('app/globals.css');
const failures = [];

for (const token of ['buildTodayCareView', "'empty'", "'overdue'", "'today'", "'upcoming'", "'complete'"]) {
  if (!today.includes(token)) failures.push(`TodayService contract missing: ${token}`);
}

for (const token of ['Сегодня', 'План', 'Памятка', 'Профиль']) {
  if (!nav.includes(token)) failures.push(`primary navigation missing: ${token}`);
}

for (const token of ['phoneShellRef', 'scrollTo({ top: 0']) {
  if (!page.includes(token)) failures.push(`navigation scroll reset missing: ${token}`);
}

for (const token of ['Готово:', 'Отменить', 'aria-live="polite"']) {
  if (!careNotice.includes(token)) failures.push(`care feedback missing: ${token}`);
}

for (const token of ['Удалить дело?', 'role="dialog"', 'Отмена']) {
  if (!deleteDialog.includes(token)) failures.push(`delete recovery missing: ${token}`);
}

for (const token of ['prefers-reduced-motion', ':focus-visible', 'min-height: 44px']) {
  if (!css.includes(token)) failures.push(`cross-device accessibility rule missing: ${token}`);
}

for (const token of ['Ближайшее дело', 'История ухода', 'Памятка', 'desktop-context-panel']) {
  if (!desktopContext.includes(token)) failures.push(`desktop context missing: ${token}`);
}

for (const token of ['@media (min-width: 768px)', '@media (min-width: 1024px)', 'max-width: 1360px', 'grid-template-areas']) {
  if (!css.includes(token)) failures.push(`responsive shell missing: ${token}`);
}

for (const token of ['.app-canvas.onboarding-canvas', '"copy preview"', 'ipad-portrait-820', 'ipad-landscape-1180']) {
  if (!(css + read('scripts/qa/design-screenshots.mjs')).includes(token)) failures.push(`tablet onboarding coverage missing: ${token}`);
}

for (const token of ['today-first-viewport', 'Сегодня с', 'Открыть план']) {
  if (!nextCareCard.includes(token)) failures.push(`focused Today missing: ${token}`);
}

for (const token of ['<details', 'Записать наблюдение', 'Последние записи']) {
  if (!observationDisclosure.includes(token)) failures.push(`observation disclosure missing: ${token}`);
}

for (const token of ['шаг 1 из 2', 'шаг 2 из 2', 'Назад', 'Добавить дело и открыть Сегодня', 'dog-photo-help', 'Выбрать фото', 'Файл не выбран']) {
  if (!onboarding.includes(token)) failures.push(`onboarding contract missing: ${token}`);
}

if (page.includes('Имя, правило и первое дело')) failures.push('onboarding still overloads one step');
const todayStart = page.indexOf("{tab === 'today'");
const todayEnd = page.indexOf("{tab === 'assistant'", todayStart);
const todayBlock = todayStart >= 0 && todayEnd > todayStart ? page.slice(todayStart, todayEnd) : '';
if (todayBlock.includes('className="plus-gate-card"')) {
  failures.push('Today still contains a Plus promotion');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('core loop UX contract ok');
