import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

const allowedTypes = new Set(['home_area', 'walk_route', 'safe_place', 'risk_zone', 'clinic', 'shop', 'grooming']);

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const petId = new URL(request.url).searchParams.get('petId');

  if (!supabase) return NextResponse.json({ zones: [], ...demoModeResponse('Connect Supabase to persist map zones.') });
  if (!auth.user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  let query = supabase.from('map_zones').select('*, pets!inner(owner_id)').eq('pets.owner_id', auth.user.id).order('created_at', { ascending: false });
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
  const supabase = auth.supabase ?? getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ zone: { id: crypto.randomUUID(), ...body }, ...demoModeResponse('Connect Supabase to persist map zones.') }, { status: 201 });
  if (!auth.user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const { data: pet, error: petError } = await supabase.from('pets').select('id').eq('id', body.petId).eq('owner_id', auth.user.id).single();
  if (petError || !pet) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

  const { data, error } = await supabase
    .from('map_zones')
    .insert({
      pet_id: body.petId,
      type: allowedTypes.has(body.type) ? body.type : 'safe_place',
      title: body.title.trim(),
      note: typeof body.note === 'string' ? body.note.trim() || null : null,
      approximate_lat: Number.isFinite(Number(body.approximateLat)) ? Number(body.approximateLat) : null,
      approximate_lng: Number.isFinite(Number(body.approximateLng)) ? Number(body.approximateLng) : null,
      radius_meters: Number.isFinite(Number(body.radiusMeters)) ? Number(body.radiusMeters) : 500,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data, mode: 'supabase' }, { status: 201 });
}
