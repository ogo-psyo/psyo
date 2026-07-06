#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const uiFiles = {
  page: readFileSync('app/page.tsx', 'utf8'),
  avatar: readFileSync('components/GeneratedAvatar.tsx', 'utf8'),
  dogCard: readFileSync('app/dog/[slug]/page.tsx', 'utf8'),
  dogCardActions: readFileSync('app/dog/[slug]/DogCardActions.tsx', 'utf8'),
  mapClient: readFileSync('components/LiveMapClient.tsx', 'utf8'),
};
const designDirection = readFileSync('DESIGN_DIRECTION.md', 'utf8');
const failures = [];

const forbiddenVisibleSnippets = [
  ['magic-link', 'owner app must not expose email auth wording'],
  ['письма со входом', 'owner app must not offer email auth as a primary scenario'],
  ['care loop', 'care flow must say "план ухода"'],
  ['care-passport', 'passport copy must be Russian owner language'],
  ['Avatar собаки', 'avatar copy must say "портрет" or "фото"'],
  ['DEMO', 'demo copy must say "пример"'],
  ['Stories', 'share format must be localized'],
  ['Post', 'share format must be localized'],
  ['Poster', 'share format must be localized'],
  ['GPS', 'map privacy copy must say "точный адрес" or "примерное место"'],
  ['Выбрана точка:', 'map must not expose raw coordinates'],
  ['{pickedZonePoint.lat}', 'map must not expose latitude'],
  ['{pickedZonePoint.lng}', 'map must not expose longitude'],
  ['Думаю...', 'loading copy must use the ellipsis character'],
  ['Отправляю...', 'loading copy must use the ellipsis character'],
  ['не загрузилось в Supabase', 'errors must not name infrastructure'],
  ['Не удалось сохранить в базу', 'errors must not name storage implementation'],
  ['Фото показано локально', 'errors must not use technical storage wording'],
];

for (const [name, content] of Object.entries(uiFiles)) {
  for (const [snippet, reason] of forbiddenVisibleSnippets) {
    if (content.includes(snippet)) failures.push(`${name}: ${reason}: ${snippet}`);
  }
}

const requiredDesignKitTokens = [
  'UX/UI design kit contract',
  'Warm Companion OS',
  'Пиши, сокращай',
  'One primary action per surface',
  'Touch targets stay at least 44 px',
  'Do not show technical words in primary UI',
];

for (const token of requiredDesignKitTokens) {
  if (!designDirection.includes(token)) failures.push(`DESIGN_DIRECTION.md missing design-kit rule: ${token}`);
}

const requiredHumanCopy = [
  'Демо без входа',
  'Личный профиль, Plus и сохранение включаются только внутри Telegram Mini App',
  'Портрет собаки',
  'пример памятки',
  'Примерное место выбрано',
  'Сделать портрет',
];

const allUi = Object.values(uiFiles).join('\n');
for (const token of requiredHumanCopy) {
  if (!allUi.includes(token)) failures.push(`human-readable UI copy missing: ${token}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('ui copy/design-kit contract ok');
