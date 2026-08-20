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
    .select('id, owner_id, pet_id, title, description, color, visibility, moderation_status, share_token, route_source, started_at, duration_seconds, distance_meters, created_at, updated_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  return NextResponse.json({
    feature: data,
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
