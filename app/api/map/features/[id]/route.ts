import {readOwnedMapRoute} from '@/lib/server/ownedMapRoute';
import {principalsAgree} from '@/lib/socialCore';
import {z} from 'zod';
import {parseRoutePlanning} from '@/lib/routePlanning';
import { routeEwkt,validRouteGaps,storedRoutePoints,measuredRouteDistance } from '@/lib/routeGeometry';
import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const visibilityModes = new Set(['private', 'shared', 'public']);

async function requestContext(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  return {
    ownerId: auth.user?.id ?? appSession?.ownerId,
    supabase: auth.supabase ?? getSupabaseAdmin(),
  };
}

async function ownedRoute(supabase: any, ownerId: string, id: string) {
  return supabase
    .from('map_routes')
    .select('id, owner_id, visibility, share_token')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle();
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { ownerId, supabase } = await requestContext(request);
  if (!ownerId || !supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const owned = await ownedRoute(supabase, ownerId, id);
  if (owned.error || !owned.data) return NextResponse.json({ error: 'ROUTE_NOT_FOUND' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {
    // Updating an existing route always closes the old share URL.
    visibility: 'private',
    share_token: null,
  };
  if ('path' in body) {
    const path=routeEwkt(body.path);
    if(!path)return NextResponse.json({error:'INVALID_ROUTE_GEOMETRY'},{status:400});
    const planning=body.planning==null?null:parseRoutePlanning(body.planning);
    if(body.planning!=null&&!planning)return NextResponse.json({error:'INVALID_PLANNING'},{status:400});
    patch.planning=planning;
    patch.path=path;patch.path_gaps=validRouteGaps(body.pathGaps,body.path.length);
    patch.distance_meters=Math.round(measuredRouteDistance(body.path,patch.path_gaps as number[]));
  }
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.description === 'string') patch.description = body.description.trim() || null;
  if (typeof body.color === 'string' && body.color.trim()) patch.color = body.color.trim();
  if (visibilityModes.has(body.visibility)) {
    patch.visibility = body.visibility;
    patch.moderation_status = body.visibility === 'public' ? 'pending' : 'approved';
    patch.share_token = body.visibility === 'shared' ? crypto.randomUUID() : null;
  }

  const { data, error } = await supabase
    .from('map_routes')
    .update(patch)
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    feature: {...data,path:{type:'LineString',coordinates:storedRoutePoints(data.path)||body.path}},
    shareUrl: data.visibility === 'shared' && data.share_token
      ? `${origin}/map/share/${data.share_token}`
      : null,
  });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { ownerId, supabase } = await requestContext(request);
  if (!ownerId || !supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const owned = await ownedRoute(supabase, ownerId, id);
  if (owned.error || !owned.data) return NextResponse.json({ error: 'ROUTE_NOT_FOUND' }, { status: 404 });

  const { error } = await supabase.from('map_routes').delete().eq('id', id).eq('owner_id', ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(request:Request,{params}:Ctx){
  const auth=await getRequestAuth(request),session=getAppSessionFromRequest(request);
  if(!principalsAgree({bearerOwnerId:auth.user?.id,sessionOwnerId:session?.ownerId}))return NextResponse.json({error:'IDENTITY_PRINCIPAL_MISMATCH'},{status:401});
  const owner=auth.user?.id??session?.ownerId;
  if(!owner)return NextResponse.json({error:'AUTH_REQUIRED'},{status:401});
  const {id}=await params,pet=new URL(request.url).searchParams.get('petId');
  if(!z.uuid().safeParse(id).success||!z.uuid().safeParse(pet).success)return NextResponse.json({error:'INVALID_ROUTE_REFERENCE'},{status:400});
  try{return NextResponse.json({route:await readOwnedMapRoute(owner,pet!,id)},{headers:{'Cache-Control':'private, no-store'}});}
  catch(error){const missing=error instanceof Error&&error.message==='ROUTE_NOT_FOUND';return NextResponse.json({error:missing?'ROUTE_NOT_FOUND':'ROUTE_READ_FAILED'},{status:missing?404:503,headers:{'Cache-Control':'private, no-store'}});}
}
