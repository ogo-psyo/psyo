import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canRevealTelegramContact,
  inviteAvailability,
  transitionSocialRequest,
  validateSocialContactBoundary,
} from '../../lib/socialCore.ts';
import {
  contactForAcceptedRequest,
  hashInviteToken,
  socialRequestFingerprint,
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
  assert.equal(validateSocialContactBoundary({ telegramUsername: 'spoofed_owner' }).ok, false);
});

test('same request payload has one fingerprint and changed payload does not', () => {
  const base = { senderPetId: 'pet-a', recipientPetId: 'pet-b', scenario: 'walk' as const, source: 'organic' as const, message: null };
  assert.equal(socialRequestFingerprint(base), socialRequestFingerprint({ ...base }));
  assert.notEqual(socialRequestFingerprint(base), socialRequestFingerprint({ ...base, recipientPetId: 'pet-c' }));
});
