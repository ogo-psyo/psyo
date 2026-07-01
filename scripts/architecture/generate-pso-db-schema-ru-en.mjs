#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'docs/pso-hld-soa-2026-06-24';
mkdirSync(outDir, { recursive: true });

const C = { bg: '#F7F1E8', paper: '#FFF8ED', white: '#FFFFFF', ink: '#201A16', muted: '#6E6258', line: '#D6C7B6', rust: '#E86F3A', green: '#5F8D5A', blue: '#4E6E91', lilac: '#BFA7EA' };
const esc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function wrap(value, max = 26) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const s = [];
function rect(x, y, w, h, fill = C.paper, stroke = C.line, rx = 18) {
  s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
}
function text(value, x, y, size = 18, fill = C.ink, weight = 500, max = 26, lh = 1.18) {
  s.push(`<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">`);
  wrap(value, max).forEach((line, i) => s.push(`<tspan x="${x}" dy="${i ? size * lh : 0}">${esc(line)}</tspan>`));
  s.push('</text>');
}

const rows = [
  ['Профиль владельца', 'Profile / profiles', 'Identity', 'Владелец и owner boundary', 'id, display_name, created_at'],
  ['Собака', 'Pet / pets', 'Dog Profile', 'Базовая identity собаки', 'owner_id, name, breed, avatar, public_slug'],
  ['Паспорт собаки', 'PetPassport / pet_passports', 'Dog Profile', 'Здоровье, уход, питание, вет заметки', 'vaccine_status, parasite_status, diet, allergies'],
  ['Социальный профиль', 'SocialProfile / social_profiles', 'Dog Profile', 'Как знакомиться и что учитывать рядом', 'social_mode, temperament, triggers, friendliness'],
  ['Напоминание', 'Reminder / reminders', 'Care Loop', 'Задача ухода с датой', 'type, title, due_at, recurrence, status'],
  ['Событие напоминания', 'ReminderEvent / reminder_events', 'Care Loop', 'История действий по care loop', 'event_type, payload, created_at'],
  ['Место / зона', 'MapZone / map_zones', 'Places', 'Примерные safe/risk/service места', 'type, title, approximate_lat/lng, radius'],
  ['Вещь / список нужного', 'WishlistItem / wishlist_items', 'Things', 'Корм, амуниция, лекарства, сервисы', 'category, reason, priority, status'],
  ['Тред ассистента', 'AssistantThread / assistant_threads', 'Assistant', 'Сессия диалога по собаке', 'pet_id, kind, title'],
  ['Сообщение ассистента', 'AssistantMessage / assistant_messages', 'Assistant', 'Сообщения и future safety metadata', 'thread_id, role, content'],
  ['Telegram-сессия', 'TelegramSession / no table yet', 'Identity', 'Псевдонимная Mini App сессия', 'psyoUserId, authDate'],
  ['Публичная карточка', 'PublicDogCard / target dog_cards', 'Share / Export', 'Безопасный export subset', 'slug, fields, is_active, revoked_at'],
];

s.push(`<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="1800" viewBox="0 0 3000 1800">`);
s.push(`<rect width="3000" height="1800" fill="${C.bg}"/>`);
text('Псё DB schema', 80, 110, 54, C.ink, 850, 30, 1.04);
text('RU/EN таблица сущностей, доменов, назначения и ключевых полей', 82, 172, 24, C.muted, 500, 76);
rect(80, 240, 2840, 80, C.ink, C.ink, 22);
const headers = ['RU сущность', 'EN entity / table', 'Домен', 'Назначение', 'Ключевые поля'];
const xs = [110, 520, 980, 1240, 1900];
const ws = [360, 410, 220, 600, 890];
headers.forEach((h, i) => text(h, xs[i], 290, 22, C.paper, 850, 28));
rows.forEach((r, i) => {
  const y = 340 + i * 112;
  rect(80, y, 2840, 96, i % 2 ? C.paper : C.white, i % 2 ? C.paper : C.white, 18);
  const accent = [C.rust, C.blue, C.green, C.lilac][i % 4];
  rect(80, y, 10, 96, accent, accent, 0);
  r.forEach((v, j) => text(v, xs[j], y + 36, j < 2 ? 20 : 18, j === 0 ? C.ink : C.muted, j < 2 ? 800 : 550, Math.floor(ws[j] / 10)));
});
text('Privacy rule: всё приватно по умолчанию; public/export использует только owner-selected safe subset. MapZone хранит approximate location, не точный публичный GPS.', 84, 1710, 24, C.rust, 800, 120);
s.push('</svg>');

writeFileSync(join(outDir, 'figma-board-pso-db-schema-ru-en.svg'), s.join('\n'));
console.log(`wrote ${join(outDir, 'figma-board-pso-db-schema-ru-en.svg')}`);
