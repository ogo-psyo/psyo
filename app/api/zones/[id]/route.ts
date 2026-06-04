import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const allowedTypes = new Set(['home_area', 'walk_route', 'safe_place', 'risk_zone', 'clinic', 'shop', 'grooming']);

async function ownedZone(supabase: any, userId: string, id: string) {
  return supabase.from('map_zones').select('id, pets!inner(owner_id)').eq('id', id).eq('pets.owner_id', userId).single();
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const owned = await ownedZone(auth.supabase, auth.user.id, id);
  if (owned.error) return NextResponse.json({ error: 'ZONE_NOT_FOUND' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.note === 'string') patch.note = body.note.trim() || null;
  if (allowedTypes.has(body.type)) patch.type = body.type;
  if (Number.isFinite(Number(body.approximateLat))) patch.approximate_lat = Number(body.approximateLat);
  if (Number.isFinite(Number(body.approximateLng))) patch.approximate_lng = Number(body.approximateLng);
  if (Number.isFinite(Number(body.radiusMeters))) patch.radius_meters = Number(body.radiusMeters);
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'NO_VALID_FIELDS' }, { status: 400 });

  const { data, error } = await auth.supabase.from('map_zones').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data, mode: 'supabase' });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const owned = await ownedZone(auth.supabase, auth.user.id, id);
  if (owned.error) return NextResponse.json({ error: 'ZONE_NOT_FOUND' }, { status: 404 });
  const { error } = await auth.supabase.from('map_zones').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
