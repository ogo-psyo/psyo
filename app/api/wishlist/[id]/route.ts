import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

const allowedCategories = new Set(['food', 'treats', 'toy', 'gear', 'health', 'grooming', 'course', 'service', 'other']);
const allowedPriorities = new Set(['low', 'medium', 'high']);
const allowedStatuses = new Set(['wanted', 'bought', 'not_suitable']);

async function ownedWishlistItem(supabase: any, userId: string, id: string) {
  return supabase
    .from('wishlist_items')
    .select('id, pets!inner(owner_id)')
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

  const owned = await ownedWishlistItem(supabase, ownerId, id);
  if (owned.error) return NextResponse.json({ error: 'WISHLIST_ITEM_NOT_FOUND' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.reason === 'string') patch.reason = body.reason.trim() || null;
  if (typeof body.url === 'string') patch.url = body.url.trim() || null;
  if (allowedCategories.has(body.category)) patch.category = body.category;
  if (allowedPriorities.has(body.priority)) patch.priority = body.priority;
  if (allowedStatuses.has(body.status)) patch.status = body.status;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'NO_VALID_FIELDS' }, { status: 400 });

  const { data, error } = await supabase.from('wishlist_items').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data, mode: 'supabase' });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId || !supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const owned = await ownedWishlistItem(supabase, ownerId, id);
  if (owned.error) return NextResponse.json({ error: 'WISHLIST_ITEM_NOT_FOUND' }, { status: 404 });

  const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
