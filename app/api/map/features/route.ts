import { NextResponse } from 'next/server';
import { blurPublicZoneInput, isValidGeoPoint } from '@/lib/geo';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const zoneTypes = new Set(['home_area', 'walk_route', 'safe_place', 'risk_zone', 'clinic', 'shop', 'grooming']);
const visibilityModes = new Set(['private', 'shared', 'public']);

function parseBounds(value: string | null) {
  const parts = value?.split(',').map(Number) ?? [];
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [minLat, minLng, maxLat, maxLng] = parts;
  return { minLat, minLng, maxLat, maxLng };
}

function safeVisibility(value: unknown) {
  return visibilityModes.has(value as string) ? value as 'private' | 'shared' | 'public' : 'private';
}

function ewktLineString(path: unknown) {
  if (!Array.isArray(path) || path.length < 2) return null;
  const points = path.map((point) => {
    if (!Array.isArray(point) || point.length < 2) return null;
    const lng = Number(point[0]);
    const lat = Number(point[1]);
    if (!isValidGeoPoint({ lat, lng })) return null;
    return `${lng} ${lat}`;
  });
  if (points.some((point) => !point)) return null;
  return `SRID=4326;LINESTRING(${points.join(', ')})`;
}

function shareUrl(request: Request, id: string) {
  const origin = new URL(request.url).origin;
  return `${origin}/map/share/${id}`;
}

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const bounds = parseBounds(new URL(request.url).searchParams.get('bounds'));
  if (!bounds) return NextResponse.json({ error: 'bounds must be minLat,minLng,maxLat,maxLng' }, { status: 400 });

  const supabase = auth.supabase ?? getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ features: [], ...demoModeResponse('Connect Supabase to load map features.') });

  const { data, error } = await supabase.rpc('get_map_features_in_bounds', {
    min_lat: bounds.minLat,
    max_lat: bounds.maxLat,
    min_lng: bounds.minLng,
    max_lng: bounds.maxLng,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ features: data ?? [], mode: 'supabase' });
}

export async function POST(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const body = await request.json().catch(() => null);

  if (!supabase) return NextResponse.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!body?.type || !body?.title?.trim()) return NextResponse.json({ error: 'type and title are required' }, { status: 400 });

  const visibility = safeVisibility(body.visibility);
  const moderationStatus = visibility === 'public' ? 'pending' : 'approved';

  if (body.type === 'point') {
    if (!body.petId) return NextResponse.json({ error: 'petId is required for point features' }, { status: 400 });
    const zoneType = zoneTypes.has(body.zone_type) ? body.zone_type : 'safe_place';
    const { data: pet } = await supabase.from('pets').select('id').eq('id', body.petId).eq('owner_id', ownerId).maybeSingle();
    if (!pet) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

    const point = blurPublicZoneInput({
      approximateLat: body.lat,
      approximateLng: body.lng,
      radiusMeters: body.radiusMeters,
      visibility,
    });
    if (!point) return NextResponse.json({ error: 'valid lat/lng are required' }, { status: 400 });

    const { data, error } = await supabase.from('map_zones').insert({
      pet_id: body.petId,
      title: body.title.trim(),
      type: zoneType,
      note: typeof body.description === 'string' ? body.description.trim() || null : null,
      approximate_lat: point.lat,
      approximate_lng: point.lng,
      radius_meters: point.radiusMeters,
      visibility,
      moderation_status: moderationStatus,
      geom: `SRID=4326;POINT(${point.lng} ${point.lat})`,
    }).select('*').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ feature: data, shareUrl: visibility === 'shared' ? shareUrl(request, data.id) : null }, { status: 201 });
  }

  if (body.type === 'route') {
    const lineString = ewktLineString(body.path);
    if (!lineString) return NextResponse.json({ error: 'path must contain at least two [lng,lat] points' }, { status: 400 });
    if (body.petId) {
      const { data: pet } = await supabase.from('pets').select('id').eq('id', body.petId).eq('owner_id', ownerId).maybeSingle();
      if (!pet) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });
    }

    const { data, error } = await supabase.from('map_routes').insert({
      owner_id: ownerId,
      pet_id: body.petId || null,
      title: body.title.trim(),
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      visibility,
      moderation_status: moderationStatus,
      color: typeof body.color === 'string' ? body.color : '#3b82f6',
      path: lineString,
    }).select('*').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ feature: data, shareUrl: visibility === 'shared' ? shareUrl(request, data.id) : null }, { status: 201 });
  }

  return NextResponse.json({ error: 'type must be point or route' }, { status: 400 });
}
