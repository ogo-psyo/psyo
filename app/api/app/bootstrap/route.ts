import { NextResponse } from 'next/server';
import type { AppBootstrap } from '@/lib/domain';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { ensureProfile, getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';

export const runtime = 'nodejs';

function demoBootstrap(): AppBootstrap {
  const now = new Date().toISOString();
  return {
    user: { id: 'demo-user', displayName: 'Владелец', createdAt: now },
    pets: [
      { id: 'demo-pet', ownerId: 'demo-user', name: 'Мята', species: 'dog', breedId: 'mixed', breedGroupId: 'mixed', photoUrls: [], publicSlug: 'myata', createdAt: now, updatedAt: now },
      { id: 'demo-pet-2', ownerId: 'demo-user', name: 'Груша', species: 'dog', breedId: 'corgi', breedGroupId: 'herding', photoUrls: [], publicSlug: 'grusha', createdAt: now, updatedAt: now },
    ],
    pet: { id: 'demo-pet', ownerId: 'demo-user', name: 'Мята', species: 'dog', breedId: 'mixed', breedGroupId: 'mixed', photoUrls: [], publicSlug: 'myata', createdAt: now, updatedAt: now },
    passport: { petId: 'demo-pet', vaccineStatus: 'unknown', parasiteStatus: 'unknown' },
    social: { petId: 'demo-pet', socialMode: 'ask_first', triggers: [] },
    reminders: [{ id: 'reminder-1', petId: 'demo-pet', type: 'parasite', title: 'Поставить дату обработки', dueAt: now, recurrence: 'monthly', status: 'active' }],
    zones: [{ id: 'zone-1', petId: 'demo-pet', type: 'home_area', title: 'Домашняя зона', radiusMeters: 500 }],
    wishlist: [{ id: 'wish-1', petId: 'demo-pet', title: 'Адресник с QR', category: 'gear', reason: 'Безопасность на прогулке', priority: 'medium', status: 'wanted' }],
    observations: [{ id: 'observation-1', petId: 'demo-pet', type: 'mood', value: 'спокойная', note: 'демо-наблюдение', observedAt: now, mood: 'спокойная', appetite: 'обычный', stool: 'обычный', energy: 'обычная', source: 'demo', metadata: { mood: 'спокойная', appetite: 'обычный', stool: 'обычный', energy: 'обычная' }, createdAt: now, updatedAt: now }],
  };
}

function mapReminder(row: any) {
  return { id: row.id, petId: row.pet_id, type: row.type, title: row.title, dueAt: row.due_at, recurrence: row.recurrence, status: row.status, completedAt: row.completed_at, snoozedUntil: row.snoozed_until };
}

function mapObservation(row: any) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return { id: row.id, petId: row.pet_id, type: row.type, value: row.value, note: row.note ?? undefined, observedAt: row.observed_at, mood: typeof metadata.mood === 'string' ? metadata.mood : row.type === 'mood' ? row.value : undefined, appetite: typeof metadata.appetite === 'string' ? metadata.appetite : row.type === 'appetite' ? row.value : undefined, stool: typeof metadata.stool === 'string' ? metadata.stool : row.type === 'stool' ? row.value : undefined, energy: typeof metadata.energy === 'string' ? metadata.energy : row.type === 'energy' ? row.value : undefined, source: row.source, metadata, createdAt: row.created_at, updatedAt: row.updated_at };
}

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();

  if (!supabase) return NextResponse.json({ ...demoBootstrap(), ...demoModeResponse('Configure Supabase env to load real app state.') });
  if (auth.user) await ensureProfile(auth.user);

  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId) {
    return NextResponse.json({
      mode: 'supabase',
      connected: true,
      empty: true,
      user: null,
      message: 'Sign in to load private app state.',
    });
  }

  const url = new URL(request.url);
  const requestedPetId = url.searchParams.get('petId');

  const petsResult = await supabase.from('pets').select('*').eq('owner_id', ownerId).order('created_at', { ascending: true });
  if (petsResult.error) return NextResponse.json({ mode: 'user', connected: true, error: petsResult.error.message }, { status: 500 });
  const pets = petsResult.data ?? [];
  const selectedPet = requestedPetId ? pets.find((pet) => pet.id === requestedPetId) : pets[0];
  if (requestedPetId && !selectedPet) {
    return NextResponse.json({ mode: auth.user ? 'user' : 'telegram', connected: true, error: 'PET_NOT_FOUND_OR_NOT_OWNED' }, { status: 404 });
  }

  if (!selectedPet) return NextResponse.json({ mode: auth.user ? 'user' : 'telegram', connected: true, empty: true, pets: [], user: { id: ownerId, email: auth.user?.email ?? null }, message: 'No pets yet.' });

  const petId = selectedPet.id;
  const [passportResult, socialResult, remindersResult, zonesResult, wishlistResult, observationsResult] = await Promise.all([
    supabase.from('pet_passports').select('*').eq('pet_id', petId).maybeSingle(),
    supabase.from('social_profiles').select('*').eq('pet_id', petId).maybeSingle(),
    supabase.from('reminders').select('*').eq('pet_id', petId).order('due_at', { ascending: true }),
    supabase.from('map_zones').select('*').eq('pet_id', petId).order('created_at', { ascending: false }),
    supabase.from('wishlist_items').select('*').eq('pet_id', petId).order('created_at', { ascending: false }),
    supabase.from('pet_observations').select('*').eq('pet_id', petId).order('observed_at', { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    mode: auth.user ? 'user' : 'telegram',
    connected: true,
    user: { id: ownerId, email: auth.user?.email ?? null },
    pets,
    activePetId: petId,
    pet: selectedPet,
    passport: passportResult.data,
    social: socialResult.data,
    reminders: (remindersResult.data ?? []).map(mapReminder),
    zones: zonesResult.data ?? [],
    wishlist: wishlistResult.data ?? [],
    observations: observationsResult.error ? [] : (observationsResult.data ?? []).map(mapObservation),
  });
}
