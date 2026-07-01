import { NextResponse } from 'next/server';
import { buildTelegramSession, verifyTelegramInitData } from '@/lib/server/telegram';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const initData = String(body?.initData || '');

  if (!initData) {
    return NextResponse.json({
      mode: 'browser',
      connected: false,
      message: 'Open inside Telegram Mini App to attach Telegram session.',
    });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN_REQUIRED' }, { status: 503 });
  }

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) {
    return NextResponse.json({ error: 'INVALID_TELEGRAM_INIT_DATA' }, { status: 401 });
  }

  try {
    return NextResponse.json({
      mode: 'telegram',
      connected: true,
      session: buildTelegramSession(verified.user, verified.authDate),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'TELEGRAM_SESSION_FAILED' }, { status: 503 });
  }
}
