import { NextResponse } from 'next/server';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const petId = new URL(request.url).searchParams.get('petId');

  if (!supabase) {
    return NextResponse.json({ wishlist: [], ...demoModeResponse('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.') });
  }

  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  let query = supabase.from('wishlist_items').select('*, pets!inner(owner_id)').eq('pets.owner_id', ownerId).order('created_at', { ascending: false });
  if (petId) query = query.eq('pet_id', petId);
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ wishlist: data, mode: 'supabase' });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!supabase) {
    return NextResponse.json({ item: { id: crypto.randomUUID(), priority: 'medium', status: 'wanted', ...body }, ...demoModeResponse('Connect Supabase to persist wishlist items.') }, { status: 201 });
  }

  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!body.petId) return NextResponse.json({ error: 'petId is required when Supabase is enabled' }, { status: 400 });

  const { data: pet, error: petError } = await supabase.from('pets').select('id').eq('id', body.petId).eq('owner_id', ownerId).single();
  if (petError || !pet) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

  const { data, error } = await supabase
    .from('wishlist_items')
    .insert({
      pet_id: body.petId,
      title: body.title,
      category: body.category || 'other',
      reason: body.reason || null,
      url: body.url || null,
      priority: body.priority || 'medium',
      status: body.status || 'wanted',
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data, mode: 'supabase' }, { status: 201 });
}
