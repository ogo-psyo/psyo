#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'docs/pso-hld-soa-2026-06-24';
mkdirSync(outDir, { recursive: true });

const C = {
  bg: '#F7F1E8', paper: '#FFF8ED', white: '#FFFFFF', ink: '#201A16', muted: '#6E6258',
  line: '#D6C7B6', rust: '#E86F3A', green: '#5F8D5A', blue: '#4E6E91', lilac: '#BFA7EA',
};

const esc = (v) => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function wrap(value, max = 30) {
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

const svg = [];
function rect(x, y, w, h, fill = C.paper, stroke = C.line, rx = 22) {
  svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
}
function text(value, x, y, size = 20, fill = C.ink, weight = 500, max = 30, lh = 1.15) {
  svg.push(`<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">`);
  wrap(value, max).forEach((line, i) => svg.push(`<tspan x="${x}" dy="${i ? size * lh : 0}">${esc(line)}</tspan>`));
  svg.push('</text>');
}
function header(kicker, title, sub, x, y) {
  text(kicker, x, y, 18, C.rust, 850, 60);
  text(title, x, y + 46, 44, C.ink, 850, 30, 1.02);
  text(sub, x, y + 132, 21, C.muted, 500, 72);
}
function card(x, y, w, h, title, body, accent = C.blue) {
  rect(x, y, w, h, C.paper, C.line, 24);
  rect(x, y, w, 8, accent, accent, 4);
  text(title, x + 22, y + 38, 22, C.ink, 850, Math.floor((w - 44) / 12));
  text(body, x + 22, y + 76, 16, C.muted, 500, Math.floor((w - 44) / 8));
}
function chip(x, y, label, color = C.blue, w = 150) {
  rect(x, y, w, 34, C.white, color, 17);
  text(label, x + 14, y + 22, 14, color, 800, 18);
}

svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="3600" height="2400" viewBox="0 0 3600 2400">`);
svg.push(`<rect width="3600" height="2400" fill="${C.bg}"/>`);

rect(60, 60, 3480, 1060, C.bg, C.bg, 34);
header('SCREEN DETAIL', 'Псё screens: jobs, entities, actions', 'This board turns the architecture into concrete product surfaces for redesign and implementation planning.', 110, 125);

const screens = [
  ['Onboarding', 'Job: понять ценность и создать первую identity.\nEntities: GuestProfile, DogProfile, AvatarAsset.\nActions: demo, photo, social rule, finishOnboarding.\nState: no dead end; local Pet id on exit.', C.rust],
  ['Today', 'Job: что важно сейчас.\nEntities: Pet, Passport, Social, Reminder, Zone, Wishlist.\nActions: add/complete/snooze reminder, share/print, route to domains.\nState: care loop before status.', C.green],
  ['Profile', 'Job: собрать память о собаке.\nEntities: Pet, Passport, SocialProfile, AvatarAsset.\nActions: bubbles, text details, save card, preview/share.\nState: progressive disclosure.', C.blue],
  ['Assistant', 'Job: спросить с контекстом.\nEntities: Pet context, Reminder, AssistantThread/Message future.\nActions: ask, preset prompt, future action proposal.\nState: no diagnosis.', C.lilac],
  ['Map', 'Job: помнить безопасные/рискованные места.\nEntities: MapZone.\nActions: create/update/delete, pick approximate point.\nState: text fallback if map weak.', C.green],
  ['Things', 'Job: не забыть нужное для ухода.\nEntities: WishlistItem.\nActions: add, priority, bought, delete.\nState: care utility before commerce.', C.rust],
  ['Public Card', 'Job: отдать понятную памятку человеку.\nEntities: PublicDogCard future, safe Pet/Social subset.\nActions: preview, share, print/PDF.\nState: owner opt-in fields.', C.blue],
  ['Auth / Session', 'Job: сохранить приватное состояние.\nEntities: Profile, TelegramSession.\nActions: magic link, sign out, Telegram bootstrap.\nState: no internal IDs in UI.', C.lilac],
];
screens.forEach((s, i) => {
  const x = 110 + (i % 4) * 840;
  const y = 360 + Math.floor(i / 4) * 350;
  card(x, y, 760, 285, s[0], s[1], s[2]);
});

rect(60, 1220, 3480, 1060, C.bg, C.bg, 34);
header('ENTITY DETAIL', 'Entities: lifecycle and ownership', 'Core entities grouped by domain. Use this to decide where screens read/write and what must stay private.', 110, 1285);

const entities = [
  ['Identity', 'Profile\nTelegramSession\nGuestProfile', 'Owner boundary, auth, session linking. No dog-care logic here.', C.lilac],
  ['Dog Profile', 'Pet\nPetPassport\nSocialProfile\nAvatarAsset', 'Stable dog facts, care notes, behavior, public-safe summary source.', C.blue],
  ['Care Loop', 'Reminder\nReminderEvent', 'Time-based return loop: due, done, snoozed, recurrence, history.', C.green],
  ['Places', 'MapZone', 'Approximate safe/risk/clinic/shop/grooming notes. No exact public GPS.', C.rust],
  ['Assistant', 'AssistantThread\nAssistantMessage', 'Context-aware answers; future persisted threads and action proposals.', C.lilac],
  ['Things', 'WishlistItem', 'Food, gear, health, grooming, service list; commerce later.', C.green],
  ['Share/Export', 'PublicDogCard', 'Owner-selected safe subset for preview/share/print; revocable future.', C.blue],
  ['Quality', 'Build gates\nUX surface gate\nEnv/auth contracts', 'Protect release from broken build, leaked internal UI, bad auth/env drift.', C.rust],
];
entities.forEach((e, i) => {
  const x = 110 + (i % 4) * 840;
  const y = 1520 + Math.floor(i / 4) * 310;
  card(x, y, 760, 250, e[0], `${e[1]}\n\n${e[2]}`, e[3]);
});

chip(110, 2190, 'private by default', C.green, 190);
chip(325, 2190, 'guest useful', C.rust, 150);
chip(500, 2190, 'owner opt-in share', C.blue, 205);
chip(730, 2190, 'no technical UI', C.lilac, 180);

svg.push('</svg>');
writeFileSync(join(outDir, 'figma-board-pso-screen-entity-detail.svg'), svg.join('\n'));
console.log(`wrote ${join(outDir, 'figma-board-pso-screen-entity-detail.svg')}`);
