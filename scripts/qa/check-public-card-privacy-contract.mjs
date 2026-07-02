#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  css: readFileSync('app/globals.css', 'utf8'),
  dogCard: readFileSync('app/dog/[slug]/page.tsx', 'utf8'),
};

const failures = [];

for (const token of [
  "type PublicCardFieldKey = 'breed' | 'character' | 'triggers' | 'area'",
  'defaultPublicCardFields',
  'publicCardFieldOptions',
  'publicCardVisibleFields',
  'togglePublicCardField',
  'aria-label="Что показать в памятке"',
  'Точный адрес, контакты владельца, лекарства и внутренние заметки сюда не попадают',
]) {
  if (!files.page.includes(token)) failures.push(`public card owner field controls missing: ${token}`);
}

for (const token of [
  "triggers: show('triggers') ?",
  "area: show('area') ? safePublicArea(profile.neighborhood) : 'район скрыт'",
  "character: show('character') ?",
  "breed: show('breed') ?",
]) {
  if (!files.page.includes(token)) failures.push(`public card share params do not honor field controls: ${token}`);
}

for (const token of ['.public-card-fields-panel', '.public-card-fields-panel button.active']) {
  if (!files.css.includes(token)) failures.push(`public card field controls CSS missing: ${token}`);
}

for (const token of [
  "const image = /^(https?:\\/\\/|data:image\\/(png|jpe?g|webp);base64,)/i.test(rawImage) ? rawImage : '';",
  "const area = cleanDisplay(read('area', 'район скрыт'), 'район скрыт');",
]) {
  if (!files.dogCard.includes(token)) failures.push(`public dog card page missing safe reader token: ${token}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('public card privacy contract ok');
