import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canRevealTelegramContact,
  inviteAvailability,
  principalsAgree,
  transitionSocialRequest,
  validateSocialContactBoundary,
} from '../../lib/socialCore.ts';
import {
  contactForAcceptedRequest,
  contactUrlForRequestRow,
  hashInviteToken,
  socialRequestFingerprint,
  enforceSocialRateLimit,
  revokeSocialDiscovery,
} from '../../lib/server/socialService.ts';

test('one-use invite expires and cannot be reused', () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);
  assert.deepEqual(inviteAvailability({ expiresAt: future, usedAt: null }), { ok: true });
  assert.deepEqual(inviteAvailability({ expiresAt: future, usedAt: new Date() }), { ok: false, code: 'INVITE_GONE' });
  assert.deepEqual(inviteAvailability({ expiresAt: past, usedAt: null }), { ok: false, code: 'INVITE_GONE' });
  assert.equal(hashInviteToken('secret-token').length, 64);
  assert.equal(hashInviteToken('secret-token'), hashInviteToken('secret-token'));
});

test('request lifecycle is actor-scoped, deterministic and retry-safe', () => {
  assert.deepEqual(transitionSocialRequest({ status: 'pending', actor: 'recipient', action: 'accept' }), { ok: true, status: 'accepted', replayed: false });
  assert.deepEqual(transitionSocialRequest({ status: 'accepted', actor: 'recipient', action: 'accept' }), { ok: true, status: 'accepted', replayed: true });
  assert.deepEqual(transitionSocialRequest({ status: 'accepted', actor: 'recipient', action: 'reject' }), { ok: false, code: 'REQUEST_ALREADY_RESOLVED' });
  assert.deepEqual(transitionSocialRequest({ status: 'pending', actor: 'sender', action: 'accept' }), { ok: false, code: 'RECIPIENT_ACTION_REQUIRED' });
  assert.deepEqual(transitionSocialRequest({ status: 'pending', actor: 'recipient', action: 'cancel' }), { ok: false, code: 'SENDER_ACTION_REQUIRED' });
  assert.deepEqual(transitionSocialRequest({ status: 'accepted', actor: 'sender', action: 'block' }), { ok: true, status: 'blocked', replayed: false });
});

test('contact remains hidden before consent and comes only from verified session data', () => {
  const pending = { status: 'pending', senderOwnerId: 'owner-a', recipientOwnerId: 'owner-b' };
  const accepted = { ...pending, status: 'accepted' };
  assert.equal(canRevealTelegramContact(pending, 'owner-a'), false);
  assert.equal(contactForAcceptedRequest({ request: pending, viewerOwnerId: 'owner-a', otherContact: { username: 'verified_owner' } }), null);
  assert.equal(contactForAcceptedRequest({ request: accepted, viewerOwnerId: 'owner-a', otherContact: { username: 'verified_owner' } }), 'https://t.me/verified_owner');
  assert.equal(contactForAcceptedRequest({ request: accepted, viewerOwnerId: 'outsider', otherContact: { username: 'verified_owner' } }), null);
  assert.equal(contactForAcceptedRequest({ request: accepted, viewerOwnerId: 'owner-a', otherContact: { username: null } }), null);
  assert.equal(contactForAcceptedRequest({ request: accepted, viewerOwnerId: 'owner-a', otherContact: { username: 'verified_owner' }, pairBlocked: true }), null);
  assert.equal(validateSocialContactBoundary({ telegramUsername: 'spoofed_owner' }).ok, false);
});

test('persisted Telegram contact expires unless its owner recently reopened Pso', () => {
  const base = {
    status: 'accepted',
    sender_owner_id: 'owner-a',
    recipient_owner_id: 'owner-b',
    sender_contact_username: 'owner_a',
    recipient_contact_username: 'owner_b',
  };
  assert.equal(contactUrlForRequestRow({
    ...base,
    recipient_contact_verified_at: new Date().toISOString(),
  }, 'owner-a'), 'https://t.me/owner_b');
  assert.equal(contactUrlForRequestRow({
    ...base,
    recipient_contact_verified_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  }, 'owner-a'), null);
  assert.equal(contactUrlForRequestRow(base, 'owner-a'), null);
});

test('retained accepted request id cannot reveal contact after either-side block', () => {
  const retained = { status: 'accepted', senderOwnerId: 'owner-a', recipientOwnerId: 'owner-b' };
  assert.equal(canRevealTelegramContact(retained, 'owner-a', true, true), false);
  assert.equal(canRevealTelegramContact(retained, 'owner-b', true, true), false);
});

test('bearer and Telegram app-session principals must agree', () => {
  assert.equal(principalsAgree({ bearerOwnerId: 'owner-a', sessionOwnerId: 'owner-a' }), true);
  assert.equal(principalsAgree({ bearerOwnerId: 'owner-a', sessionOwnerId: 'owner-b' }), false);
  assert.equal(principalsAgree({ bearerOwnerId: 'owner-a', sessionOwnerId: null }), true);
});

test('per-owner rate limiter rejects a full window', async () => {
  const query = {
    select() { return this; }, eq() { return this; }, gte() { return Promise.resolve({ count: 10, error: null }); },
  };
  const supabase = { from() { return query; } } as any;
  await assert.rejects(() => enforceSocialRateLimit({
    supabase, table: 'social_friend_invites', ownerColumn: 'inviter_owner_id',
    ownerId: 'owner-a', limit: 10, windowMs: 60_000,
  }), /SOCIAL_RATE_LIMITED/);
});

test('opting out preserves explicit invites and cancels only organic pending requests', async () => {
  const calls: Array<{ table: string; update: unknown }> = [];
  function builder(table: string) {
    let updateValue: unknown;
    const chain: any = {
      update(value: unknown) { updateValue = value; calls.push({ table, update: value }); return chain; },
      eq() { return chain; }, is() { return chain; }, or() { return chain; },
      then(resolve: (value: unknown) => void) { resolve({ error: null }); },
    };
    return chain;
  }
  const supabase = { from(table: string) { return builder(table); } } as any;
  await revokeSocialDiscovery(supabase, 'owner-a', 'pet-a');
  assert.deepEqual(calls.map((call) => call.table), [
    'social_discovery_profiles', 'social_match_requests',
  ]);
  assert.deepEqual(calls[0].update, { discoverable: false });
  assert.equal((calls[1].update as any).status, 'cancelled');
});

test('friend invite consent is independent of organic discovery visibility', () => {
  assert.deepEqual(transitionSocialRequest({ status: 'pending', actor: 'recipient', action: 'accept' }), {
    ok: true, status: 'accepted', replayed: false,
  });
});

test('same request payload has one fingerprint and changed payload does not', () => {
  const base = { senderPetId: 'pet-a', recipientPetId: 'pet-b', scenario: 'walk' as const, source: 'organic' as const, message: null };
  assert.equal(socialRequestFingerprint(base), socialRequestFingerprint({ ...base }));
  assert.notEqual(socialRequestFingerprint(base), socialRequestFingerprint({ ...base, recipientPetId: 'pet-c' }));
});
