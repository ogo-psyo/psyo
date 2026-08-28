import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  assertAvatarPromptPolicy,
  AvatarIdentityError,
  boundedOwnerPrompt,
  buildServerAvatarPrompt,
  parseAvatarMode,
  parseAvatarStyle,
  requireOwnedPet,
  sanitizeAvatarImage,
  validateIdempotencyKey,
} from '../../lib/server/avatarIdentity';

function petLookup(data: unknown) {
  const filters: Record<string, string> = {};
  const chain: any = {
    select: () => chain,
    eq: (field: string, value: string) => { filters[field] = value; return chain; },
    maybeSingle: async () => ({ data: filters.id === '11111111-1111-4111-8111-111111111111' && filters.owner_id === 'owner-a' ? data : null, error: null }),
  };
  return { from: () => chain };
}

test('server builds a bounded appearance-only prompt without medical or social profile data', () => {
  const prompt = buildServerAvatarPrompt({
    pet: { name: 'Плутон', breed_id: 'xoloitzcuintli', custom_breed: null },
    style: 'city',
    mode: 'image_to_image',
    ownerPrompt: 'белое пятно на груди',
  });
  assert.match(prompt, /Preserve the identity/);
  assert.match(prompt, /белое пятно на груди/);
  assert.doesNotMatch(prompt, /Плутон|аллерг|лекар|район|характер/i);
});

test('text-only generation is explicitly described as imagined, not an exact likeness', () => {
  const prompt = buildServerAvatarPrompt({ pet: { breed_id: 'mixed' }, style: 'sticker', mode: 'text_to_image' });
  assert.match(prompt, /imagined portrait/);
  assert.match(prompt, /do not imply exact likeness/);
});

test('mode, style, prompt and idempotency inputs are constrained', () => {
  assert.equal(parseAvatarMode('variation'), 'variation');
  assert.equal(parseAvatarStyle('space'), 'space');
  assert.equal(validateIdempotencyKey('avatar:12345678'), 'avatar:12345678');
  assert.throws(() => parseAvatarMode('unsafe'), (error: unknown) => error instanceof AvatarIdentityError && error.code === 'INVALID_AVATAR_MODE');
  assert.throws(() => parseAvatarStyle('unsafe'), (error: unknown) => error instanceof AvatarIdentityError && error.code === 'INVALID_AVATAR_STYLE');
  assert.throws(() => boundedOwnerPrompt('x'.repeat(281)), (error: unknown) => error instanceof AvatarIdentityError && error.code === 'AVATAR_PROMPT_TOO_LONG');
  assert.doesNotThrow(() => assertAvatarPromptPolicy('сохранить белое пятно на груди'));
  assert.throws(() => assertAvatarPromptPolicy('добавить кровь и оружие'), (error: unknown) => error instanceof AvatarIdentityError && error.code === 'AVATAR_MODERATION_REJECTED');
  assert.throws(() => validateIdempotencyKey('short'), (error: unknown) => error instanceof AvatarIdentityError && error.code === 'IDEMPOTENCY_KEY_REQUIRED');
});

test('uploaded images are decoded, resized and normalized without source metadata', async () => {
  const source = await sharp({ create: { width: 300, height: 180, channels: 3, background: '#d6ff56' } }).withMetadata({ orientation: 6 }).png().toBuffer();
  const file = new File([source], 'dog.png', { type: 'image/png' });
  const result = await sanitizeAvatarImage(file);
  const metadata = await sharp(result.buffer).metadata();
  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(metadata.format, 'jpeg');
  assert.equal(metadata.exif, undefined);
  assert.ok(result.width >= 128 && result.height >= 128);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
});

test('invalid image bytes are rejected before storage or provider use', async () => {
  const file = new File([Buffer.from('not an image')], 'dog.jpg', { type: 'image/jpeg' });
  await assert.rejects(() => sanitizeAvatarImage(file), (error: unknown) => error instanceof AvatarIdentityError && error.code === 'UNSUPPORTED_IMAGE_TYPE');
});

test('owner/pet lookup rejects another dog even when its UUID is valid', async () => {
  const context = { ownerId: 'owner-a', supabase: petLookup({ id: '11111111-1111-4111-8111-111111111111' }), mode: 'telegram' } as any;
  await assert.doesNotReject(() => requireOwnedPet(context, '11111111-1111-4111-8111-111111111111'));
  await assert.rejects(
    () => requireOwnedPet(context, '22222222-2222-4222-8222-222222222222'),
    (error: unknown) => error instanceof AvatarIdentityError && error.code === 'PET_NOT_FOUND',
  );
});
