import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  blurredSignalLocation,
  canRevealTelegramContact,
  groupSocialCandidates,
  normalizeSocialProfileInput,
  normalizeWalkSignalInput,
  validateSocialContactBoundary,
  type SocialCandidateSource,
  type SocialContactRequest,
  type SocialProfile,
  type SocialScenario,
  type WalkSignal,
  type WalkSignalInput,
} from '@/lib/socialCore';
import type { VerifiedTelegramContact } from '@/lib/server/telegram';

export { normalizeSocialProfileInput, normalizeWalkSignalInput, validateSocialContactBoundary };

export const MISSING_TELEGRAM_USERNAME_ACTION = 'Добавьте имя пользователя в настройках Telegram, чтобы открыть чат';

export function bindVerifiedTelegramContact(input: unknown, contact: VerifiedTelegramContact) {
  const boundary = validateSocialContactBoundary(input);
  if (!boundary.ok) return boundary;
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    ok: true as const,
    value: { ...source, telegram_username: contact.username },
  };
}

export function contactForAcceptedRequest(input: {
  request: SocialContactRequest;
  viewerOwnerId: string;
  otherContact: VerifiedTelegramContact;
  pairBlocked?: boolean;
  participantsAvailable?: boolean;
}) {
  if (!canRevealTelegramContact(input.request, input.viewerOwnerId, input.participantsAvailable !== false, input.pairBlocked === true)) return null;
  if (!input.otherContact.username) return null;
  return `https://t.me/${input.otherContact.username}`;
}

export function mapSocialProfile(row: any): SocialProfile {
  const lat = Number(row.coarse_lat);
  const lng = Number(row.coarse_lng);
  return {
    petId: row.pet_id,
    discoverable: Boolean(row.discoverable),
    city: row.city,
    district: row.district ?? null,
    coarseLocation: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    scenarios: Array.isArray(row.scenarios) ? row.scenarios : [],
  };
}

export function socialProfilePayload(profile: Omit<SocialProfile, 'petId'>) {
  return {
    discoverable: profile.discoverable,
    city: profile.city,
    district: profile.district,
    coarse_lat: profile.coarseLocation?.lat ?? null,
    coarse_lng: profile.coarseLocation?.lng ?? null,
    scenarios: profile.scenarios,
  };
}

export async function requireOwnedPet(supabase: SupabaseClient, ownerId: string, petId: string) {
  const { data, error } = await supabase
    .from('pets')
    .select('id, owner_id, name, avatar_url')
    .eq('id', petId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) throw new Error('SOCIAL_STORAGE_FAILED');
  return data;
}

export async function ownerIdForPet(supabase: SupabaseClient, petId: string) {
  const { data, error } = await supabase.from('pets').select('owner_id').eq('id', petId).maybeSingle();
  if (error) throw new Error('SOCIAL_STORAGE_FAILED');
  return data?.owner_id as string | undefined;
}

export async function excludedOwnerIds(supabase: SupabaseClient, ownerId: string) {
  const [blocks, reports] = await Promise.all([
    supabase.from('social_blocks').select('blocker_owner_id, blocked_owner_id')
      .or(`blocker_owner_id.eq.${ownerId},blocked_owner_id.eq.${ownerId}`),
    supabase.from('social_reports').select('reporter_owner_id, reported_owner_id')
      .eq('reporter_owner_id', ownerId),
  ]);
  if (blocks.error || reports.error) throw new Error('SOCIAL_STORAGE_FAILED');
  const excluded = new Set<string>();
  for (const row of blocks.data ?? []) {
    excluded.add(row.blocker_owner_id === ownerId ? row.blocked_owner_id : row.blocker_owner_id);
  }
  for (const row of reports.data ?? []) excluded.add(row.reported_owner_id);
  return excluded;
}

export async function isOwnerPairBlocked(supabase: SupabaseClient, leftOwnerId: string, rightOwnerId: string) {
  const { data, error } = await supabase.from('social_blocks')
    .select('blocker_owner_id')
    .or(`and(blocker_owner_id.eq.${leftOwnerId},blocked_owner_id.eq.${rightOwnerId}),and(blocker_owner_id.eq.${rightOwnerId},blocked_owner_id.eq.${leftOwnerId})`)
    .limit(1);
  if (error) throw new Error('SOCIAL_STORAGE_FAILED');
  return Boolean(data?.length);
}

export async function areRequestPetsDiscoverable(supabase: SupabaseClient, senderPetId: string, recipientPetId: string) {
  const { data, error } = await supabase.from('social_discovery_profiles')
    .select('pet_id, discoverable').in('pet_id', [senderPetId, recipientPetId]);
  if (error) throw new Error('SOCIAL_STORAGE_FAILED');
  return (data ?? []).length === 2 && !data?.some((profile) => !profile.discoverable);
}

export async function enforceSocialRateLimit(input: {
  supabase: SupabaseClient;
  table: 'social_friend_invites' | 'social_match_requests' | 'social_reports';
  ownerColumn: 'inviter_owner_id' | 'sender_owner_id' | 'reporter_owner_id';
  ownerId: string;
  limit: number;
  windowMs: number;
}) {
  const since = new Date(Date.now() - input.windowMs).toISOString();
  const { count, error } = await input.supabase.from(input.table)
    .select('id', { count: 'exact', head: true })
    .eq(input.ownerColumn, input.ownerId)
    .gte('created_at', since);
  if (error) throw new Error('SOCIAL_STORAGE_FAILED');
  if ((count ?? 0) >= input.limit) throw new Error('SOCIAL_RATE_LIMITED');
}

export async function revokeSocialDiscovery(supabase: SupabaseClient, ownerId: string, petId: string) {
  const now = new Date().toISOString();
  const [profile, requests] = await Promise.all([
    supabase.from('social_discovery_profiles').update({ discoverable: false }).eq('pet_id', petId),
    supabase.from('social_match_requests').update({ status: 'cancelled', responded_at: now })
      .eq('source', 'organic').eq('status', 'pending').or(`sender_pet_id.eq.${petId},recipient_pet_id.eq.${petId}`),
  ]);
  if (profile.error || requests.error) throw new Error('SOCIAL_STORAGE_FAILED');
}

export async function listCandidates(supabase: SupabaseClient, ownerId: string, petId: string) {
  const pet = await requireOwnedPet(supabase, ownerId, petId);
  if (!pet) return { code: 'PET_NOT_FOUND' as const };
  const { data: mineRow, error: mineError } = await supabase
    .from('social_discovery_profiles').select('*').eq('pet_id', petId).maybeSingle();
  if (mineError) throw new Error('SOCIAL_STORAGE_FAILED');
  if (!mineRow?.discoverable) return { code: 'DISCOVERY_NOT_ENABLED' as const };
  const mine = mapSocialProfile(mineRow);

  const excluded = await excludedOwnerIds(supabase, ownerId);
  const { data: candidateRows, error: candidateError } = await supabase.from('social_discovery_profiles')
    .select('*, pets!inner(id, owner_id, name, avatar_url, life_stage, weight_kg, social_profiles(temperament, energy_level, dog_friendly, play_style))')
    .eq('discoverable', true).eq('city', mine.city).neq('pet_id', petId)
    .order('updated_at', { ascending: false }).limit(120);
  if (candidateError) throw new Error('SOCIAL_STORAGE_FAILED');

  const candidates: SocialCandidateSource[] = (candidateRows ?? []).flatMap((row: any) => {
    const candidatePet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
    if (!candidatePet || candidatePet.owner_id === ownerId) return [];
    const traits = Array.isArray(candidatePet.social_profiles) ? candidatePet.social_profiles[0] : candidatePet.social_profiles;
    return [{
      petId: candidatePet.id,
      ownerId: candidatePet.owner_id,
      name: candidatePet.name,
      avatarUrl: candidatePet.avatar_url ?? null,
      lifeStage: candidatePet.life_stage ?? null,
      weightKg: Number.isFinite(Number(candidatePet.weight_kg)) ? Number(candidatePet.weight_kg) : null,
      temperament: traits?.temperament ?? null,
      energyLevel: traits?.energy_level ?? null,
      dogFriendly: traits?.dog_friendly ?? null,
      playStyle: traits?.play_style ?? null,
      profile: mapSocialProfile(row),
    }];
  });
  return { groups: groupSocialCandidates({ mine, candidates, excludedOwnerIds: excluded }) };
}

function signalPayload(input: WalkSignalInput & { expiresAt: string }) {
  return {
    city: input.city,
    district: input.district,
    coarse_lat: input.coarseLocation.lat,
    coarse_lng: input.coarseLocation.lng,
    starts_at: input.startsAt,
    expires_at: input.expiresAt,
    pace: input.pace,
    note: input.note,
    status: 'active',
  };
}

function mapWalkSignal(row: any, ownerId: string): WalkSignal | null {
  const pet = Array.isArray(row.pets) ? row.pets[0] : row.pets;
  if (!pet) return null;
  const profile = Array.isArray(pet.social_profiles) ? pet.social_profiles[0] : pet.social_profiles;
  const raw = { lat: Number(row.coarse_lat), lng: Number(row.coarse_lng) };
  if (!Number.isFinite(raw.lat) || !Number.isFinite(raw.lng)) return null;
  return {
    id: row.id,
    petId: row.pet_id,
    name: pet.name,
    avatarUrl: pet.avatar_url ?? null,
    city: row.city,
    district: row.district ?? null,
    approximateLocation: blurredSignalLocation(row.id, raw),
    privacyRadiusMeters: 700,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    pace: row.pace,
    note: row.note ?? null,
    temperament: profile?.temperament ?? null,
    dogFriendly: profile?.dog_friendly ?? null,
    isMine: row.owner_id === ownerId,
    contactVisibility: 'hidden_until_mutual_consent',
  };
}

export async function saveWalkSignal(input: {
  supabase: SupabaseClient;
  ownerId: string;
  value: WalkSignalInput & { expiresAt: string };
  idempotencyKey: string;
}) {
  const pet = await requireOwnedPet(input.supabase, input.ownerId, input.value.petId);
  if (!pet) return { code: 'PET_NOT_FOUND' as const };
  const fingerprint = createHash('sha256').update(JSON.stringify(input.value)).digest('hex');
  const { data: replay, error: replayError } = await input.supabase.from('social_walk_signals')
    .select('*').eq('owner_id', input.ownerId).eq('idempotency_key', input.idempotencyKey).maybeSingle();
  if (replayError) throw new Error('SOCIAL_STORAGE_FAILED');
  if (replay) {
    if (replay.request_fingerprint !== fingerprint) return { code: 'IDEMPOTENCY_KEY_REUSED' as const };
    return { signal: replay, replayed: true };
  }
  const { data: current, error: currentError } = await input.supabase.from('social_walk_signals')
    .select('id').eq('pet_id', input.value.petId).eq('status', 'active').maybeSingle();
  if (currentError) throw new Error('SOCIAL_STORAGE_FAILED');
  if (current) {
    const { data, error } = await input.supabase.from('social_walk_signals').update({
      ...signalPayload(input.value), idempotency_key: input.idempotencyKey, request_fingerprint: fingerprint,
    }).eq('id', current.id).eq('owner_id', input.ownerId).select('*').single();
    if (error) throw new Error('SOCIAL_STORAGE_FAILED');
    return { signal: data };
  }
  const { data, error } = await input.supabase.from('social_walk_signals').insert({
    owner_id: input.ownerId,
    pet_id: input.value.petId,
    ...signalPayload(input.value),
    idempotency_key: input.idempotencyKey,
    request_fingerprint: fingerprint,
  }).select('*').single();
  if (error) throw new Error(error.message || 'SOCIAL_STORAGE_FAILED');
  return { signal: data };
}

export async function closeWalkSignal(input: { supabase: SupabaseClient; ownerId: string; petId: string; status: 'completed' | 'cancelled' }) {
  const pet = await requireOwnedPet(input.supabase, input.ownerId, input.petId);
  if (!pet) return { code: 'PET_NOT_FOUND' as const };
  const { error } = await input.supabase.from('social_walk_signals').update({ status: input.status })
    .eq('owner_id', input.ownerId).eq('pet_id', input.petId).eq('status', 'active');
  if (error) throw new Error('SOCIAL_STORAGE_FAILED');
  return { ok: true as const };
}

export async function listWalkSignals(supabase: SupabaseClient, ownerId: string, petId: string) {
  const pet = await requireOwnedPet(supabase, ownerId, petId);
  if (!pet) return { code: 'PET_NOT_FOUND' as const };
  const { data: discovery, error: discoveryError } = await supabase.from('social_discovery_profiles')
    .select('city').eq('pet_id', petId).maybeSingle();
  if (discoveryError) throw new Error('SOCIAL_STORAGE_FAILED');
  const { data: ownSignal, error: ownSignalError } = discovery?.city
    ? { data: null, error: null }
    : await supabase.from('social_walk_signals').select('city').eq('owner_id', ownerId).eq('pet_id', petId).eq('status', 'active').maybeSingle();
  if (ownSignalError) throw new Error('SOCIAL_STORAGE_FAILED');
  const city = discovery?.city || ownSignal?.city;
  if (!city) return { signals: [] as WalkSignal[] };
  const excluded = await excludedOwnerIds(supabase, ownerId);
  const now = new Date().toISOString();
  await supabase.from('social_walk_signals').update({ status: 'expired' })
    .eq('status', 'active').lte('expires_at', now);
  const { data, error } = await supabase.from('social_walk_signals')
    .select('*, pets!inner(id, name, avatar_url, social_profiles(temperament, dog_friendly))')
    .eq('city', city).eq('status', 'active').gt('expires_at', now)
    .order('starts_at', { ascending: true }).limit(100);
  if (error) throw new Error('SOCIAL_STORAGE_FAILED');
  const signals = (data ?? []).filter((row: any) => row.owner_id === ownerId || !excluded.has(row.owner_id))
    .map((row: any) => mapWalkSignal(row, ownerId)).filter(Boolean) as WalkSignal[];
  return { signals };
}

export function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function socialRequestFingerprint(input: {
  senderPetId: string;
  recipientPetId: string;
  scenario: SocialScenario;
  source: 'organic' | 'invite' | 'signal';
  signalId?: string | null;
  message?: string | null;
}) {
  return createHash('sha256').update(JSON.stringify({
    senderPetId: input.senderPetId,
    recipientPetId: input.recipientPetId,
    scenario: input.scenario,
    source: input.source,
    signalId: input.signalId ?? null,
    message: input.message ?? null,
  })).digest('hex');
}

export async function createFriendInvite(input: {
  supabase: SupabaseClient;
  ownerId: string;
  petId: string;
  scenario: SocialScenario;
  verifiedContact: VerifiedTelegramContact;
  expiresInHours?: number;
}) {
  const pet = await requireOwnedPet(input.supabase, input.ownerId, input.petId);
  if (!pet) return { code: 'PET_NOT_FOUND' as const };
  await enforceSocialRateLimit({
    supabase: input.supabase, table: 'social_friend_invites', ownerColumn: 'inviter_owner_id',
    ownerId: input.ownerId, limit: 10, windowMs: 60 * 60 * 1000,
  });
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + Math.min(Math.max(input.expiresInHours ?? 72, 1), 168) * 60 * 60 * 1000);
  const { data, error } = await input.supabase.from('social_friend_invites').insert({
    token_hash: hashInviteToken(token),
    inviter_owner_id: input.ownerId,
    inviter_pet_id: input.petId,
    inviter_contact_username: input.verifiedContact.username,
    inviter_contact_verified_at: new Date().toISOString(),
    scenario: input.scenario,
    expires_at: expiresAt.toISOString(),
  }).select('id, expires_at').single();
  if (error) throw new Error('SOCIAL_STORAGE_FAILED');
  return { token, inviteId: data.id, expiresAt: data.expires_at };
}

export async function consumeFriendInvite(input: {
  supabase: SupabaseClient;
  token: string;
  recipientOwnerId: string;
  recipientPetId: string;
  idempotencyKey: string;
  verifiedContact: VerifiedTelegramContact;
}) {
  const { data, error } = await input.supabase.rpc('consume_social_friend_invite', {
    p_token_hash: hashInviteToken(input.token),
    p_recipient_owner_id: input.recipientOwnerId,
    p_recipient_pet_id: input.recipientPetId,
    p_idempotency_key: input.idempotencyKey,
    p_recipient_contact_username: input.verifiedContact.username,
  });
  if (error) throw new Error(error.message || 'SOCIAL_STORAGE_FAILED');
  return data?.request;
}

export function contactUrlForRequestRow(row: any, viewerOwnerId: string, pairBlocked = false, participantsAvailable = true) {
  const otherUsername = row.sender_owner_id === viewerOwnerId
    ? row.recipient_contact_username
    : row.sender_contact_username;
  const otherVerifiedAt = row.sender_owner_id === viewerOwnerId
    ? row.recipient_contact_verified_at
    : row.sender_contact_verified_at;
  const verifiedAt = Date.parse(String(otherVerifiedAt ?? ''));
  if (!Number.isFinite(verifiedAt) || Date.now() - verifiedAt > 7 * 24 * 60 * 60 * 1000) return null;
  return contactForAcceptedRequest({
    request: {
      status: row.status,
      senderOwnerId: row.sender_owner_id,
      recipientOwnerId: row.recipient_owner_id,
    },
    viewerOwnerId,
    otherContact: { username: otherUsername ?? null },
    pairBlocked,
    participantsAvailable,
  });
}
