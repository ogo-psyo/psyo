#!/usr/bin/env node
import { createHmac } from 'node:crypto';

const botToken = '123456:test-token';
process.env.PSYO_ID_PEPPER = 'qa-pepper';
process.on('warning', (warning) => {
  if (warning.code !== 'MODULE_TYPELESS_PACKAGE_JSON') {
    console.warn(warning);
  }
});

const { buildTelegramSession, verifyTelegramInitData } = await import('../../lib/server/telegram.ts');

function signTelegramInitData(fields) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    params.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }

  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

const now = Math.floor(Date.now() / 1000);
const user = {
  id: 90582596,
  first_name: 'Ruslan',
  username: 'uglanov',
  language_code: 'ru',
};

const validInitData = signTelegramInitData({
  auth_date: String(now),
  query_id: 'AAE-qa-fixture',
  user,
});

const verified = verifyTelegramInitData(validInitData, botToken);
if (!verified) throw new Error('fresh signed initData should verify');
if (verified.user.id !== user.id) throw new Error('verified user id mismatch');
if (verified.authDate !== now) throw new Error('verified auth_date mismatch');

const tamperedInitData = validInitData.replace('Ruslan', 'Other');
if (verifyTelegramInitData(tamperedInitData, botToken)) {
  throw new Error('tampered initData must be rejected');
}

const expiredInitData = signTelegramInitData({
  auth_date: String(now - 60 * 60 * 25),
  query_id: 'AAE-expired-fixture',
  user,
});
if (verifyTelegramInitData(expiredInitData, botToken)) {
  throw new Error('expired initData must be rejected');
}

const noUserInitData = signTelegramInitData({
  auth_date: String(now),
  query_id: 'AAE-no-user-fixture',
});
if (verifyTelegramInitData(noUserInitData, botToken)) {
  throw new Error('initData without user must be rejected');
}

const session = buildTelegramSession(user, now);
if (!session.psyoUserId || session.psyoUserId.includes(String(user.id))) {
  throw new Error('session must expose a pseudonymous psyoUserId, not the raw Telegram id');
}
if ('id' in session) {
  throw new Error('session must not expose raw Telegram id');
}
if (session.firstName !== user.first_name || session.username !== user.username) {
  throw new Error('session safe display fields mismatch');
}

console.log('telegram initData contract ok');
