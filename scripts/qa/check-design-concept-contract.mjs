#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  css: readFileSync('app/globals.css', 'utf8'),
  direction: readFileSync('DESIGN_DIRECTION.md', 'utf8'),
};

const failures = [];

for (const token of [
  'Living Companion OS',
  'cream/mint botanical base',
  'large dog identity/status card',
  'simple daily action card',
]) {
  if (!files.direction.includes(token)) failures.push(`DESIGN_DIRECTION.md missing concept token: ${token}`);
}

for (const token of [
  'UI/UX kit alignment 2026-06-25',
  '--bg: #F5F7F2',
  '--surface: #FFFFFF',
  '--ink: #19231D',
  '--muted: #7A837C',
  '--coral: #5E9F74',
  '--surface-quiet: #EAF5ED',
  '.kit-hero-card',
  '.kit-next-card',
  '.app-header .telegram-pill',
]) {
  if (!files.css.includes(token)) failures.push(`globals.css missing kit-alignment token: ${token}`);
}

const heroIndex = files.page.indexOf('className="kit-hero-card"');
const nextIndex = files.page.indexOf('className={`kit-next-card');
const actionsIndex = files.page.indexOf('className="kit-daily-status action-first"');
if (heroIndex < 0 || nextIndex < 0 || actionsIndex < 0) {
  failures.push('page.tsx missing Today hierarchy markers: kit hero, next card, action tiles');
} else if (!(heroIndex < nextIndex && nextIndex < actionsIndex)) {
  failures.push('Today hierarchy must be dog status card -> primary next step -> action tiles');
}

for (const token of [
  'план ухода и памятка',
  'ближайший шаг',
  'Памятка',
]) {
  if (!files.page.includes(token)) failures.push(`page.tsx missing concept copy: ${token}`);
}

const navStart = files.page.indexOf('<nav className="app-tabs"');
const navEnd = files.page.indexOf('</nav>', navStart);
const navBlock = navStart >= 0 && navEnd > navStart ? files.page.slice(navStart, navEnd) : '';
for (const section of ['Главная', 'План', 'Ассистент', 'Рядом', 'Карта', 'Памятка', 'Профиль']) {
  if (!navBlock.includes(section)) failures.push(`primary nav must keep section: ${section}`);
}

for (const forbidden of [
  'режим предпросмотра',
  'Псё · Telegram Mini App</p>',
]) {
  if (files.page.includes(forbidden)) failures.push(`page.tsx still exposes non-kit header copy: ${forbidden}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('design concept contract ok');
