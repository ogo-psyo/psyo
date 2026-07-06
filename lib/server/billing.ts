import { createHmac, timingSafeEqual } from 'node:crypto';
import { rc1Config } from '@/lib/rc1';

export type BillingPeriod = 'monthly';

const payloadPrefix = 'psyo_plus';
const payloadTtlSeconds = 60 * 60 * 24;

function billingSecret() {
  const secret = process.env.PSYO_SESSION_SIGNING_KEY || process.env.PSYO_ID_PEPPER;
  if (!secret) throw new Error('BILLING_SIGNING_SECRET_REQUIRED');
  return secret;
}

function signPayloadBody(body: string) {
  return createHmac('sha256', billingSecret()).update(body).digest('base64url').slice(0, 22);
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createPlusInvoicePayload(ownerId: string, period: BillingPeriod = 'monthly') {
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = `${payloadPrefix}.${ownerId}.${period}.${issuedAt}`;
  return `${body}.${signPayloadBody(body)}`;
}

export function parsePlusInvoicePayload(payload: string) {
  const [prefix, ownerId, period, issuedAtRaw, signature] = payload.split('.');
  if (prefix !== payloadPrefix || !ownerId || period !== 'monthly' || !issuedAtRaw || !signature) return null;

  const body = `${prefix}.${ownerId}.${period}.${issuedAtRaw}`;
  if (!safeEqual(signPayloadBody(body), signature)) return null;

  const issuedAt = Number(issuedAtRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(issuedAt) || now - issuedAt > payloadTtlSeconds || issuedAt > now + 300) return null;

  return { ownerId, period: period as BillingPeriod, issuedAt };
}

export function plusExpiresAt(period: BillingPeriod = 'monthly') {
  const expiresAt = new Date();
  if (period === 'monthly') expiresAt.setSeconds(expiresAt.getSeconds() + rc1Config.subscriptionPeriodSeconds);
  return expiresAt.toISOString();
}

export async function createTelegramStarsInvoiceLink(input: {
  ownerId: string;
  requestUrl: string;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { ok: false as const, status: 503, error: 'TELEGRAM_BOT_TOKEN_REQUIRED' };
  }

  const payload = createPlusInvoicePayload(input.ownerId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(input.requestUrl).origin;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Псё Плюс',
      description: 'Месяц расширенной заботы: несколько собак, длинная история, расширенные карточки и экспорт.',
      payload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: 'Псё Плюс на 30 дней', amount: rc1Config.priceStars }],
      subscription_period: rc1Config.subscriptionPeriodSeconds,
      start_parameter: 'psyo_plus',
      photo_url: `${appUrl.replace(/\/$/, '')}/icon-512.png`,
    }),
  });

  const data = await response.json().catch(() => null) as { ok?: boolean; result?: string; description?: string } | null;
  if (!response.ok || !data?.ok || !data.result) {
    return { ok: false as const, status: 502, error: 'TELEGRAM_INVOICE_LINK_FAILED', detail: data?.description };
  }

  return { ok: true as const, invoiceLink: data.result, payload };
}
