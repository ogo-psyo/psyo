#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = 'docs/pso-hld-soa-2026-06-24';
mkdirSync(outDir, { recursive: true });

const C = {
  bg: '#F7F1E8',
  paper: '#FFF8ED',
  ink: '#201A16',
  muted: '#6E6258',
  line: '#D6C7B6',
  rust: '#E86F3A',
  green: '#5F8D5A',
  blue: '#4E6E91',
  lilac: '#BFA7EA',
  night: '#2B211C',
  white: '#FFFFFF',
};

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function wrap(value, max = 34) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const parts = [];
function rect(x, y, w, h, fill = C.paper, stroke = C.line, rx = 24) {
  parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
}
function line(x1, y1, x2, y2, color = C.muted, width = 3) {
  parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`);
}
function text(value, x, y, size = 24, fill = C.ink, weight = 500, max = 44, lh = 1.18) {
  const lines = wrap(value, max);
  parts.push(`<text x="${x}" y="${y}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">`);
  lines.forEach((item, index) => parts.push(`<tspan x="${x}" dy="${index === 0 ? 0 : size * lh}">${esc(item)}</tspan>`));
  parts.push('</text>');
}
function title(kicker, heading, sub, x, y) {
  text(kicker, x, y, 20, C.rust, 800, 60);
  text(heading, x, y + 52, 48, C.ink, 850, 28, 1.05);
  text(sub, x, y + 150, 22, C.muted, 500, 68);
  rect(x, y + 218, 150, 7, C.rust, C.rust, 4);
}
function card(x, y, w, h, heading, body, accent = C.blue) {
  rect(x, y, w, h, C.paper, C.line, 26);
  rect(x, y, 10, h, accent, accent, 0);
  text(heading, x + 30, y + 44, 26, C.ink, 800, Math.floor((w - 60) / 14));
  text(body, x + 30, y + 92, 18, C.muted, 500, Math.floor((w - 60) / 10));
}
function node(x, y, w, h, heading, body, accent = C.blue) {
  rect(x, y, w, h, C.white, C.line, 20);
  rect(x, y, w, 8, accent, accent, 4);
  text(heading, x + 18, y + 34, 22, C.ink, 800, Math.floor((w - 36) / 13));
  text(body, x + 18, y + 70, 16, C.muted, 500, Math.floor((w - 36) / 9));
}
function frame(x, y, w, h, name) {
  rect(x, y, w, h, C.bg, C.bg, 34);
  text(name, x + 46, y + h - 34, 17, C.muted, 700, 80);
}
function arrow(x1, y1, x2, y2, color = C.muted) {
  line(x1, y1, x2, y2, color, 4);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const s = 13;
  parts.push(`<path d="M ${x2} ${y2} L ${x2 - ux * s + px * 7} ${y2 - uy * s + py * 7} L ${x2 - ux * s - px * 7} ${y2 - uy * s - py * 7} Z" fill="${color}"/>`);
}

parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="3200" height="2200" viewBox="0 0 3200 2200">`);
parts.push(`<rect width="3200" height="2200" fill="${C.bg}"/>`);

frame(60, 60, 1480, 980, '01 / HLD');
title('ПСЁ HLD', 'High-level architecture', 'Telegram Mini App / Next.js product slice: companion-first UI, privacy boundary, local guest start, Supabase persistence.', 120, 120);
node(140, 390, 220, 120, 'Telegram user', 'opens @psyoo_bot menu / Mini App', C.rust);
node(460, 390, 260, 120, 'Web shell', 'Next.js App Router, client state, Telegram WebApp bootstrap', C.blue);
node(820, 390, 250, 120, 'API boundary', 'Next route handlers validate auth, ownership and payload shape', C.green);
node(1170, 390, 230, 120, 'Data layer', 'Supabase Auth + Postgres + RLS owner policies', C.blue);
arrow(360, 450, 460, 450);
arrow(720, 450, 820, 450);
arrow(1070, 450, 1170, 450);
node(460, 640, 260, 120, 'Guest/local mode', 'localStorage profile, reminders, zones, wishlist draft', C.rust);
node(820, 640, 250, 120, 'Provider layer', 'avatar generation, assistant fallback/rules, Telegram webhook', C.lilac);
node(1170, 640, 230, 120, 'Vercel runtime', 'production alias, serverless APIs, env contracts, QA gates', C.green);
arrow(590, 510, 590, 640);
arrow(945, 510, 945, 640);
arrow(1070, 700, 1170, 700);
card(140, 820, 1260, 130, 'Architecture principles', '1. Dog context first. 2. No raw Telegram ID in UI. 3. Local mode must be useful. 4. Private data behind owner/auth boundary. 5. Assistant is safety-bounded and context-aware.', C.rust);

frame(1660, 60, 1480, 980, '02 / SOA domains');
title('SOA MAP', 'Domains and services', 'Service map by product domain. Current implementation is mostly app/page.tsx + route handlers; this board shows target ownership boundaries.', 1720, 120);
const domains = [
  ['Identity', 'Telegram session, email auth, profile, owner boundary', 'lib/server/auth.ts\nlib/server/telegram.ts\n/api/telegram/session'],
  ['Dog Profile', 'Pet core, passport, social behavior, public card source', 'pets\npet_passports\nsocial_profiles\n/api/pets'],
  ['Care Loop', 'Reminders, due actions, snooze/done/delete, daily return reason', 'reminders\nreminder_events\n/api/reminders/*'],
  ['Places', 'Approximate zones, safe/risk places, clinic/shop/grooming notes', 'map_zones\nLiveMap\n/api/zones/*'],
  ['Assistant', 'Context-aware care/training answers with no diagnosis promise', 'assistant route\nassistant_threads\nassistant_messages'],
  ['Things', 'Wishlist, gear/food/health/grooming items, future commerce', 'wishlist_items\n/api/wishlist/*'],
  ['Share/Export', 'Public card, print/PDF version, Telegram share fallback', '/dog/[slug]\nDogCardActions\npublicCardHref'],
  ['Quality Gates', 'Build, env/auth/readiness/UX surface contracts', 'scripts/qa/*\nnpm run qa:local'],
];
domains.forEach((d, i) => {
  const x = 1720 + (i % 2) * 650;
  const y = 365 + Math.floor(i / 2) * 155;
  node(x, y, 570, 120, d[0], `${d[1]}\n\n${d[2]}`, i % 3 === 0 ? C.rust : i % 3 === 1 ? C.green : C.blue);
});

frame(60, 1120, 1480, 980, '03 / Entities');
title('ENTITY MAP', 'Core entities and ownership', 'Current schema: owner-scoped private data; public sharing is query-backed today and should move to DB-backed public-safe cards.', 120, 1180);
const entities = [
  ['Profile', 'auth user mirror\n1 → many Pets'],
  ['Pet', 'dog identity\nbreed, avatar, public_slug'],
  ['Passport', 'health notes\nvaccine / parasite status'],
  ['SocialProfile', 'temperament, triggers\nhow to approach'],
  ['Reminder', 'care task\ndue_at, recurrence, status'],
  ['MapZone', 'approximate place\nlat/lng/radius, type'],
  ['WishlistItem', 'thing to buy/use\npriority, status'],
  ['AssistantThread', 'conversation\nkind, title'],
  ['AssistantMessage', 'thread messages\nrole/content/metadata future'],
  ['PublicDogCard', 'future DB-backed\nsafe export subset'],
];
entities.forEach((e, i) => {
  const x = 130 + (i % 2) * 650;
  const y = 1440 + Math.floor(i / 2) * 118;
  node(x, y, 560, 90, e[0], e[1], i % 3 === 0 ? C.rust : i % 3 === 1 ? C.green : C.blue);
});
arrow(690, 1485, 780, 1485, C.line);
arrow(410, 1530, 410, 1560, C.line);
arrow(1060, 1530, 1060, 1560, C.line);

frame(1660, 1120, 1480, 980, '04 / Screen to services');
title('SCREEN MAP', 'Screens → domains → states', 'Useful for redesign: every screen must justify its blocks by user value, not internal implementation status.', 1720, 1180);
const rows = [
  ['Onboarding', 'Identity + Dog Profile', 'create local pet identity; no dead end'],
  ['Today', 'Care Loop + Dog Profile', 'one next action, reminders, PDF/share shortcuts'],
  ['Profile', 'Dog Profile + Passport + Social', 'bubbles, prompts, progressive detail'],
  ['Map', 'Places', 'approximate zones, privacy text, no exact public GPS'],
  ['Assistant', 'Assistant + Care Loop', 'answers from dog context, no diagnoses'],
  ['Things', 'Wishlist', 'care/gear list, future commerce hidden until useful'],
  ['Public Card', 'Share/Export', 'preview before share, print/PDF wording'],
];
text('Screen', 1740, 1450, 22, C.ink, 800, 14);
text('Domain', 2020, 1450, 22, C.ink, 800, 16);
text('UX contract', 2320, 1450, 22, C.ink, 800, 34);
rows.forEach((r, i) => {
  const y = 1500 + i * 72;
  rect(1725, y - 28, 1340, 54, i % 2 ? C.paper : C.white, i % 2 ? C.paper : C.white, 14);
  text(r[0], 1745, y, 19, C.ink, 800, 18);
  text(r[1], 2020, y, 18, C.muted, 650, 24);
  text(r[2], 2320, y, 18, C.muted, 500, 48);
});
card(1730, 2028, 1280, 90, 'Mandatory UX gate', 'check-ux-surface-contract blocks technical statuses/internal service labels from returning to user screens.', C.rust);

parts.push('</svg>');
const svg = parts.join('\n');
writeFileSync(join(outDir, 'figma-board-pso-hld-soa.svg'), svg);

writeFileSync(join(outDir, '01-HLD.md'), `# Псё — HLD\n\n## Purpose\n\nПсё is a Telegram Mini App / Next.js product slice for dog owners: a living companion center for dog identity, daily care loop, reminders, approximate places, assistant context, things, and shareable/printable dog card.\n\n## Runtime Architecture\n\n- Client: Next.js App Router, mobile-first UI, Telegram WebApp bootstrap, local guest state.\n- Server/API: Next route handlers under \`app/api/*\`, owner/auth checks, payload mapping, safety boundaries.\n- Data: Supabase Auth + Postgres + RLS for private owner-scoped state.\n- Local fallback: \`localStorage\` profile/reminders/zones/wishlist for guest mode and demo resilience.\n- Providers: avatar generation endpoint, assistant endpoint, Telegram bot webhook.\n- Delivery: Vercel production alias \`https://pso-mvp-uglanovrms-projects.vercel.app\`.\n\n## Quality Gates\n\n- \`npm run check\` builds the app.\n- \`check-env-contract\` guards required env documentation.\n- \`check-auth-redirect-source\` guards auth redirect source.\n- \`check-readiness-contract\` guards readiness integration.\n- \`check-ux-surface-contract\` blocks technical/internal UI overload.\n`);

writeFileSync(join(outDir, '02-SOA-Map.md'), `# Псё — SOA Map\n\n## Domains\n\n| Domain | Responsibility | Main code/data |\n|---|---|---|\n| Identity | Telegram session, email auth, owner boundary | \`lib/server/auth.ts\`, \`lib/server/telegram.ts\`, \`/api/telegram/session\` |\n| Dog Profile | Pet core, passport, social profile, public card source | \`pets\`, \`pet_passports\`, \`social_profiles\`, \`/api/pets\` |\n| Care Loop | Reminders, due actions, snooze/done/delete | \`reminders\`, \`reminder_events\`, \`/api/reminders/*\` |\n| Places | Approximate safe/risk/clinic/shop/grooming zones | \`map_zones\`, \`LiveMap\`, \`/api/zones/*\` |\n| Assistant | Dog-context care/training answers with safety limits | \`/api/assistant\`, future \`assistant_threads/messages\` |\n| Things | Wishlist for food/gear/health/grooming/services | \`wishlist_items\`, \`/api/wishlist/*\` |\n| Share/Export | Public dog card, print/PDF, Telegram share | \`/dog/[slug]\`, \`DogCardActions\`, \`publicCardHref\` |\n| Quality Gates | Build/release safety and UX overload prevention | \`scripts/qa/*\`, \`npm run qa:local\` |\n\n## Entity Ownership\n\n- Profile owns many Pets.\n- Pet owns one Passport and one SocialProfile.\n- Pet owns many Reminders, MapZones, WishlistItems, AssistantThreads and PublicDogCards.\n- AssistantThread owns many AssistantMessages.\n- Public export must only use a safe subset chosen by the owner.\n`);

writeFileSync(join(outDir, '03-Figma-Handoff.md'), `# Figma Handoff\n\n## Importable artifact\n\nImport or drag this SVG into the Figma board:\n\n\`docs/pso-hld-soa-2026-06-24/figma-board-pso-hld-soa.svg\`\n\nIt contains four large frames:\n\n1. HLD\n2. SOA domains\n3. Entity map\n4. Screen-to-service map\n\n## Local bridge status\n\nFigma Desktop is open, but the OpenClaw Local Bridge plugin was not polling when this artifact was created. The local bridge server can queue commands on \`127.0.0.1:4777\`, but Figma must run the development plugin and press Start polling for editable node creation.\n\nRecommended fallback: import the SVG now, then convert important parts into editable Figma nodes during the next design pass.\n`);

console.log(`wrote ${outDir}`);
