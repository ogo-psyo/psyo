import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const componentPaths = [
  'components/social/SocialProfileSheet.tsx',
  'components/social/CandidateCard.tsx',
  'components/social/RequestsPanel.tsx',
  'components/social/CityCommunities.tsx',
];
for (const path of componentPaths) {
  assert.equal(existsSync(resolve(root, path)), true, `${path} ещё не реализован`);
}

const page = read('app/page.tsx');
const css = read('app/globals.css');
const profile = read('components/social/SocialProfileSheet.tsx');
const candidate = read('components/social/CandidateCard.tsx');
const requests = read('components/social/RequestsPanel.tsx');
const communities = read('components/social/CityCommunities.tsx');

assert.match(page, /<CityCommunities[\s\S]*communities=/, 'городские сообщества должны быть видны даже без собаки');
assert.match(page, /<SocialProfileSheet/, 'в «рядом» должна быть форма добровольной анкеты');
assert.match(page, /socialCandidates\.nearby\.length[\s\S]*<h3>Рядом<\/h3>[\s\S]*socialCandidates\.nearby\.map/, 'кандидаты до 15 км должны идти отдельной группой');
assert.match(page, /socialCandidates\.city\.length[\s\S]*<h3>В вашем городе<\/h3>[\s\S]*socialCandidates\.city\.map/, 'городской fallback должен идти отдельной группой');
assert.match(page, /socialInvite/, 'входящая ссылка-приглашение должна обрабатываться в интерфейсе');
assert.match(page, /<RequestsPanel/, 'запросы и взаимное согласие должны быть доступны в интерфейсе');

assert.match(profile, /Показать собаку/);
assert.match(profile, /Скрыть анкету/);
assert.match(profile, /случк/i, 'случка должна оставаться сценарием внутри «рядом»');
assert.doesNotMatch(profile, /telegramUsername|telegram_username/, 'контакт нельзя вводить вручную');

assert.match(candidate, /Отправить запрос/);
assert.match(candidate, /Ожидает ответа/);
assert.doesNotMatch(candidate, /score|точн(?:ые|ая) координат/i, 'карточка не должна показывать score или координаты');

assert.match(requests, /Принять/);
assert.match(requests, /Отклонить/);
assert.match(requests, /Открыть чат/);
assert.match(requests, /Заблокировать/);
assert.match(requests, /Пожаловаться/);
assert.match(requests, /telegramContactUrl/, 'чат открывается только по проверенному URL от сервера');

assert.match(communities, /communities\.length === 0[\s\S]*return null/, 'без настроенных ссылок нельзя показывать фальшивые сообщества');
assert.doesNotMatch(communities, /t\.me\//, 'компонент не должен содержать захардкоженные Telegram-ссылки');

assert.match(css, /\.social-nearby-shell\s*\{[\s\S]*min-width:\s*0/, 'контейнер должен сжиматься на 390px');
assert.match(css, /overflow-wrap:\s*anywhere/, 'длинные имена должны переноситься без горизонтального скролла');
assert.match(css, /@media\s*\(max-width:\s*390px\)[\s\S]*\.social-candidate-card/, 'должен быть явный layout для 390px');

console.log('nearby UI smoke: PASS');
