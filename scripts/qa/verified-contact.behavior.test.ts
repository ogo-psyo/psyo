import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.PSYO_ID_PEPPER = 'verified-contact-qa-pepper';
process.env.PSYO_SESSION_SIGNING_KEY = 'verified-contact-qa-session-key';

const botToken = '123456:verified-contact-test-token';

function signTelegramInitData(user: Record<string, unknown>) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAE-verified-contact',
    user: JSON.stringify(user),
  });
  const dataCheckString = Array.from(params.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secretKey).update(dataCheckString).digest('hex'));
  return params.toString();
}

async function main() {
const telegram = await import('../../lib/server/telegram.ts');
const appSession = await import('../../lib/server/appSession.ts');

const verified = telegram.verifyTelegramInitData(signTelegramInitData({
  id: 7001,
  first_name: 'Луна',
  username: 'luna_owner',
}), botToken);
assert.ok(verified, 'signed Telegram initData should verify');

const contactFromUser = (telegram as Record<string, unknown>).verifiedTelegramContactFromUser;
assert.equal(typeof contactFromUser, 'function', 'Telegram module must derive a verified contact from signed user data');

const verifiedContact = (contactFromUser as (user: unknown) => unknown)(verified.user);
assert.deepEqual(verifiedContact, { username: 'luna_owner' });

const signed = (appSession.createAppSessionToken as (input: Record<string, unknown>) => { token: string })({
  psyoUserId: telegram.buildPsyoUserId(verified.user.id),
  ownerId: '00000000-0000-4000-8000-000000000001',
  authDate: verified.authDate,
  verifiedTelegramContact: verifiedContact,
});
const restored = appSession.verifyAppSessionToken(signed.token) as Record<string, unknown> | null;
assert.deepEqual(restored?.verifiedTelegramContact, { username: 'luna_owner' }, 'signed app session must preserve verified Telegram contact');

const verifiedWithoutUsername = telegram.verifyTelegramInitData(signTelegramInitData({
  id: 7002,
  first_name: 'Без имени',
}), botToken);
assert.ok(verifiedWithoutUsername);
assert.deepEqual((contactFromUser as (user: unknown) => unknown)(verifiedWithoutUsername.user), { username: null });

let socialService: Record<string, unknown> | null = null;
try {
  socialService = await import('../../lib/server/socialService.ts');
} catch {}
assert.ok(socialService, 'social service must enforce the verified-contact boundary');

const validateContactBoundary = socialService.validateSocialContactBoundary as (input: unknown) => { ok: boolean; code?: string };
const bindVerifiedTelegramContact = socialService.bindVerifiedTelegramContact as (input: unknown, contact: unknown) => { ok: boolean; value?: Record<string, unknown> };
const contactForAcceptedRequest = socialService.contactForAcceptedRequest as (input: unknown) => string | null;
const missingUsernameAction = socialService.MISSING_TELEGRAM_USERNAME_ACTION;
assert.equal(typeof validateContactBoundary, 'function');
assert.equal(typeof bindVerifiedTelegramContact, 'function', 'profile persistence must bind only server-verified Telegram contact');
assert.equal(missingUsernameAction, 'Добавьте имя пользователя в настройках Telegram, чтобы открыть чат');
assert.deepEqual(validateContactBoundary({ enabled: true, telegramUsername: 'someone_else' }), {
  ok: false,
  code: 'TELEGRAM_CONTACT_SERVER_CONTROLLED',
  field: 'telegramUsername',
});
assert.deepEqual(validateContactBoundary({ enabled: true }), { ok: true });
assert.deepEqual(bindVerifiedTelegramContact({ enabled: true }, { username: 'luna_owner' }), {
  ok: true,
  value: { enabled: true, telegram_username: 'luna_owner' },
});

const acceptedRequest = {
  status: 'accepted',
  senderOwnerId: 'owner-a',
  recipientOwnerId: 'owner-b',
};
assert.equal(contactForAcceptedRequest({
  request: { ...acceptedRequest, status: 'pending' },
  viewerOwnerId: 'owner-a',
  otherContact: { username: 'luna_owner' },
}), null, 'contact must stay hidden before mutual consent');
assert.equal(contactForAcceptedRequest({
  request: acceptedRequest,
  viewerOwnerId: 'owner-a',
  otherContact: { username: 'luna_owner' },
}), 'https://t.me/luna_owner');
assert.equal(contactForAcceptedRequest({
  request: acceptedRequest,
  viewerOwnerId: 'outsider',
  otherContact: { username: 'luna_owner' },
}), null, 'accepted contact must stay hidden from non-participants');
assert.equal(contactForAcceptedRequest({
  request: acceptedRequest,
  viewerOwnerId: 'owner-a',
  otherContact: { username: null },
}), null, 'missing verified username must never fall back to a manual contact');

console.log('verified Telegram contact behavior ok');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
