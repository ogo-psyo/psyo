import { createHash } from 'node:crypto';
import sharp, { type Metadata } from 'sharp';
import { getBreed, type AvatarStyleId, type BreedId } from '@/lib/data';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { principalsAgree } from '@/lib/socialCore';

export const avatarBucket = 'pet-avatar-private';
export const avatarConsentVersion = 'avatar-provider-v1';
export const avatarPromptVersion = 'appearance-v1';
export const avatarStyles = new Set<AvatarStyleId>(['city', 'neon', 'winter', 'space', 'sticker']);
export const avatarModes = new Set(['text_to_image', 'image_to_image', 'variation'] as const);

export type AvatarMode = 'text_to_image' | 'image_to_image' | 'variation';
export type AvatarOwnerContext = {
  ownerId: string;
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  mode: 'supabase-auth' | 'telegram';
};

export class AvatarIdentityError extends Error {
  constructor(public code: string, public status: number, message = code) {
    super(message);
  }
}

export async function getAvatarOwnerContext(request: Request): Promise<AvatarOwnerContext> {
  const [auth, appSession] = await Promise.all([getRequestAuth(request), Promise.resolve(getAppSessionFromRequest(request))]);
  if (!principalsAgree({ bearerOwnerId: auth.user?.id, sessionOwnerId: appSession?.ownerId })) {
    throw new AvatarIdentityError('IDENTITY_PRINCIPAL_MISMATCH', 401);
  }
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  // Avatar data is BFF-only. Authentication establishes the principal, while every
  // DB/storage operation runs through the service role after an explicit owner/pet check.
  const supabase = getSupabaseAdmin();
  if (!ownerId) throw new AvatarIdentityError('AUTH_REQUIRED', 401);
  if (!supabase) throw new AvatarIdentityError('STORAGE_REQUIRED', 503);
  return { ownerId, supabase, mode: auth.user ? 'supabase-auth' : 'telegram' };
}

export async function requireOwnedPet(context: AvatarOwnerContext, petId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(petId)) throw new AvatarIdentityError('PET_NOT_FOUND', 404);
  const result = await context.supabase
    .from('pets')
    .select('id,name,breed_id,custom_breed,active_avatar_asset_id,avatar_source')
    .eq('id', petId)
    .eq('owner_id', context.ownerId)
    .maybeSingle();
  if (result.error) throw new AvatarIdentityError('PET_READ_FAILED', 500);
  if (!result.data) throw new AvatarIdentityError('PET_NOT_FOUND', 404);
  return result.data;
}

export function validateIdempotencyKey(value: string | null) {
  const key = value?.trim() ?? '';
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new AvatarIdentityError('IDEMPOTENCY_KEY_REQUIRED', 400);
  return key;
}

export function parseAvatarMode(value: unknown): AvatarMode {
  const mode = String(value || 'text_to_image') as AvatarMode;
  if (!avatarModes.has(mode)) throw new AvatarIdentityError('INVALID_AVATAR_MODE', 400);
  return mode;
}

export function parseAvatarStyle(value: unknown): AvatarStyleId {
  const style = String(value || 'city') as AvatarStyleId;
  if (!avatarStyles.has(style)) throw new AvatarIdentityError('INVALID_AVATAR_STYLE', 400);
  return style;
}

export function boundedOwnerPrompt(value: unknown) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length > 280) throw new AvatarIdentityError('AVATAR_PROMPT_TOO_LONG', 400);
  return normalized;
}

export async function sanitizeAvatarImage(file: File) {
  if (file.size <= 0) throw new AvatarIdentityError('PHOTO_REQUIRED', 400);
  if (file.size > 8 * 1024 * 1024) throw new AvatarIdentityError('PHOTO_TOO_LARGE', 413);
  const source = Buffer.from(await file.arrayBuffer());
  let metadata: Metadata;
  try {
    metadata = await sharp(source, { failOn: 'error', limitInputPixels: 64_000_000 }).metadata();
  } catch {
    throw new AvatarIdentityError('UNSUPPORTED_IMAGE_TYPE', 415);
  }
  if (!['jpeg', 'png', 'webp', 'heif'].includes(metadata.format || '')) throw new AvatarIdentityError('UNSUPPORTED_IMAGE_TYPE', 415);
  if (!metadata.width || !metadata.height || metadata.width < 128 || metadata.height < 128 || metadata.width > 8192 || metadata.height > 8192) {
    throw new AvatarIdentityError('INVALID_IMAGE_DIMENSIONS', 422);
  }
  const buffer = await sharp(source, { failOn: 'error', limitInputPixels: 64_000_000 })
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  const output = await sharp(buffer).metadata();
  return {
    buffer,
    mimeType: 'image/jpeg',
    width: output.width || metadata.width,
    height: output.height || metadata.height,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

export function buildServerAvatarPrompt(input: {
  pet: { name?: string | null; breed_id?: string | null; custom_breed?: string | null };
  style: AvatarStyleId;
  ownerPrompt?: string;
  mode: AvatarMode;
}) {
  const styleMap: Record<AvatarStyleId, string> = {
    city: 'warm premium 3D portrait, soft city light',
    neon: 'premium neon portrait, restrained glow',
    winter: 'cozy winter portrait, soft natural snow light',
    space: 'playful space explorer portrait, clean stars',
    sticker: 'bold clean sticker portrait, expressive face',
  };
  const breedId = String(input.pet.breed_id || 'mixed') as BreedId;
  let breed = input.pet.custom_breed || '';
  try { breed ||= getBreed(breedId).title; } catch { breed ||= 'dog'; }
  const identityRule = input.mode === 'text_to_image'
    ? 'This is an imagined portrait based only on the owner description; do not imply exact likeness.'
    : 'Preserve the identity, coat pattern, face proportions and distinctive marks of the reference dog.';
  return [
    'Create one dog portrait for the Pso app.',
    identityRule,
    `Breed or type: ${String(breed).slice(0, 80)}.`,
    styleMap[input.style],
    input.ownerPrompt ? `Owner appearance note: ${input.ownerPrompt}.` : '',
    'One dog only. No people, text, logos, medical context or location data. Clean background.',
  ].filter(Boolean).join(' ');
}

export async function storePrivateAvatar(input: {
  context: AvatarOwnerContext;
  petId: string;
  buffer: Buffer;
  kind: 'reference_photo' | 'avatar_image';
  sourceKind: 'uploaded' | 'generated';
  mimeType: string;
  width: number;
  height: number;
  sha256: string;
  jobId?: string | null;
  parentAssetId?: string | null;
  styleId?: string | null;
  generationMode?: AvatarMode | null;
  provider?: string | null;
  model?: string | null;
  retentionUntil?: string | null;
}) {
  const id = crypto.randomUUID();
  const path = `${input.context.ownerId}/${input.petId}/${id}.jpg`;
  const uploaded = await input.context.supabase.storage.from(avatarBucket).upload(path, input.buffer, {
    contentType: input.mimeType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploaded.error) throw new AvatarIdentityError('AVATAR_STORAGE_FAILED', 500);
  const row = await input.context.supabase.from('avatar_assets').insert({
    id,
    job_id: input.jobId ?? null,
    owner_id: input.context.ownerId,
    pet_id: input.petId,
    asset_type: input.kind,
    source_kind: input.sourceKind,
    generation_mode: input.generationMode ?? null,
    parent_asset_id: input.parentAssetId ?? null,
    provider: input.provider ?? null,
    model: input.model ?? null,
    style_id: input.styleId ?? null,
    storage_bucket: avatarBucket,
    storage_path: path,
    public_url: null,
    mime_type: input.mimeType,
    width: input.width,
    height: input.height,
    sha256: input.sha256,
    moderation_status: input.sourceKind === 'uploaded' ? 'not_required' : 'approved',
    visibility: 'private',
    status: 'draft',
    retention_until: input.retentionUntil ?? null,
  }).select('*').single();
  if (row.error) {
    await input.context.supabase.storage.from(avatarBucket).remove([path]);
    throw new AvatarIdentityError('AVATAR_ASSET_WRITE_FAILED', 500);
  }
  return row.data;
}

export function avatarErrorResponse(error: unknown) {
  const known = error instanceof AvatarIdentityError ? error : new AvatarIdentityError('AVATAR_INTERNAL_ERROR', 500);
  return { error: known.code, status: known.status };
}

export async function purgeAvatarObjectsForPets(input: {
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>;
  ownerId: string;
  petIds?: string[];
}) {
  let query = input.supabase.from('avatar_assets')
    .select('id,pet_id,storage_bucket,storage_path')
    .eq('owner_id', input.ownerId)
    .is('deleted_at', null);
  if (input.petIds?.length) query = query.in('pet_id', input.petIds);
  const assets = await query;
  if (assets.error) throw new AvatarIdentityError('AVATAR_ASSET_READ_FAILED', 500);
  const byBucket = new Map<string, string[]>();
  for (const asset of assets.data || []) {
    if (!asset.storage_bucket || !asset.storage_path) continue;
    const paths = byBucket.get(asset.storage_bucket) || [];
    paths.push(asset.storage_path);
    byBucket.set(asset.storage_bucket, paths);
  }
  for (const [bucket, paths] of byBucket) {
    for (let index = 0; index < paths.length; index += 100) {
      const removed = await input.supabase.storage.from(bucket).remove(paths.slice(index, index + 100));
      if (removed.error) throw new AvatarIdentityError('AVATAR_STORAGE_DELETE_FAILED', 500);
    }
  }
  return { objectsDeleted: Array.from(byBucket.values()).reduce((sum, paths) => sum + paths.length, 0) };
}
