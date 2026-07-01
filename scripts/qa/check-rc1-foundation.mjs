import { existsSync, readFileSync } from 'node:fs';

const requiredFiles = [
  'IMPLEMENTATION.md',
  'lib/rc1.ts',
  'app/api/internal/health/route.ts',
  'app/api/billing/entitlements/route.ts',
  'app/legal/privacy/page.tsx',
  'app/legal/terms/page.tsx',
  'app/support/page.tsx',
];

const requiredEnv = [
  'NEXT_PUBLIC_TELEGRAM_BOT_USERNAME',
  'SUBSCRIPTION_PRICE_STARS',
  'SUBSCRIPTION_PERIOD_SECONDS',
  'BILLING_ENABLED',
  'PLUS_PAYWALL_ENABLED',
  'NEW_INVOICES_ENABLED',
  'TELEGRAM_NOTIFICATIONS_ENABLED',
  'SUPPORT_CONTACT',
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) failures.push(`missing ${file}`);
}

const envExample = readFileSync('.env.example', 'utf8');
for (const key of requiredEnv) {
  if (!envExample.includes(`${key}=`)) failures.push(`.env.example missing ${key}`);
}

const implementation = readFileSync('IMPLEMENTATION.md', 'utf8');
for (const phrase of ['Production billing', 'release gates', 'Telegram Stars', 'idempotency']) {
  if (!implementation.toLowerCase().includes(phrase.toLowerCase())) failures.push(`IMPLEMENTATION.md missing ${phrase}`);
}

const entitlements = readFileSync('app/api/billing/entitlements/route.ts', 'utf8');
if (!entitlements.includes('billingEnabled') || !entitlements.includes('blockedReason')) {
  failures.push('entitlements route must expose disabled billing readiness');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('rc1 foundation ok');
