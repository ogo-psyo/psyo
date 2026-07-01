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
    pet: { id: 'demo-pet', ownerId: 'demo-user', name: 'Мята', species: 'dog', breedId: 'mixed', breedGroupId: 'mixed', photoUrls: [], publicSlug: 'myata', createdAt: now, updatedAt: now },
    passport: { petId: 'demo-pet', vaccineStatus: 'unknown', parasiteStatus: 'unknown' },
    social: { petId: 'demo-pet', socialMode: 'ask_first', triggers: [] },
    reminders: [{ id: 'reminder-1', petId: 'demo-pet', type: 'parasite', title: 'Поставить дату обработки', dueAt: now, recurrence: 'monthly', status: 'active' }],
    zones: [{ id: 'zone-1', petId: 'demo-pet', type: 'home_area', title: 'Домашняя зона', radiusMeters: 500 }],
    wishlist: [{ id: 'wish-1', petId: 'demo-pet', title: 'Адресник с QR', category: 'gear', reason: 'Безопасность на прогулке', priority: 'medium', status: 'wanted' }],
  };
}

function mapReminder(row: any) {
  return { id: row.id, petId: row.pet_id, type: row.type, title: row.title, dueAt: row.due_at, recurrence: row.recurrence, status: row.status, completedAt: row.completed_at, snoozedUntil: row.snoozed_until };
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

  let petQuery = supabase.from('pets').select('*').order('created_at', { ascending: true }).limit(1).eq('owner_id', ownerId);
  if (requestedPetId) petQuery = petQuery.eq('id', requestedPetId);
  const petResult = await petQuery.maybeSingle();

  if (petResult.error) return NextResponse.json({ mode: 'user', connected: true, error: petResult.error.message }, { status: 500 });
  if (!petResult.data) return NextResponse.json({ mode: auth.user ? 'user' : 'telegram', connected: true, empty: true, user: { id: ownerId, email: auth.user?.email ?? null }, message: 'No pets yet.' });

  const petId = petResult.data.id;
  const [passportResult, socialResult, remindersResult, zonesResult, wishlistResult] = await Promise.all([
    supabase.from('pet_passports').select('*').eq('pet_id', petId).maybeSingle(),
    supabase.from('social_profiles').select('*').eq('pet_id', petId).maybeSingle(),
    supabase.from('reminders').select('*').eq('pet_id', petId).order('due_at', { ascending: true }),
    supabase.from('map_zones').select('*').eq('pet_id', petId).order('created_at', { ascending: false }),
    supabase.from('wishlist_items').select('*').eq('pet_id', petId).order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({
    mode: auth.user ? 'user' : 'telegram',
    connected: true,
    user: { id: ownerId, email: auth.user?.email ?? null },
    pet: petResult.data,
    passport: passportResult.data,
    social: socialResult.data,
    reminders: (remindersResult.data ?? []).map(mapReminder),
    zones: zonesResult.data ?? [],
    wishlist: wishlistResult.data ?? [],
  });
}
