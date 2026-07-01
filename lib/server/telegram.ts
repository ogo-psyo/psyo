import { createHmac, timingSafeEqual } from 'node:crypto';

export type TelegramMiniAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type TelegramSession = {
  psyoUserId: string;
  firstName?: string;
  username?: string;
  languageCode?: string;
  authDate?: number;
};

function hmacHex(key: string | Buffer, value: string) {
  return createHmac('sha256', key).update(value).digest('hex');
}

function hmacBuffer(key: string | Buffer, value: string) {
  return createHmac('sha256', key).update(value).digest();
}

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyTelegramInitData(initData: string, botToken: string, options: { maxAgeSeconds?: number } = {}) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = hmacBuffer('WebAppData', botToken);
  const calculatedHash = hmacHex(secretKey, dataCheckString);
  if (!safeEqualHex(calculatedHash, hash)) return null;

  const userRaw = params.get('user');
  if (!userRaw) return null;
  const authDate = Number(params.get('auth_date')) || undefined;
  const maxAgeSeconds = options.maxAgeSeconds ?? 60 * 60 * 24;
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > maxAgeSeconds) return null;

  try {
    const user = JSON.parse(userRaw) as TelegramMiniAppUser;
    if (!user.id) return null;
    return {
      user,
      authDate,
    };
  } catch {
    return null;
  }
}

export function buildPsyoUserId(telegramUserId: number | string) {
  const pepper = process.env.PSYO_ID_PEPPER;
  if (!pepper) throw new Error('PSYO_ID_PEPPER_REQUIRED');
  return hmacHex(pepper, String(telegramUserId)).slice(0, 32);
}

export function buildTelegramSession(user: TelegramMiniAppUser, authDate?: number): TelegramSession {
  return {
    psyoUserId: buildPsyoUserId(user.id),
    firstName: user.first_name,
    username: user.username,
    languageCode: user.language_code,
    authDate,
  };
}
