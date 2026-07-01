import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TelegramSessionDto } from '@/packages/contracts';

const cookieName = 'psyo_session';
const sessionTtlSeconds = 60 * 60 * 24 * 7;

type SignedSessionPayload = {
  psyoUserId: string;
  ownerId?: string;
  authDate?: number;
  locale?: string;
  iat: number;
  exp: number;
};

function signingKey() {
  const key = process.env.PSYO_SESSION_SIGNING_KEY;
  if (!key) throw new Error('PSYO_SESSION_SIGNING_KEY_REQUIRED');
  return key;
}

function appOrigins(request: Request) {
  const origins = new Set<string>();
  try { origins.add(new URL(request.url).origin); } catch {}
  for (const value of [process.env.NEXT_PUBLIC_APP_URL, process.env.APP_URL]) {
    if (!value) continue;
    try { origins.add(new URL(value).origin); } catch {}
  }
  if (process.env.VERCEL_URL) origins.add(`https://${process.env.VERCEL_URL}`);
  return origins;
}

export function isAppSessionOriginAllowed(request: Request) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  return appOrigins(request).has(origin);
}

function base64url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function hmac(value: string) {
  return createHmac('sha256', signingKey()).update(value).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAppSessionToken(input: { psyoUserId: string; ownerId?: string; authDate?: number; locale?: string }) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SignedSessionPayload = {
    psyoUserId: input.psyoUserId,
    ownerId: input.ownerId,
    authDate: input.authDate,
    locale: input.locale,
    iat: issuedAt,
    exp: issuedAt + sessionTtlSeconds,
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  return {
    token: `${encodedPayload}.${hmac(encodedPayload)}`,
    issuedAt,
    expiresAt: payload.exp,
    maxAge: sessionTtlSeconds,
  };
}

export function verifyAppSessionToken(token: string): TelegramSessionDto | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;
  if (!safeEqual(hmac(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SignedSessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.psyoUserId || payload.exp <= now) return null;
    return {
      psyoUserId: payload.psyoUserId,
      ownerId: payload.ownerId,
      authDate: payload.authDate,
      locale: payload.locale,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
    };
  } catch {
    return null;
  }
}

export function getAppSessionFromRequest(request: Request) {
  if (!isAppSessionOriginAllowed(request)) return null;
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  if (!match) return null;
  return verifyAppSessionToken(decodeURIComponent(match.slice(cookieName.length + 1)));
}

export function setAppSessionCookie(response: Response, token: string, maxAge: number) {
  response.headers.append('Set-Cookie', `${cookieName}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Secure`);
}
