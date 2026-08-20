#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const migration = readFileSync('supabase/migrations/20260820152000_pet_documents.sql', 'utf8');
const listRoute = readFileSync('app/api/documents/route.ts', 'utf8');
const itemRoute = readFileSync('app/api/documents/[id]/route.ts', 'utf8');
const page = readFileSync('app/page.tsx', 'utf8');
const failures = [];
for (const token of ['create table if not exists public.pet_documents', 'file_size_limit', 'enable row level security']) if (!migration.toLowerCase().includes(token.toLowerCase())) failures.push(`migration: ${token}`);
for (const token of ['getAppSessionFromRequest', 'getRequestAuth', 'ownedPet', 'PET_DOCUMENT_MAX_BYTES', 'PET_DOCUMENT_MIME_TYPES']) if (!listRoute.includes(token)) failures.push(`upload route: ${token}`);
for (const token of ['createSignedUrl', "eq('pets.owner_id', ownerId)", 'storage_path']) if (!itemRoute.includes(token)) failures.push(`item route: ${token}`);
for (const token of ['Анализы и документы', '/api/documents', 'application/pdf', 'Документ остаётся приватным']) if (!page.includes(token)) failures.push(`UI: ${token}`);
if (failures.length) { console.error(failures.map((item) => `- ${item}`).join('\n')); process.exit(1); }
console.log('pet documents contract ok');
