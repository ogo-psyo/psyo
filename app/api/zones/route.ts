import { NextResponse } from 'next/server';
import { blurPublicZoneInput } from '@/lib/geo';
import { getRequestAuth } from '@/lib/server/auth';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { getAppSessionFromRequest } from '@/lib/server/appSession';

export const runtime = 'nodejs';

const allowedTypes = new Set(['home_area', 'walk_route', 'safe_place', 'risk_zone', 'clinic', 'shop', 'grooming']);
const allowedVisibility = new Set(['private', 'shared', 'public']);

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const petId = new URL(request.url).searchParams.get('petId');

  if (!supabase) return NextResponse.json({ zones: [], ...demoModeResponse('Connect Supabase to persist map zones.') });
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  let query = supabase.from('map_zones').select('*, pets!inner(owner_id)').eq('pets.owner_id', ownerId).order('created_at', { ascending: false });
  if (petId) query = query.eq('pet_id', petId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zones: data, mode: 'supabase' });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.petId) return NextResponse.json({ error: 'petId is required' }, { status: 400 });
  if (!body?.title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!supabase) return NextResponse.json({ zone: { id: crypto.randomUUID(), ...body }, ...demoModeResponse('Connect Supabase to persist map zones.') }, { status: 201 });
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const { data: pet, error: petError } = await supabase.from('pets').select('id').eq('id', body.petId).eq('owner_id', ownerId).single();
  if (petError || !pet) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

  const type = allowedTypes.has(body.type) ? body.type : 'safe_place';
  const requestedVisibility = allowedVisibility.has(body.visibility) ? body.visibility : 'private';
  const visibility = type === 'home_area' && requestedVisibility !== 'private' ? 'private' : requestedVisibility;
  const point = blurPublicZoneInput({
    approximateLat: body.approximateLat,
    approximateLng: body.approximateLng,
    radiusMeters: body.radiusMeters,
    visibility,
  });

  const { data, error } = await supabase
    .from('map_zones')
    .insert({
      pet_id: body.petId,
      type,
      title: body.title.trim(),
      note: typeof body.note === 'string' ? body.note.trim() || null : null,
      approximate_lat: point?.lat ?? null,
      approximate_lng: point?.lng ?? null,
      radius_meters: point?.radiusMeters ?? 500,
      visibility,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data, mode: 'supabase' }, { status: 201 });
}
