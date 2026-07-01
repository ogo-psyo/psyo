import { NextResponse } from 'next/server';
import { buildPsyoUserId, verifyTelegramInitData } from '@/lib/server/telegram';
import { createAppSessionToken, setAppSessionCookie } from '@/lib/server/appSession';
import { ensureTelegramOwner } from '@/lib/server/telegramOwner';
import type { TelegramSessionResponse } from '@/packages/contracts';
import { problem } from '@/packages/contracts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const initData = String(body?.initData || '');

  if (!initData) {
    const payload = problem('INIT_DATA_REQUIRED', 400, 'Telegram initData is required', 'Open Псё from Telegram Mini App and send the raw initData string to the BFF.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    const payload = problem('TELEGRAM_BOT_TOKEN_REQUIRED', 503, 'Telegram auth is not configured', 'Set TELEGRAM_BOT_TOKEN on the server before enabling Mini App login.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified) {
    const payload = problem('INVALID_TELEGRAM_INIT_DATA', 401, 'Telegram initData is invalid or expired', 'The BFF refused initData signature/freshness validation.');
    return NextResponse.json(payload, { status: payload.status });
  }

  try {
    const psyoUserId = buildPsyoUserId(verified.user.id);
    let owner: Awaited<ReturnType<typeof ensureTelegramOwner>> | null = null;
    let ownerError: string | null = null;
    try {
      owner = await ensureTelegramOwner(psyoUserId);
    } catch (error) {
      ownerError = error instanceof Error ? error.message : 'Telegram owner could not be created';
    }
    const signed = createAppSessionToken({
      psyoUserId,
      ownerId: owner?.id,
      authDate: verified.authDate,
      locale: verified.user.language_code,
    });
    const responseBody: TelegramSessionResponse = {
      service: 'IdentityService',
      mode: 'telegram',
      connected: true,
      session: {
        psyoUserId,
        ownerId: owner?.id,
        authDate: verified.authDate,
        locale: verified.user.language_code,
        issuedAt: signed.issuedAt,
        expiresAt: signed.expiresAt,
      },
      readiness: {
        service: 'IdentityService',
        state: 'partial',
        persisted: ['signed HttpOnly app session cookie', ...(owner ? ['Telegram Supabase Auth owner'] : [])],
        localOnly: [],
        blockedPromises: owner ? [] : [`Telegram owner could not be created in Supabase Auth${ownerError ? `: ${ownerError}` : ''}`],
        privacyState: 'raw Telegram ID is processed only during server-side validation and is not returned to the client',
        qaState: 'contract route exists; production requires Telegram fixture smoke with fresh initData',
      },
    };
    const response = NextResponse.json(responseBody);
    setAppSessionCookie(response, signed.token, signed.maxAge);
    return response;
  } catch (error) {
    const payload = problem('SESSION_SIGNING_FAILED', 503, 'App session could not be signed', error instanceof Error ? error.message : 'Session signing failed.');
    return NextResponse.json(payload, { status: payload.status });
  }
}
