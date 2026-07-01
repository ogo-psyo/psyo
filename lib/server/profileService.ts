import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { CreatePetCommand } from '@/packages/contracts';
import { ensureProfile } from './auth';

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

type ProfileOwner = { id: string; email?: string | null; user_metadata?: Record<string, unknown> };

export async function savePetProfile(input: { supabase: SupabaseClient; user: ProfileOwner; profile: CreatePetCommand }) {
  const { supabase, user, profile } = input;
  await ensureProfile(user);
  const publicAvatarUrl = typeof profile.avatarImageUrl === 'string' && /^https?:\/\//i.test(profile.avatarImageUrl)
    ? profile.avatarImageUrl
    : null;
  const publicPhotoUrls = Array.isArray(profile.photoUrls)
    ? profile.photoUrls.filter((url): url is string => typeof url === 'string' && /^https?:\/\//i.test(url)).slice(0, 5)
    : publicAvatarUrl ? [publicAvatarUrl] : [];

  const petPayload = {
    owner_id: user.id,
    name: profile.dogName,
    species: 'dog',
    breed_id: profile.breedId || 'mixed',
    breed_group_id: profile.breedGroupId || 'mixed',
    custom_breed: profile.breedCustom || null,
    sex: profile.sex || null,
    life_stage: profile.lifeStage || null,
    weight_kg: weightToNumber(profile.weight),
    is_public: Boolean(profile.isPublic),
    ...(publicAvatarUrl ? { avatar_url: publicAvatarUrl } : {}),
    ...(publicPhotoUrls.length ? { photo_urls: publicPhotoUrls } : {}),
    ...(profile.backendPetId ? {} : { public_slug: `${slugify(profile.dogName)}-${crypto.randomUUID().slice(0, 6)}` }),
  };

  const petQuery = profile.backendPetId
    ? supabase.from('pets').update(petPayload).eq('id', profile.backendPetId).eq('owner_id', user.id).select('*').single()
    : supabase.from('pets').insert(petPayload).select('*').single();

  const { data: pet, error: petError } = await petQuery;
  if (petError) throw petError;

  const [passportResult, socialResult] = await Promise.all([
    supabase.from('pet_passports').upsert({
      pet_id: pet.id,
      microchip: profile.microchip || null,
      vet_clinic: profile.vetClinic || null,
      diet: profile.diet || null,
      allergies: profile.allergies || null,
      medication: profile.medication || null,
      health_notes: profile.healthNotes || null,
      vaccine_status: mapEnum(profile.vaccineStatus, vaccineStatusMap, 'unknown'),
      parasite_status: mapEnum(profile.parasiteStatus, parasiteStatusMap, 'unknown'),
    }).select('*').single(),
    supabase.from('social_profiles').upsert({
      pet_id: pet.id,
      social_mode: mapEnum(profile.socialMode, socialModeMap, 'ask_first'),
      temperament: profile.temperament || null,
      energy_level: profile.energyLevel || null,
      play_style: profile.playStyle || null,
      trainability: profile.trainability || null,
      child_friendly: mapEnum(profile.childFriendly, friendlinessMap),
      dog_friendly: mapEnum(profile.dogFriendly, friendlinessMap),
      cat_friendly: mapEnum(profile.catFriendly, friendlinessMap),
      triggers: String(profile.triggers || '').split(',').map((item) => item.trim()).filter(Boolean),
      alone_time_note: profile.aloneTime || null,
    }).select('*').single(),
  ]);

  if (passportResult.error) throw passportResult.error;
  if (socialResult.error) throw socialResult.error;
  return { pet, passport: passportResult.data, social: socialResult.data };
}

export function mapPetProfileDto(row: any) {
  return {
    id: row.id,
    name: row.name,
    species: 'dog' as const,
    breedId: row.breed_id,
    breedGroupId: row.breed_group_id,
    publicSlug: row.public_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
