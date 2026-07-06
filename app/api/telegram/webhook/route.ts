import { NextResponse } from 'next/server';
import { rc1Config } from '@/lib/rc1';
import { parsePlusInvoicePayload, plusExpiresAt } from '@/lib/server/billing';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramMessage = {
  chat?: { id?: number | string };
  text?: string;
  successful_payment?: {
    invoice_payload?: string;
    telegram_payment_charge_id?: string;
    currency?: string;
    total_amount?: number;
  };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  pre_checkout_query?: {
    id: string;
    invoice_payload?: string;
    currency?: string;
    total_amount?: number;
  };
};

const START_TEXT = [
  'Псё уже здесь.',
  '',
  'Открой Mini App, собери паспорт собаки, добавь напоминалки и сделай PDF-карточку для грумера, догситтера или своих.',
].join('\n');

function getAppUrl(request: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const url = new URL(request.url);
  return url.origin;
}

async function sendTelegramMessage(chatId: number | string, request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN_REQUIRED');

  const appUrl = getAppUrl(request);
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: START_TEXT,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Открыть Псё',
              web_app: { url: appUrl },
            },
          ],
        ],
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`TELEGRAM_SEND_FAILED_${response.status}`);
  }
}

async function answerPreCheckoutQuery(queryId: string, ok: boolean, errorMessage?: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN_REQUIRED');

  await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      pre_checkout_query_id: queryId,
      ok,
      ...(ok ? {} : { error_message: errorMessage || 'Платёж Псё временно недоступен.' }),
    }),
  });
}

async function activatePlusFromSuccessfulPayment(payment: NonNullable<TelegramMessage['successful_payment']>) {
  if (!rc1Config.flags.billing_enabled) return;
  if (payment.currency !== 'XTR') return;

  const payload = parsePlusInvoicePayload(String(payment.invoice_payload || ''));
  const chargeId = String(payment.telegram_payment_charge_id || '').trim();
  if (!payload || !chargeId) return;

  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');

  const { error } = await supabase.from('subscriptions').upsert({
    user_id: payload.ownerId,
    tier: 'plus',
    status: 'active',
    provider: 'telegram_stars',
    provider_charge_id: chargeId,
    expires_at: plusExpiresAt(payload.period),
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'user_id',
  });

  if (error) throw new Error('SUBSCRIPTION_UPSERT_FAILED');
}

function isAuthorizedWebhook(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.APP_ENV === 'production';
  if (!expectedSecret) return !isProduction;
  return request.headers.get('x-telegram-bot-api-secret-token') === expectedSecret;
}

export async function POST(request: Request) {
  if (!isAuthorizedWebhook(request)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const preCheckout = update?.pre_checkout_query;
  if (preCheckout?.id) {
    const payload = parsePlusInvoicePayload(String(preCheckout.invoice_payload || ''));
    const isValidStarsPayment = Boolean(
      rc1Config.flags.billing_enabled
      && rc1Config.flags.new_invoices_enabled
      && preCheckout.currency === 'XTR'
      && preCheckout.total_amount === rc1Config.priceStars
      && payload
    );
    await answerPreCheckoutQuery(preCheckout.id, isValidStarsPayment, 'Платёж Псё Плюс временно недоступен.');
    return NextResponse.json({ ok: true });
  }

  const message = update?.message;
  if (message?.successful_payment) {
    await activatePlusFromSuccessfulPayment(message.successful_payment);
    return NextResponse.json({ ok: true });
  }

  const chatId = message?.chat?.id;
  const text = message?.text?.trim() || '';

  if (!chatId) {
    return NextResponse.json({ ok: true });
  }

  if (text === '/start' || text.startsWith('/start ') || text === '/card') {
    await sendTelegramMessage(chatId, request);
  }

  return NextResponse.json({ ok: true });
}
