import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { createPetProfileIdempotently, mapPetProfileDto, savePetProfile } from '@/lib/server/profileService';
import { problem, validateCreatePetCommand } from '@/packages/contracts';

export const runtime = 'nodejs';

function blockedTelegramStorageResponse() {
  const payload = problem(
    'TELEGRAM_PET_STORAGE_NOT_MIGRATED',
    409,
    'Telegram pet storage is not connected yet',
    'IdentityService issued a pseudonymous Telegram session, but the current Supabase schema still stores pets under Supabase Auth owner_id. Add the Telegram owner bridge migration before persisting Mini App pet profiles.',
    {
      service: 'ProfileService',
      readiness: {
        service: 'ProfileService',
        state: 'blocked',
        persisted: [],
        localOnly: ['client localStorage guest profile'],
        blockedPromises: ['server-side pet persistence for Telegram-only users', 'cross-device restore'],
        privacyState: 'no raw Telegram ID is accepted as owner_id; client-provided psyoUserId is not trusted for writes',
        qaState: 'blocked state is intentional until identity-to-profile storage is migrated',
      },
    },
  );
  return NextResponse.json(payload, { status: payload.status });
}

export async function GET(request: Request) {
  const appSession = getAppSessionFromRequest(request);
  const auth = await getRequestAuth(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;

  if (ownerId && supabase) {
    const [{ data, error }, preference] = await Promise.all([
      supabase.from('pets').select('*').eq('owner_id', ownerId).order('created_at', { ascending: true }),
      supabase.from('profiles').select('active_pet_id').eq('id', ownerId).maybeSingle(),
    ]);
    if (error) {
      const payload = problem('PET_READ_FAILED', 500, 'Pet profiles could not be loaded', error.message);
      return NextResponse.json(payload, { status: payload.status });
    }
    const pets = (data ?? []).map(mapPetProfileDto);
    const activePetId = pets.some((pet) => pet.id === preference.data?.active_pet_id)
      ? preference.data?.active_pet_id
      : pets[0]?.id ?? null;
    return NextResponse.json({
      service: 'ProfileService',
      mode: auth.user ? 'supabase-auth' : 'telegram',
      pets,
      activePetId,
      readiness: {
        service: 'ProfileService',
        state: 'partial',
        persisted: [auth.user ? 'pets owned by Supabase Auth user' : 'pets owned by Telegram app session bridge'],
        localOnly: [],
        blockedPromises: [],
        privacyState: 'pets are filtered by owner_id server-side',
        qaState: 'uses existing Supabase Auth owner boundary',
      },
    });
  }

  return NextResponse.json({
    service: 'ProfileService',
    mode: 'anonymous',
    pets: [],
    storage: demoModeResponse('Open through Telegram Mini App or authenticate before loading server pet profiles.'),
    readiness: {
      service: 'ProfileService',
      state: 'blocked',
      persisted: [],
      localOnly: ['browser guest profile'],
      blockedPromises: ['server-side profile persistence'],
      privacyState: 'анонимный режим не читает приватные профили собак',
      qaState: 'anonymous blocked response is intentional',
    },
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const activePetId = typeof body?.activePetId === 'string' ? body.activePetId : '';
  if (!activePetId) {
    const payload = problem('VALIDATION_FAILED', 400, 'Dog selection is required', 'Provide activePetId.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const appSession = getAppSessionFromRequest(request);
  const auth = await getRequestAuth(request);
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const supabase = auth.supabase ?? getSupabaseAdmin();
  if (!ownerId) {
    const payload = problem('AUTH_REQUIRED', 401, 'Authentication is required', 'Selecting a dog requires a verified owner session.');
    return NextResponse.json(payload, { status: payload.status });
  }
  if (!supabase) {
    const payload = problem('STORAGE_REQUIRED', 503, 'Profile storage is unavailable', 'Connect profile storage before selecting a dog.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const owned = await supabase.from('pets').select('id').eq('id', activePetId).eq('owner_id', ownerId).maybeSingle();
  if (owned.error) return NextResponse.json({ error: owned.error.message }, { status: 500 });
  if (!owned.data) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

  const selected = await supabase.from('profiles').upsert({ id: ownerId, active_pet_id: activePetId }, { onConflict: 'id' });
  if (selected.error) return NextResponse.json({ error: selected.error.message }, { status: 500 });
  return NextResponse.json({ activePetId });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const petId = typeof body?.petId === 'string' ? body.petId : '';
  if (!petId || body?.confirmation !== 'DELETE_DOG') {
    const payload = problem('DELETE_CONFIRMATION_REQUIRED', 400, 'Dog deletion must be confirmed', 'Send petId and confirmation DELETE_DOG.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const appSession = getAppSessionFromRequest(request);
  const auth = await getRequestAuth(request);
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const supabase = auth.supabase ?? getSupabaseAdmin();
  if (!ownerId) {
    const payload = problem('AUTH_REQUIRED', 401, 'Authentication is required', 'Deleting a dog requires a verified owner session.');
    return NextResponse.json(payload, { status: payload.status });
  }
  if (!supabase) return NextResponse.json({ error: 'STORAGE_REQUIRED' }, { status: 503 });

  const deleted = await supabase
    .from('pets')
    .delete()
    .eq('id', petId)
    .eq('owner_id', ownerId)
    .select('id')
    .maybeSingle();
  if (deleted.error) return NextResponse.json({ error: deleted.error.message }, { status: 500 });
  if (!deleted.data) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

  return NextResponse.json({ deletedPetId: petId });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateCreatePetCommand(body);
  if (!parsed.ok) return NextResponse.json(parsed.error, { status: parsed.error.status });

  const appSession = getAppSessionFromRequest(request);
  const auth = await getRequestAuth(request);
  const owner = auth.user ?? (appSession?.ownerId ? { id: appSession.ownerId, email: null, user_metadata: { provider: 'telegram' } } : null);

  if (!owner) {
    const payload = problem('AUTH_REQUIRED', 401, 'Authentication is required', 'Pet writes require a verified app session with a connected storage owner.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const admin = getSupabaseAdmin();
  const supabase = auth.supabase ?? admin;
  if (!supabase) {
    const payload = problem('SUPABASE_AUTH_REQUIRED', 401, 'Supabase auth client is unavailable', 'Send a valid Supabase Bearer token for the existing ProfileService storage path.');
    return NextResponse.json(payload, { status: payload.status });
  }

  try {
    const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
    if (!parsed.command.backendPetId && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      const payload = problem('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency key is required', 'Send an Idempotency-Key header when adding a dog.');
      return NextResponse.json(payload, { status: payload.status });
    }
    if (!parsed.command.backendPetId && !admin) {
      const payload = problem('STORAGE_REQUIRED', 503, 'Profile storage is unavailable', 'Idempotent dog creation requires the server-side profile store.');
      return NextResponse.json(payload, { status: payload.status });
    }
    const result = parsed.command.backendPetId
      ? await savePetProfile({ supabase, user: owner, profile: parsed.command })
      : await createPetProfileIdempotently({ supabase: admin!, user: owner, profile: parsed.command, idempotencyKey });
    const replayed = 'replayed' in result && result.replayed === true;
    return NextResponse.json({
      service: 'ProfileService',
      mode: auth.user ? 'supabase-auth' : 'telegram',
      pet: mapPetProfileDto(result.pet),
      passport: result.passport,
      social: result.social,
      readiness: {
        service: 'ProfileService',
        state: 'partial',
        persisted: ['pets', 'pet_passports', 'social_profiles'],
        localOnly: [],
        blockedPromises: [],
        privacyState: 'write uses authenticated Supabase user; client-provided owner ids are ignored',
        qaState: 'existing ProfileService save path reused by v1 BFF',
      },
    }, { status: parsed.command.backendPetId || replayed ? 200 : 201 });
  } catch (error) {
    const payload = problem('PET_SAVE_FAILED', 500, 'Pet profile could not be saved', error instanceof Error ? error.message : 'Unknown ProfileService failure.');
    return NextResponse.json(payload, { status: payload.status });
  }
}
