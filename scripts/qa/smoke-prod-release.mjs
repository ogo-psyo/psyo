#!/usr/bin/env node

const baseUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');

if (!baseUrl) {
  console.error('APP_URL or NEXT_PUBLIC_APP_URL is required for prod smoke');
  process.exit(1);
}

const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(baseUrl);
const strictProd = process.env.STRICT_PROD_SMOKE === '1' || (!isLocal && process.env.STRICT_PROD_SMOKE !== '0');
const failures = [];
const evidence = {
  baseUrl,
  strictProd,
  checks: {},
};

async function fetchText(path, init) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  return { res, text };
}

async function fetchJson(path, init) {
  const { res, text } = await fetchText(path, init);
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    failures.push(`${path} did not return JSON`);
  }
  return { res, text, json };
}

function requireStatus(path, status, expected) {
  if (status !== expected) failures.push(`${path} returned ${status}, expected ${expected}`);
}

function requireOk(path, status) {
  if (status < 200 || status >= 300) failures.push(`${path} returned ${status}`);
}

const home = await fetchText('/');
requireOk('/', home.res.status);
evidence.checks.home = {
  status: home.res.status,
  hasBrand: home.text.includes('Псё'),
  hasCareCopy: /собак|питом/i.test(home.text),
};
if (!evidence.checks.home.hasBrand) failures.push('/ must include the Псё brand');
for (const forbidden of ['premium demo-render', 'care anchor', 'Сохранить запись']) {
  if (home.text.includes(forbidden)) failures.push(`/ leaks removed UX copy: ${forbidden}`);
}

const health = await fetchJson('/api/internal/health');
requireOk('/api/internal/health', health.res.status);
evidence.checks.health = health.json && {
  status: health.res.status,
  environment: health.json.environment,
  release: health.json.release,
  flags: health.json.flags,
};
if (strictProd && !health.json?.release) failures.push('/api/internal/health must expose a release identifier in prod smoke');
for (const flag of ['billing_enabled', 'plus_paywall_enabled', 'new_invoices_enabled', 'uploads_enabled', 'avatar_generation_enabled']) {
  if (health.json?.flags?.[flag] === true && process.env.ALLOW_RISKY_PROD_FLAGS !== '1') {
    failures.push(`/api/internal/health risky flag enabled without ALLOW_RISKY_PROD_FLAGS=1: ${flag}`);
  }
}

const entitlements = await fetchJson('/api/billing/entitlements');
requireOk('/api/billing/entitlements', entitlements.res.status);
evidence.checks.entitlements = entitlements.json && {
  status: entitlements.res.status,
  readiness: entitlements.json.meta?.readiness,
  billingEnabled: entitlements.json.meta?.billingEnabled,
  paywallEnabled: entitlements.json.meta?.paywallEnabled,
};
if (entitlements.json?.meta?.billingEnabled && process.env.ALLOW_BILLING_ENABLED !== '1') {
  failures.push('/api/billing/entitlements reports billing enabled without ALLOW_BILLING_ENABLED=1');
}
if (entitlements.json?.meta?.readiness !== 'blocked' && process.env.ALLOW_BILLING_ENABLED !== '1') {
  failures.push('/api/billing/entitlements must keep billing readiness blocked by default');
}

const bootstrap = await fetchJson('/api/app/bootstrap');
requireOk('/api/app/bootstrap', bootstrap.res.status);
evidence.checks.bootstrap = bootstrap.json && {
  status: bootstrap.res.status,
  mode: bootstrap.json.mode,
  empty: Boolean(bootstrap.json.empty),
  hasPet: Boolean(bootstrap.json.pet),
  hasUser: Boolean(bootstrap.json.user),
};
if (bootstrap.json?.pet && !bootstrap.json?.user) failures.push('/api/app/bootstrap returned private pet data without authenticated user');

for (const path of ['/legal/privacy', '/legal/terms', '/support']) {
  const page = await fetchText(path);
  requireOk(path, page.res.status);
  evidence.checks[path] = { status: page.res.status, bytes: page.text.length };
}

const dogCard = await fetchText('/dog/card?demo=1&name=%D0%9C%D1%8F%D1%82%D0%B0&breed=%D0%BC%D0%B5%D1%82%D0%B8%D1%81&social=ask_first&area=%D1%80%D0%B0%D0%B9%D0%BE%D0%BD%20%D1%81%D0%BA%D1%80%D1%8B%D1%82&triggers=%D1%88%D1%83%D0%BC');
requireOk('/dog/card preview', dogCard.res.status);
evidence.checks.publicDogCard = {
  status: dogCard.res.status,
  hasName: dogCard.text.includes('Мята'),
  hasAllowlistedArea: dogCard.text.includes('район скрыт'),
};
if (!dogCard.text.includes('район скрыт')) failures.push('/dog/card smoke must render allowlisted approximate area');

const missingDogCard = await fetchText('/dog/qa-smoke-missing-slug');
evidence.checks.missingPublicDogCard = { status: missingDogCard.res.status };
requireStatus('/dog/[missing-slug]', missingDogCard.res.status, 404);

const webhook = await fetchJson('/api/telegram/webhook', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{}',
});
evidence.checks.telegramWebhookWithoutSecret = { status: webhook.res.status };
if (strictProd) requireStatus('/api/telegram/webhook without secret', webhook.res.status, 401);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures, evidence }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, evidence }, null, 2));
