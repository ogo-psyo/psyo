#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const files = {
  env: readFileSync('.env.example', 'utf8'),
  rc1: readFileSync('lib/rc1.ts', 'utf8'),
  assistant: readFileSync('app/api/assistant/route.ts', 'utf8'),
  assistantService: readFileSync('lib/server/assistantAnswerService.ts', 'utf8'),
  groqAssistant: readFileSync('lib/server/groqAssistant.ts', 'utf8'),
  entitlements: readFileSync('app/api/billing/entitlements/route.ts', 'utf8'),
  testReport: readFileSync('docs/TEST_REPORT.md', 'utf8'),
};

const failures = [];

for (const line of [
  'BILLING_ENABLED=false',
  'PLUS_PAYWALL_ENABLED=false',
  'NEW_INVOICES_ENABLED=false',
  'TELEGRAM_NOTIFICATIONS_ENABLED=false',
  'AI_QA_ENABLED=false',
  'ASSISTANT_GROQ_ENABLED=false',
  'AVATAR_GENERATION_ENABLED=false',
  'AVATAR_OPENAI_ENABLED=false',
  'AVATAR_DAILY_BUDGET_CENTS=0',
  'AVATAR_OPENAI_ESTIMATED_COST_CENTS=0',
  'UPLOADS_ENABLED=false',
]) {
  if (!files.env.includes(line)) failures.push(`.env.example must keep risky prod flag disabled by default: ${line}`);
}

for (const token of [
  'billing_enabled: readBoolean(process.env.BILLING_ENABLED, false)',
  'plus_paywall_enabled: readBoolean(process.env.PLUS_PAYWALL_ENABLED, false)',
  'telegram_notifications_enabled: readBoolean(process.env.TELEGRAM_NOTIFICATIONS_ENABLED, false)',
  'new_invoices_enabled: readBoolean(process.env.NEW_INVOICES_ENABLED, false)',
  'ai_qa_enabled: readBoolean(process.env.AI_QA_ENABLED, false)',
  'avatar_generation_enabled: readBoolean(process.env.AVATAR_GENERATION_ENABLED, false)',
  'uploads_enabled: readBoolean(process.env.UPLOADS_ENABLED, false)',
]) {
  if (!files.rc1.includes(token)) failures.push(`rc1Config missing false default: ${token}`);
}

const avatarGenerate = readFileSync('app/api/avatar/generate/route.ts', 'utf8');
const avatarUpload = readFileSync('app/api/avatar/upload/route.ts', 'utf8');
const avatarJobs = readFileSync('app/api/v1/pets/[petId]/avatar/jobs/route.ts', 'utf8');
const avatarAssets = readFileSync('app/api/v1/pets/[petId]/avatar/assets/route.ts', 'utf8');
const telegramWebhook = readFileSync('app/api/telegram/webhook/route.ts', 'utf8');

if (!avatarGenerate.includes('AVATAR_API_MOVED')) failures.push('legacy avatar generate route must stay retired');
for (const token of ['rc1Config.flags.avatar_generation_enabled', 'AVATAR_OPENAI_ENABLED', 'AVATAR_DAILY_BUDGET_CENTS', 'getAvatarOwnerContext', 'requireOwnedPet']) {
  if (!avatarJobs.includes(token)) failures.push(`pet-bound avatar job route missing release/auth gate token: ${token}`);
}

if (!avatarUpload.includes('AVATAR_API_MOVED')) failures.push('legacy avatar upload route must stay retired');
for (const token of ['rc1Config.flags.uploads_enabled', "error: 'UPLOADS_DISABLED'", 'getAvatarOwnerContext', 'requireOwnedPet']) {
  if (!avatarAssets.includes(token)) failures.push(`pet-bound avatar upload route missing release/auth gate token: ${token}`);
}

if (!telegramWebhook.includes("process.env.VERCEL_ENV === 'production'") || !telegramWebhook.includes('return !isProduction')) {
  failures.push('telegram webhook must require TELEGRAM_WEBHOOK_SECRET in production');
}

for (const token of ['generateGuardedAssistantAnswer', 'getAppSessionFromRequest', 'principalsAgree']) {
  if (!files.assistant.includes(token)) failures.push(`assistant route missing owner/safety integration: ${token}`);
}
for (const token of ['rules_health_boundary', 'rules_guest', 'ASSISTANT_UNSAFE_RESPONSE', 'claimAssistantCapacity']) {
  if (!files.assistantService.includes(token)) failures.push(`assistant service missing deterministic safety/fallback gate: ${token}`);
}
for (const token of ['ASSISTANT_GROQ_ENABLED', 'ASSISTANT_LLM_DISABLED', 'max_completion_tokens: 700']) {
  if (!files.groqAssistant.includes(token)) failures.push(`Groq assistant provider missing release/cost gate: ${token}`);
}

for (const token of [
  'billingEnabled: rc1Config.flags.billing_enabled',
  'paywallEnabled: rc1Config.flags.plus_paywall_enabled',
  "readiness: rc1Config.flags.billing_enabled ? 'partial' : 'blocked'",
]) {
  if (!files.entitlements.includes(token)) failures.push(`entitlements route missing billing disabled disclosure: ${token}`);
}

for (const token of [
  'design concept contract',
  'prod risk gates',
  'AI_QA_ENABLED=false',
]) {
  if (!files.testReport.includes(token)) failures.push(`docs/TEST_REPORT.md missing QA gate note: ${token}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('prod risk gates ok');
