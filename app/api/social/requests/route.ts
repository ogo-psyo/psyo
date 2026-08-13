import { NextResponse } from 'next/server';
import { socialScenarios, validateSocialContactBoundary, type SocialScenario } from '@/lib/socialCore';
import { readIdempotencyKey, socialRequestContext, socialStorageError } from '@/lib/server/socialHttp';
import {
  contactUrlForRequestRow,
  areRequestPetsDiscoverable,
  enforceSocialRateLimit,
  isOwnerPairBlocked,
  excludedOwnerIds,
  requireOwnedPet,
  socialRequestFingerprint,
} from '@/lib/server/socialService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function compactRequest(
  row: any,
  contactUrl: string | null = null,
  viewerPetId: string | null = null,
  petsById: Map<string, { name: string; avatar_url: string | null }> = new Map(),
) {
  const otherPetId = viewerPetId === row.sender_pet_id ? row.recipient_pet_id : row.sender_pet_id;
  const otherPet = petsById.get(otherPetId);
  return {
    id: row.id,
    senderPetId: row.sender_pet_id,
    recipientPetId: row.recipient_pet_id,
    scenario: row.scenario,
    source: row.source,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    contactVisibility: contactUrl ? 'mutual_consent' : 'hidden_until_mutual_consent',
    telegramContactUrl: contactUrl,
    otherDog: otherPet ? { name: otherPet.name, avatarUrl: otherPet.avatar_url } : null,
  };
}

export async function POST(request: Request) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => null);
  const boundary = validateSocialContactBoundary(body);
  if (!boundary.ok) return NextResponse.json({ error: boundary.code, field: boundary.field }, { status: 400 });
  const senderPetId = typeof body?.senderPetId === 'string' ? body.senderPetId : '';
  const recipientPetId = typeof body?.recipientPetId === 'string' ? body.recipientPetId : '';
  const scenario = typeof body?.scenario === 'string' ? body.scenario : '';
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) || null : null;
  const idempotencyKey = readIdempotencyKey(request, body);
  if (!senderPetId || !recipientPetId || !socialScenarios.includes(scenario as SocialScenario) || !idempotencyKey) {
    return NextResponse.json({ error: !idempotencyKey ? 'IDEMPOTENCY_KEY_REQUIRED' : 'INVALID_MATCH_REQUEST' }, { status: 400 });
  }
  const fingerprint = socialRequestFingerprint({
    senderPetId,
    recipientPetId,
    scenario: scenario as SocialScenario,
    source: 'organic',
    message,
  });
  try {
    if (!await requireOwnedPet(context.supabase, context.ownerId, senderPetId)) {
      return NextResponse.json({ error: 'SENDER_PET_NOT_FOUND' }, { status: 404 });
    }
    const { data: replay, error: replayError } = await context.supabase
      .from('social_match_requests')
      .select('*')
      .eq('sender_owner_id', context.ownerId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (replayError) return socialStorageError();
    if (replay) {
      if (replay.request_fingerprint !== fingerprint) {
        return NextResponse.json({ error: 'IDEMPOTENCY_KEY_REUSED' }, { status: 409 });
      }
      return NextResponse.json({ request: compactRequest(replay), replayed: true });
    }
    await enforceSocialRateLimit({
      supabase: context.supabase, table: 'social_match_requests', ownerColumn: 'sender_owner_id',
      ownerId: context.ownerId, limit: 30, windowMs: 60 * 60 * 1000,
    });

    const { data: recipientPet, error: recipientError } = await context.supabase
      .from('pets').select('id, owner_id').eq('id', recipientPetId).maybeSingle();
    if (recipientError) return socialStorageError();
    if (!recipientPet || recipientPet.owner_id === context.ownerId) {
      return NextResponse.json({ error: 'RECIPIENT_NOT_AVAILABLE' }, { status: 404 });
    }
    const [profiles, excluded] = await Promise.all([
      context.supabase.from('social_discovery_profiles')
        .select('pet_id, discoverable, city, scenarios')
        .in('pet_id', [senderPetId, recipientPetId]),
      excludedOwnerIds(context.supabase, context.ownerId),
    ]);
    if (profiles.error) return socialStorageError();
    if (excluded.has(recipientPet.owner_id)) {
      return NextResponse.json({ error: 'RECIPIENT_NOT_AVAILABLE' }, { status: 404 });
    }
    const senderProfile = profiles.data?.find((profile) => profile.pet_id === senderPetId);
    const recipientProfile = profiles.data?.find((profile) => profile.pet_id === recipientPetId);
    if (!senderProfile?.discoverable || !recipientProfile?.discoverable
      || senderProfile.city !== recipientProfile.city
      || !senderProfile.scenarios?.includes(scenario) || !recipientProfile.scenarios?.includes(scenario)) {
      return NextResponse.json({ error: 'RECIPIENT_NOT_AVAILABLE' }, { status: 404 });
    }

    const { data, error } = await context.supabase.from('social_match_requests').insert({
      sender_owner_id: context.ownerId,
      recipient_owner_id: recipientPet.owner_id,
      sender_pet_id: senderPetId,
      recipient_pet_id: recipientPetId,
      scenario,
      source: 'organic',
      message,
      status: 'pending',
      idempotency_key: idempotencyKey,
      request_fingerprint: fingerprint,
      sender_contact_username: context.verifiedTelegramContact.username,
      sender_contact_verified_at: new Date().toISOString(),
    }).select('*').single();
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'REQUEST_ALREADY_PENDING' }, { status: 409 });
    }
    if (error) return socialStorageError();
    return NextResponse.json({ request: compactRequest(data) }, { status: 201 });
  } catch (error) {
    return socialStorageError(error);
  }
}

export async function GET(request: Request) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const petId = new URL(request.url).searchParams.get('petId');
  if (!petId) return NextResponse.json({ error: 'PET_ID_REQUIRED' }, { status: 400 });
  try {
    if (!await requireOwnedPet(context.supabase, context.ownerId, petId)) {
      return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });
    }
    const verifiedAt = new Date().toISOString();
    const [senderRefresh, recipientRefresh] = await Promise.all([
      context.supabase.from('social_match_requests').update({
        sender_contact_username: context.verifiedTelegramContact.username,
        sender_contact_verified_at: verifiedAt,
      }).eq('sender_owner_id', context.ownerId).eq('status', 'accepted'),
      context.supabase.from('social_match_requests').update({
        recipient_contact_username: context.verifiedTelegramContact.username,
        recipient_contact_verified_at: verifiedAt,
      }).eq('recipient_owner_id', context.ownerId).eq('status', 'accepted'),
    ]);
    if (senderRefresh.error || recipientRefresh.error) return socialStorageError();
    const { data, error } = await context.supabase.from('social_match_requests')
      .select('*')
      .or(`sender_pet_id.eq.${petId},recipient_pet_id.eq.${petId}`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return socialStorageError();
    const excluded = await excludedOwnerIds(context.supabase, context.ownerId);
    const otherPetIds = [...new Set((data ?? []).map((row) => row.sender_pet_id === petId ? row.recipient_pet_id : row.sender_pet_id))];
    const { data: otherPets, error: petsError } = otherPetIds.length
      ? await context.supabase.from('pets').select('id, name, avatar_url').in('id', otherPetIds)
      : { data: [], error: null };
    if (petsError) return socialStorageError();
    const petsById = new Map((otherPets ?? []).map((pet) => [pet.id, { name: pet.name, avatar_url: pet.avatar_url }]));
    const requests = [];
    for (const row of data ?? []) {
      const otherOwnerId = row.sender_owner_id === context.ownerId ? row.recipient_owner_id : row.sender_owner_id;
      if (excluded.has(otherOwnerId)) continue;
      const pairBlocked = await isOwnerPairBlocked(context.supabase, context.ownerId, otherOwnerId);
      if (pairBlocked) continue;
      const participantsAvailable = row.source === 'invite'
        ? true
        : await areRequestPetsDiscoverable(context.supabase, row.sender_pet_id, row.recipient_pet_id);
      const contactUrl = contactUrlForRequestRow(row, context.ownerId, pairBlocked, participantsAvailable);
      requests.push(compactRequest(row, contactUrl, petId, petsById));
    }
    return NextResponse.json({
      requests,
      missingTelegramUsernameAction: context.verifiedTelegramContact.username ? null : 'Добавьте имя пользователя в настройках Telegram, чтобы открыть чат',
    });
  } catch (error) {
    return socialStorageError(error);
  }
}
