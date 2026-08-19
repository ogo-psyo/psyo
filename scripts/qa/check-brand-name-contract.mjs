#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  page: readFileSync('app/page.tsx', 'utf8'),
  layout: readFileSync('app/layout.tsx', 'utf8'),
  manifest: readFileSync('app/manifest.ts', 'utf8'),
  admin: readFileSync('app/admin/page.tsx', 'utf8'),
  assistant: readFileSync('app/api/assistant/route.ts', 'utf8'),
  product: readFileSync('PRODUCT.md', 'utf8'),
  design: readFileSync('DESIGN.md', 'utf8'),
};

const failures = [];
const visibleApp = [files.page, files.layout, files.manifest, files.admin, files.assistant].join('\n');

for (const token of [
  '<h1>Псё</h1>',
  "applicationName: 'Псё'",
  "name: 'Псё'",
  'Создано в Псё',
  'Псё · админка',
  'Ты ассистент Псё',
]) {
  if (!visibleApp.includes(token)) failures.push(`visible brand token missing: ${token}`);
}

for (const token of [
  '>PSYO</span>',
  'PSYO HERO CARD',
  'PSYO CARE CARD',
  'PSYO KENNEL CLUB',
  'Создано в PSYO',
  'PSYO admin',
  'ассистент Pso',
]) {
  if (visibleApp.includes(token)) failures.push(`legacy visible brand remains: ${token}`);
}

if (!files.product.includes('# PRODUCT — Псё')) failures.push('PRODUCT.md must name the product Псё');
if (!files.design.includes('name: Псё Pouf Companion')) failures.push('DESIGN.md must name the product Псё');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('brand name contract ok');
