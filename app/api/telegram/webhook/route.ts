import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramMessage = {
  chat?: { id?: number | string };
  text?: string;
};

type TelegramUpdate = {
  message?: TelegramMessage;
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
  const message = update?.message;
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
