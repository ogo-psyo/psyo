#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  contracts: readFileSync('packages/contracts/index.ts', 'utf8'),
  appSession: readFileSync('lib/server/appSession.ts', 'utf8'),
  telegram: readFileSync('lib/server/telegram.ts', 'utf8'),
  sessionRoute: readFileSync('app/api/v1/session/telegram/route.ts', 'utf8'),
  petsRoute: readFileSync('app/api/v1/pets/route.ts', 'utf8'),
  profileService: readFileSync('lib/server/profileService.ts', 'utf8'),
  env: readFileSync('.env.example', 'utf8'),
};

const failures = [];

for (const token of [
  'export type ServiceReadiness',
  'export type TelegramSessionResponse',
  'export type CreatePetCommand',
  'validateCreatePetCommand',
  'problem(',
]) {
  if (!files.contracts.includes(token)) failures.push(`contracts missing ${token}`);
}

for (const token of [
  'createAppSessionToken',
  'verifyAppSessionToken',
  'isAppSessionOriginAllowed',
  "['POST', 'PUT', 'PATCH', 'DELETE']",
  "request.headers.get('origin')",
  'HttpOnly',
  'SameSite=Lax',
]) {
  if (!files.appSession.includes(token)) failures.push(`app session missing ${token}`);
}

if (files.appSession.includes('process.env.PSYO_SESSION_SIGNING_KEY || process.env.PSYO_ID_PEPPER')) {
  failures.push('app session must not fall back to PSYO_ID_PEPPER for cookie signing');
}

for (const token of [
  'maxAgeSeconds',
  'authDate',
  'Math.floor(Date.now() / 1000) - authDate',
]) {
  if (!files.telegram.includes(token)) failures.push(`telegram validation missing ${token}`);
}

for (const token of [
  "service: 'IdentityService'",
  'verifyTelegramInitData(initData, botToken)',
  'buildPsyoUserId(verified.user.id)',
  'setAppSessionCookie',
  'raw Telegram ID is processed only during server-side validation',
]) {
  if (!files.sessionRoute.includes(token)) failures.push(`v1 session route missing ${token}`);
}

for (const token of [
  'blockedTelegramStorageResponse',
  'TELEGRAM_PET_STORAGE_NOT_MIGRATED',
  'client-provided psyoUserId is not trusted',
  'savePetProfile',
]) {
  if (!files.petsRoute.includes(token)) failures.push(`v1 pets route missing ${token}`);
}

for (const token of [
  'export async function savePetProfile',
  'owner_id: user.id',
  'pet_passports',
  'social_profiles',
]) {
  if (!files.profileService.includes(token)) failures.push(`ProfileService missing ${token}`);
}

if (!files.env.includes('PSYO_SESSION_SIGNING_KEY')) failures.push('env example missing PSYO_SESSION_SIGNING_KEY');

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('v1 BFF contract ok');
