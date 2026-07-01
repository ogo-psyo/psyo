import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { mapPetProfileDto, savePetProfile } from '@/lib/server/profileService';
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
    const { data, error } = await supabase.from('pets').select('*').eq('owner_id', ownerId).order('created_at', { ascending: true });
    if (error) {
      const payload = problem('PET_READ_FAILED', 500, 'Pet profiles could not be loaded', error.message);
      return NextResponse.json(payload, { status: payload.status });
    }
    return NextResponse.json({
      service: 'ProfileService',
      mode: auth.user ? 'supabase-auth' : 'telegram',
      pets: (data ?? []).map(mapPetProfileDto),
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

  const supabase = auth.supabase ?? getSupabaseAdmin();
  if (!supabase) {
    const payload = problem('SUPABASE_AUTH_REQUIRED', 401, 'Supabase auth client is unavailable', 'Send a valid Supabase Bearer token for the existing ProfileService storage path.');
    return NextResponse.json(payload, { status: payload.status });
  }

  try {
    const result = await savePetProfile({ supabase, user: owner, profile: parsed.command });
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
    }, { status: parsed.command.backendPetId ? 200 : 201 });
  } catch (error) {
    const payload = problem('PET_SAVE_FAILED', 500, 'Pet profile could not be saved', error instanceof Error ? error.message : 'Unknown ProfileService failure.');
    return NextResponse.json(payload, { status: payload.status });
  }
}
