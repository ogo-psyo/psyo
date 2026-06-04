import { NextResponse } from 'next/server';
import { ensureProfile, getRequestAuth } from '@/lib/server/auth';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

function slugify(value: string) {
  const base = value.trim().toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '');
  return base || `pet-${crypto.randomUUID().slice(0, 8)}`;
}

function weightToNumber(value: unknown) {
  const n = Number(String(value || '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mapEnum(value: unknown, map: Record<string, string>, fallback: string | null = null) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return map[normalized] ?? normalized;
}

const vaccineStatusMap: Record<string, string> = {
  актуально: 'actual',
  'скоро нужно': 'due_soon',
  просрочено: 'overdue',
  'не знаю': 'unknown',
};

const parasiteStatusMap: Record<string, string> = {
  актуально: 'actual',
  'поставить напоминание': 'needs_reminder',
  просрочено: 'overdue',
  'не знаю': 'unknown',
};

const socialModeMap: Record<string, string> = {
  'можно знакомиться': 'ok',
  'сначала спросить': 'ask_first',
  'только спокойные собаки': 'calm_dogs_only',
  'лучше не подходить': 'do_not_approach',
  'только свои': 'known_only',
};

const friendlinessMap: Record<string, string> = {
  да: 'yes',
  осторожно: 'careful',
  нет: 'no',
  'не знаю': 'unknown',
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const profile = body?.profile ?? body;
  const name = String(profile?.dogName || '').trim();
  if (!name) return NextResponse.json({ error: 'dogName is required' }, { status: 400 });

  const auth = await getRequestAuth(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ pet: { id: crypto.randomUUID(), name }, ...demoModeResponse('Connect Supabase env to persist pet profile.') }, { status: 201 });

  if (!auth.user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  await ensureProfile(auth.user);

  try {
    const petPayload = {
      owner_id: auth.user.id,
      name,
      species: 'dog',
      breed_id: profile?.breedId || 'mixed',
      breed_group_id: profile?.breedGroupId || 'mixed',
      custom_breed: profile?.breedCustom || null,
      sex: profile?.sex || null,
      life_stage: profile?.lifeStage || null,
      weight_kg: weightToNumber(profile?.weight),
      is_public: Boolean(profile?.isPublic),
      ...(profile?.backendPetId ? {} : { public_slug: `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}` }),
    };

    const petQuery = profile?.backendPetId
      ? supabase.from('pets').update(petPayload).eq('id', profile.backendPetId).select('*').single()
      : supabase.from('pets').insert(petPayload).select('*').single();

    const { data: pet, error: petError } = await petQuery;
    if (petError) throw petError;

    const [passportResult, socialResult] = await Promise.all([
      supabase.from('pet_passports').upsert({
        pet_id: pet.id,
        microchip: profile?.microchip || null,
        vet_clinic: profile?.vetClinic || null,
        diet: profile?.diet || null,
        allergies: profile?.allergies || null,
        medication: profile?.medication || null,
        health_notes: profile?.healthNotes || null,
        vaccine_status: mapEnum(profile?.vaccineStatus, vaccineStatusMap, 'unknown'),
        parasite_status: mapEnum(profile?.parasiteStatus, parasiteStatusMap, 'unknown'),
      }).select('*').single(),
      supabase.from('social_profiles').upsert({
        pet_id: pet.id,
        social_mode: mapEnum(profile?.socialMode, socialModeMap, 'ask_first'),
        temperament: profile?.temperament || null,
        energy_level: profile?.energyLevel || null,
        play_style: profile?.playStyle || null,
        trainability: profile?.trainability || null,
        child_friendly: mapEnum(profile?.childFriendly, friendlinessMap),
        dog_friendly: mapEnum(profile?.dogFriendly, friendlinessMap),
        cat_friendly: mapEnum(profile?.catFriendly, friendlinessMap),
        triggers: String(profile?.triggers || '').split(',').map((item) => item.trim()).filter(Boolean),
        alone_time_note: profile?.aloneTime || null,
      }).select('*').single(),
    ]);

    if (passportResult.error) throw passportResult.error;
    if (socialResult.error) throw socialResult.error;
    return NextResponse.json({ mode: 'user', pet, passport: passportResult.data, social: socialResult.data }, { status: profile?.backendPetId ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save pet' }, { status: 500 });
  }
}
