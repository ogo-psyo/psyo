import { NextResponse } from 'next/server';
import { latestActiveRequestsByPetPair, socialScenarios, validateSocialContactBoundary, type SocialScenario } from '@/lib/socialCore';
import { readIdempotencyKey, socialRequestContext, socialStorageError } from '@/lib/server/socialHttp';
import {
  contactUrlForRequestRow,
  enforceSocialRateLimit,
  excludedOwnerIds,
  requireOwnedPet,
  socialRequestFingerprint,
  socialAvatarUrl,
} from '@/lib/server/socialService';
import { linkRecommendationOutcome } from '@/lib/server/recommendations/domainOutcomeLink';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function linkSignalRecommendation(input: {
  supabase: Parameters<typeof linkRecommendationOutcome>[0]['supabase']; ownerId: string;
  recommendationId: string; requestId: string; idempotencyKey: string; occurredAt?: string;
}) {
  if (!input.recommendationId || process.env.RECOMMENDATIONS_FOUNDATION_ENABLED !== 'true') return undefined;
  return linkRecommendationOutcome({
    supabase: input.supabase, ownerId: input.ownerId, recommendationId: input.recommendationId,
    domainType: 'social_request', domainId: input.requestId, result: 'completed',
    idempotencyKey: input.idempotencyKey, occurredAt: input.occurredAt,
  });
}

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
  const signalId = typeof body?.signalId === 'string' ? body.signalId : null;
  const source = signalId ? 'signal' : 'organic';
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) || null : null;
  const idempotencyKey = readIdempotencyKey(request, body);
  const recommendationId = typeof body?.recommendationId === 'string' ? body.recommendationId.trim() : '';
  if (!senderPetId || !recipientPetId || !socialScenarios.includes(scenario as SocialScenario) || !idempotencyKey) {
    return NextResponse.json({ error: !idempotencyKey ? 'IDEMPOTENCY_KEY_REQUIRED' : 'INVALID_MATCH_REQUEST' }, { status: 400 });
  }
  const fingerprint = socialRequestFingerprint({
    senderPetId,
    recipientPetId,
    scenario: scenario as SocialScenario,
    source,
    signalId,
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
      const recommendationOutcome = signalId ? await linkSignalRecommendation({
        supabase: context.supabase, ownerId: context.ownerId, recommendationId,
        requestId: replay.id, idempotencyKey, occurredAt: replay.created_at,
      }) : undefined;
      return NextResponse.json({ request: compactRequest(replay), replayed: true, ...(recommendationOutcome ? { recommendationOutcome } : {}) });
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
    const { data: activePair, error: activePairError } = await context.supabase
      .from('social_match_requests')
      .select('*')
      .in('status', ['pending', 'accepted'])
      .or(`and(sender_pet_id.eq.${senderPetId},recipient_pet_id.eq.${recipientPetId}),and(sender_pet_id.eq.${recipientPetId},recipient_pet_id.eq.${senderPetId})`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activePairError) return socialStorageError();
    if (activePair) return NextResponse.json({ request: compactRequest(activePair), replayed: true });
    const [profiles, excluded, signalLookup] = await Promise.all([
      context.supabase.from('social_discovery_profiles')
        .select('pet_id, discoverable, city, scenarios')
        .in('pet_id', [senderPetId, recipientPetId]),
      excludedOwnerIds(context.supabase, context.ownerId),
      signalId
        ? context.supabase.from('social_walk_signals').select('id, pet_id, owner_id, status, expires_at')
          .eq('id', signalId).eq('pet_id', recipientPetId).eq('status', 'active').gt('expires_at', new Date().toISOString()).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (profiles.error || signalLookup.error) return socialStorageError();
    if (excluded.has(recipientPet.owner_id)) {
      return NextResponse.json({ error: 'RECIPIENT_NOT_AVAILABLE' }, { status: 404 });
    }
    const senderProfile = profiles.data?.find((profile) => profile.pet_id === senderPetId);
    const recipientProfile = profiles.data?.find((profile) => profile.pet_id === recipientPetId);
    const organicAvailable = senderProfile?.discoverable && recipientProfile?.discoverable
      && senderProfile.city === recipientProfile.city
      && senderProfile.scenarios?.includes(scenario) && recipientProfile.scenarios?.includes(scenario);
    const signalAvailable = signalId && signalLookup.data?.owner_id === recipientPet.owner_id && scenario === 'walk';
    if (signalId ? !signalAvailable : !organicAvailable) {
      return NextResponse.json({ error: 'RECIPIENT_NOT_AVAILABLE' }, { status: 404 });
    }

    const { data, error } = await context.supabase.from('social_match_requests').insert({
      sender_owner_id: context.ownerId,
      recipient_owner_id: recipientPet.owner_id,
      sender_pet_id: senderPetId,
      recipient_pet_id: recipientPetId,
      scenario,
      source,
      signal_id: signalId,
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
    const recommendationOutcome = signalId ? await linkSignalRecommendation({
      supabase: context.supabase, ownerId: context.ownerId, recommendationId,
      requestId: data.id, idempotencyKey, occurredAt: data.created_at,
    }) : undefined;
    return NextResponse.json({ request: compactRequest(data), ...(recommendationOutcome ? { recommendationOutcome } : {}) }, { status: 201 });
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
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return socialStorageError();
    const excluded = await excludedOwnerIds(context.supabase, context.ownerId);
    const otherPetIds = [...new Set((data ?? []).map((row) => row.sender_pet_id === petId ? row.recipient_pet_id : row.sender_pet_id))];
    const requestPetIds = [...new Set((data ?? []).flatMap((row) => [row.sender_pet_id, row.recipient_pet_id]))];
    const [petsLookup, discoveryLookup] = await Promise.all([
      otherPetIds.length ? context.supabase.from('pets').select('id, name, avatar_url, avatar_source, active_avatar_asset_id').in('id', otherPetIds) : Promise.resolve({ data: [], error: null }),
      requestPetIds.length ? context.supabase.from('social_discovery_profiles').select('pet_id, discoverable').in('pet_id', requestPetIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (petsLookup.error || discoveryLookup.error) return socialStorageError();
    const otherPets = petsLookup.data;
    const petsById = new Map((otherPets ?? []).map((pet) => [pet.id, { name: pet.name, avatar_url: socialAvatarUrl(pet) }]));
    const discoverablePets = new Set((discoveryLookup.data ?? []).filter((item) => item.discoverable).map((item) => item.pet_id));
    const requests = [];
    for (const row of latestActiveRequestsByPetPair(data ?? [])) {
      const otherOwnerId = row.sender_owner_id === context.ownerId ? row.recipient_owner_id : row.sender_owner_id;
      if (excluded.has(otherOwnerId)) continue;
      const pairBlocked = false;
      const participantsAvailable = row.source === 'invite' || row.source === 'signal'
        ? true
        : discoverablePets.has(row.sender_pet_id) && discoverablePets.has(row.recipient_pet_id);
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
