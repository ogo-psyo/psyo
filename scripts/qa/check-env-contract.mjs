#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const required = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
];

const examplePath = join(root, '.env.example');
if (!existsSync(examplePath)) {
  console.error('Missing .env.example');
  process.exit(1);
}

const example = readFileSync(examplePath, 'utf8');
const missing = required.filter((key) => !new RegExp(`^${key}=`, 'm').test(example));
if (missing.length) {
  console.error(`.env.example missing required keys: ${missing.join(', ')}`);
  process.exit(1);
}

const files = [
  'app/page.tsx',
  'lib/clientSupabase.ts',
  'lib/server/auth.ts',
  'lib/server/supabase.ts',
  'app/api/app/bootstrap/route.ts',
  'app/api/pets/route.ts',
  'app/api/reminders/route.ts',
  'app/api/wishlist/route.ts',
  'app/api/assistant/route.ts',
];

const referenced = new Set();
for (const file of files) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  const content = readFileSync(path, 'utf8');
  for (const match of content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) referenced.add(match[1]);
}

const publicOrServer = [...referenced].filter((key) => key.startsWith('NEXT_PUBLIC_') || key.startsWith('SUPABASE_'));
const undocumented = publicOrServer.filter((key) => !new RegExp(`^${key}=`, 'm').test(example));
if (undocumented.length) {
  console.error(`Env keys referenced in code but missing from .env.example: ${undocumented.join(', ')}`);
  process.exit(1);
}

console.log('env contract ok');
