#!/usr/bin/env node
const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/app/bootstrap`);
const text = await res.text();
let json;
try { json = JSON.parse(text); } catch { json = null; }

if (!res.ok || !json) {
  console.error(JSON.stringify({ ok: false, status: res.status, body: text.slice(0, 300) }, null, 2));
  process.exit(1);
}

if (json.pet && !json.user) {
  console.error('bootstrap returned private pet data without authenticated user');
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, status: res.status, mode: json.mode, empty: Boolean(json.empty), hasPet: Boolean(json.pet), hasUser: Boolean(json.user) }, null, 2));
