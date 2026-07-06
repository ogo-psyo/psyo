#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const page = readFileSync('app/page.tsx', 'utf8');
const telegramSession = readFileSync('app/api/v1/session/telegram/route.ts', 'utf8');
const adminOwners = readFileSync('app/api/admin/auth/owners/route.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');
const prodUrl = 'https://pso-mvp-uglanovrms-projects.vercel.app';

const failures = [];
if (page.includes('signInWithOtp')) failures.push('owner app must not expose Supabase email OTP login');
if (page.includes('emailRedirectTo')) failures.push('owner app must not compute email auth redirects');
if (!page.includes('/api/v1/session/telegram')) failures.push('owner app must bootstrap identity through Telegram session BFF');
if (!telegramSession.includes('verifyTelegramInitData')) failures.push('Telegram session route must verify signed initData');
if (!telegramSession.includes('setAppSessionCookie')) failures.push('Telegram session route must set HttpOnly app session cookie');
if (!adminOwners.includes('PSYO_ADMIN_TOKEN')) failures.push('auth admin API must be protected by PSYO_ADMIN_TOKEN');
if (!config.includes(`site_url = "${prodUrl}"`)) failures.push('Supabase config site_url is not production URL');
if (!config.includes(prodUrl)) failures.push('Supabase config does not include production URL in redirect settings');
if (/site_url\s*=\s*"https?:\/\/(localhost|127\.0\.0\.1)/.test(config)) failures.push('Supabase config site_url points to localhost');

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log('auth redirect source ok');
