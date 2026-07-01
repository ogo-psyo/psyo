import { NextResponse } from 'next/server';
import { blurPublicZoneInput } from '@/lib/geo';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const allowedTypes = new Set(['home_area', 'walk_route', 'safe_place', 'risk_zone', 'clinic', 'shop', 'grooming']);
const allowedVisibility = new Set(['private', 'shared', 'public']);

async function ownedZone(supabase: any, userId: string, id: string) {
  return supabase
    .from('map_zones')
    .select('id, type, visibility, approximate_lat, approximate_lng, radius_meters, pets!inner(owner_id)')
    .eq('id', id)
    .eq('pets.owner_id', userId)
    .single();
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId || !supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const owned = await ownedZone(supabase, ownerId, id);
  if (owned.error) return NextResponse.json({ error: 'ZONE_NOT_FOUND' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.note === 'string') patch.note = body.note.trim() || null;
  const nextType = allowedTypes.has(body.type) ? body.type : owned.data.type;
  const requestedVisibility = allowedVisibility.has(body.visibility) ? body.visibility : owned.data.visibility ?? 'private';
  const nextVisibility = nextType === 'home_area' && requestedVisibility !== 'private' ? 'private' : requestedVisibility;
  if (allowedTypes.has(body.type)) patch.type = nextType;
  if (allowedVisibility.has(body.visibility) || nextVisibility !== owned.data.visibility) patch.visibility = nextVisibility;

  const hasPointPatch = Number.isFinite(Number(body.approximateLat)) || Number.isFinite(Number(body.approximateLng)) || Number.isFinite(Number(body.radiusMeters));
  if (hasPointPatch || patch.visibility === 'public' || patch.visibility === 'shared') {
    const point = blurPublicZoneInput({
      approximateLat: Number.isFinite(Number(body.approximateLat)) ? body.approximateLat : owned.data.approximate_lat,
      approximateLng: Number.isFinite(Number(body.approximateLng)) ? body.approximateLng : owned.data.approximate_lng,
      radiusMeters: Number.isFinite(Number(body.radiusMeters)) ? body.radiusMeters : owned.data.radius_meters,
      visibility: nextVisibility,
    });
    if (point) {
      patch.approximate_lat = point.lat;
      patch.approximate_lng = point.lng;
      patch.radius_meters = point.radiusMeters;
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'NO_VALID_FIELDS' }, { status: 400 });

  const { data, error } = await supabase.from('map_zones').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data, mode: 'supabase' });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId || !supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const owned = await ownedZone(supabase, ownerId, id);
  if (owned.error) return NextResponse.json({ error: 'ZONE_NOT_FOUND' }, { status: 404 });
  const { error } = await supabase.from('map_zones').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
