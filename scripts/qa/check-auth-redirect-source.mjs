#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const page = readFileSync('app/page.tsx', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');
const prodUrl = 'https://pso-mvp-uglanovrms-projects.vercel.app';

const failures = [];
if (!page.includes('NEXT_PUBLIC_APP_URL')) failures.push('app/page.tsx does not use NEXT_PUBLIC_APP_URL for auth redirect');
if (!page.includes('emailRedirectTo: redirectTo')) failures.push('signInWithOtp does not pass computed redirectTo');
if (/emailRedirectTo:\s*window\.location\.origin/.test(page)) failures.push('emailRedirectTo is directly tied to window.location.origin');
if (!config.includes(`site_url = "${prodUrl}"`)) failures.push('Supabase config site_url is not production URL');
if (!config.includes(prodUrl)) failures.push('Supabase config does not include production URL in redirect settings');
if (/site_url\s*=\s*"https?:\/\/(localhost|127\.0\.0\.1)/.test(config)) failures.push('Supabase config site_url points to localhost');

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log('auth redirect source ok');
