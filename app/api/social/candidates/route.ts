import { NextResponse } from 'next/server';
import { blurGeoPoint, distanceMeters, isValidGeoPoint, type GeoPoint } from '@/lib/geo';
import { calculateCompatibility } from '@/lib/matching';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SOCIAL_DISCOVERY_MODES = new Set(['ok', 'ask_first', 'calm_dogs_only']);
const PUBLIC_ZONE_VISIBILITY = new Set(['public', 'shared']);

function firstRow(value: any) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePet(row: any) {
  const social = firstRow(row?.social_profiles) ?? {};
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    species: row.species ?? 'dog',
    breedId: row.breed_id,
    breedGroupId: row.breed_group_id,
    customBreed: row.custom_breed,
    weightKg: Number(row.weight_kg) || undefined,
    avatarUrl: row.avatar_url,
    photoUrls: row.photo_urls ?? [],
    publicSlug: row.public_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    social: {
      petId: social.pet_id ?? row.id,
      socialMode: social.social_mode,
      temperament: social.temperament,
      energyLevel: social.energy_level,
      playStyle: social.play_style,
      trainability: social.trainability,
      childFriendly: social.child_friendly,
      dogFriendly: social.dog_friendly,
      catFriendly: social.cat_friendly,
      triggers: Array.isArray(social.triggers) ? social.triggers : [],
      aloneTimeNote: social.alone_time_note,
    },
  };
}

function zonePoint(zone: any): GeoPoint | null {
  const lat = Number(zone?.approximate_lat);
  const lng = Number(zone?.approximate_lng);
  return isValidGeoPoint({ lat, lng }) ? { lat, lng } : null;
}

function chooseMyPoint(zones: any[]) {
  return zones.map(zonePoint).find(Boolean) ?? null;
}

function choosePublicCandidatePoint(zones: any[]) {
  const publicZone = zones.find((zone) => PUBLIC_ZONE_VISIBILITY.has(zone.visibility));
  const point = zonePoint(publicZone);
  if (!point) return null;
  return blurGeoPoint(point, Number(publicZone.radius_meters) || 500);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const myPetId = url.searchParams.get('petId');

  if (!myPetId) {
    return NextResponse.json({ error: 'petId is required' }, { status: 400 });
  }

  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;

  if (!supabase) {
    return NextResponse.json({ matches: [], ...demoModeResponse('Connect Supabase to calculate social candidates.') });
  }

  if (!ownerId) {
    return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { data: myPetRow, error: myPetError } = await supabase
    .from('pets')
    .select('*, social_profiles(*)')
    .eq('id', myPetId)
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (myPetError) {
    return NextResponse.json({ error: 'PET_LOOKUP_FAILED' }, { status: 500 });
  }

  if (!myPetRow) {
    return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
  }

  const { data: myZones } = await supabase
    .from('map_zones')
    .select('approximate_lat, approximate_lng, radius_meters, type, visibility')
    .eq('pet_id', myPetId)
    .order('created_at', { ascending: false })
    .limit(5);

  const myPoint = chooseMyPoint(myZones ?? []);
  if (!myPoint) {
    return NextResponse.json({
      matches: [],
      mode: 'supabase',
      reason: 'NO_PRIVATE_REFERENCE_AREA',
      privacy: 'Точная геолокация не раскрывается. Добавьте приватную примерную зону прогулки для расчёта расстояний.',
    });
  }

  const { data: candidateRows, error: candidatesError } = await supabase
    .from('pets')
    .select('*, social_profiles(*)')
    .neq('id', myPetId)
    .neq('owner_id', ownerId)
    .limit(100);

  if (candidatesError) {
    return NextResponse.json({ error: 'CANDIDATES_LOOKUP_FAILED' }, { status: 500 });
  }

  const candidates = (candidateRows ?? [])
    .map(normalizePet)
    .filter((candidate) => SOCIAL_DISCOVERY_MODES.has(candidate.social.socialMode ?? ''))
    .filter((candidate) => candidate.social.dogFriendly !== 'no');

  if (!candidates.length) {
    return NextResponse.json({ matches: [], mode: 'supabase', contactVisibility: 'hidden_until_mutual_consent' });
  }

  const { data: candidateZones } = await supabase
    .from('map_zones')
    .select('pet_id, approximate_lat, approximate_lng, radius_meters, type, visibility')
    .in('pet_id', candidates.map((candidate) => candidate.id));

  const zonesByPet = new Map<string, any[]>();
  for (const zone of candidateZones ?? []) {
    zonesByPet.set(zone.pet_id, [...(zonesByPet.get(zone.pet_id) ?? []), zone]);
  }

  const myDog = normalizePet(myPetRow);
  const matches = candidates
    .map((candidate) => {
      const candidatePoint = choosePublicCandidatePoint(zonesByPet.get(candidate.id) ?? []);
      if (!candidatePoint) return null;
      const distance = distanceMeters(myPoint, candidatePoint);
      if (distance > 10000) return null;

      const result = calculateCompatibility(myDog, candidate, distance);
      if (!result) return null;

      return {
        petId: candidate.id,
        name: candidate.name,
        avatar: candidate.avatarUrl,
        score: result.score,
        reasons: result.reasons,
        safetyWarnings: result.safetyWarnings,
        distance: result.blurredDistance,
        contactVisibility: 'hidden_until_mutual_consent',
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 10);

  return NextResponse.json({
    matches,
    mode: 'supabase',
    privacy: 'Точные координаты и контакты не возвращаются. Расстояние показывается только бакетом, контакты доступны только после mutual consent.',
  });
}
