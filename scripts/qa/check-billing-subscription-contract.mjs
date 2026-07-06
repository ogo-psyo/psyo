#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const files = {
  rc1: readFileSync('lib/rc1.ts', 'utf8'),
  billing: readFileSync('lib/server/billing.ts', 'utf8'),
  entitlements: readFileSync('app/api/billing/entitlements/route.ts', 'utf8'),
  checkout: readFileSync('app/api/billing/telegram-stars/checkout/route.ts', 'utf8'),
  telegramWebhook: readFileSync('app/api/telegram/webhook/route.ts', 'utf8'),
  page: readFileSync('app/page.tsx', 'utf8'),
  prd: readFileSync('docs/PSYO_FINAL_PRD.md', 'utf8'),
};

const failures = [];

if (!existsSync('app/api/billing/telegram-stars/checkout/route.ts')) {
  failures.push('missing Telegram Stars checkout route');
}

for (const token of [
  'freePlanSnapshot',
  'plusPlanSnapshot',
  'plusEntitlementSnapshot',
  'activeReminders: null',
  'caregiver access',
]) {
  if (!files.rc1.includes(token)) failures.push(`rc1 plan package missing token: ${token}`);
}

for (const token of [
  'createPlusInvoicePayload',
  'parsePlusInvoicePayload',
  'provider_token: \'\',',
  "currency: 'XTR'",
  'subscription_period: rc1Config.subscriptionPeriodSeconds',
  'createInvoiceLink',
]) {
  if (!files.billing.includes(token)) failures.push(`billing helper missing Telegram Stars token: ${token}`);
}

for (const token of [
  'rc1Config.flags.billing_enabled',
  'rc1Config.flags.new_invoices_enabled',
  "error: 'BILLING_NOT_READY'",
  'createTelegramStarsInvoiceLink',
]) {
  if (!files.checkout.includes(token)) failures.push(`checkout route missing release-gated invoice token: ${token}`);
}

for (const token of [
  'answerPreCheckoutQuery',
  'pre_checkout_query',
  'successful_payment',
  'parsePlusInvoicePayload',
  'telegram_payment_charge_id',
  "currency !== 'XTR'",
]) {
  if (!files.telegramWebhook.includes(token)) failures.push(`telegram webhook missing server-side payment reconciliation token: ${token}`);
}

for (const token of [
  'plans: {',
  'upgrade: {',
  'newInvoicesEnabled',
]) {
  if (!files.entitlements.includes(token)) failures.push(`entitlements API missing commercial package token: ${token}`);
}

for (const token of [
  'plus-gate-card',
  'startPlusCheckout',
  'Оплата закрыта до legal и payment smoke',
]) {
  if (!files.page.includes(token)) failures.push(`main UI missing Plus subscription surface token: ${token}`);
}

for (const token of [
  'Псё Плюс',
  'Telegram Stars',
  'Free',
  'Plus',
  'нельзя закрывать за оплату',
]) {
  if (!files.prd.includes(token)) failures.push(`PRD missing subscription product token: ${token}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('billing subscription contract ok');
