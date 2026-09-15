import {principalsAgree} from '@/lib/socialCore';
import {RouteSaveError,saveOwnedMapRoute} from '@/lib/server/mapRouteSave';
import { measuredMapOperation } from '@/lib/server/mapMetrics';
import { NextResponse } from 'next/server';
import { blurPublicZoneInput, isValidGeoPoint } from '@/lib/geo';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { linkRecommendationOutcome } from '@/lib/server/recommendations/domainOutcomeLink';

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


function shareUrl(request: Request, id: string) {
  const origin = new URL(request.url).origin;
  return `${origin}/map/share/${id}`;
}

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  if(!principalsAgree({bearerOwnerId:auth.user?.id,sessionOwnerId:appSession?.ownerId}))return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const bounds = parseBounds(new URL(request.url).searchParams.get('bounds'));
  if (!bounds) return NextResponse.json({ error: 'bounds must be minLat,minLng,maxLat,maxLng' }, { status: 400 });

  const supabase = auth.supabase ?? getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ features: [], ...demoModeResponse('Connect Supabase to load map features.') });

  const { data, error } = await supabase.rpc('get_map_features_in_bounds', {
    min_lat: bounds.minLat,
    max_lat: bounds.maxLat,
    min_lng: bounds.minLng,
    max_lng: bounds.maxLng,
    requesting_owner_id: ownerId ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ features: data ?? [], mode: 'supabase' });
}

export async function POST(request:Request){return measuredMapOperation('route_save',request,()=>measuredMutation(request));}
async function measuredMutation(request:Request){
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  if(!principalsAgree({bearerOwnerId:auth.user?.id,sessionOwnerId:appSession?.ownerId}))return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});
  const supabase = getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const body = await request.json().catch(() => null);

  if (!supabase) return NextResponse.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!body?.type || typeof body?.title!=='string' || !body.title.trim()) return NextResponse.json({ error: 'type and title are required' }, { status: 400 });

  const requestedVisibility = safeVisibility(body.visibility);

  if (body.type === 'point') {
    if (!body.petId) return NextResponse.json({ error: 'petId is required for point features' }, { status: 400 });
    const zoneType = zoneTypes.has(body.zone_type) ? body.zone_type : 'safe_place';
    const visibility = zoneType === 'home_area' ? 'private' : requestedVisibility;
    const moderationStatus = visibility === 'public' ? 'pending' : 'approved';
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
      share_token: visibility === 'shared' ? crypto.randomUUID() : null,
    }).select('*').single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ feature: data, shareUrl: visibility === 'shared' ? shareUrl(request, data.share_token) : null }, { status: 201 });
  }

  if (body.type === 'route') {
    let saved;
    try { saved=await saveOwnedMapRoute(supabase,ownerId,body,request.headers.get('idempotency-key')); }
    catch(error){return NextResponse.json({error:error instanceof RouteSaveError?error.code:'ROUTE_SAVE_FAILED'},{status:error instanceof RouteSaveError?error.status:503});}
    const data=saved.feature;
    const recommendationId = typeof body.recommendationId === 'string' ? body.recommendationId.trim() : '';
    const recommendationOutcome = recommendationId && process.env.RECOMMENDATIONS_FOUNDATION_ENABLED === 'true'
      ? await linkRecommendationOutcome({
        supabase, ownerId: ownerId!, recommendationId, domainType: 'route', domainId: data.id, result: 'completed',
        idempotencyKey: request.headers.get('idempotency-key')?.trim() || `route:${data.id}`,
        occurredAt: data.created_at,
      })
      : undefined;
    return NextResponse.json({
      ...saved,
      shareUrl: data.visibility === 'shared' ? shareUrl(request, data.share_token) : null,
      ...(recommendationOutcome ? { recommendationOutcome } : {}),
    }, { status: 201 });
  }

  return NextResponse.json({ error: 'type must be point or route' }, { status: 400 });
}
