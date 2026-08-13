import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId || !supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const owned = await supabase
    .from('map_zones')
    .select('id, pets!inner(owner_id)')
    .eq('id', id)
    .eq('pets.owner_id', ownerId)
    .not('deleted_at', 'is', null)
    .maybeSingle();
  if (owned.error || !owned.data) return NextResponse.json({ error: 'ZONE_NOT_FOUND' }, { status: 404 });

  const { data, error } = await supabase
    .from('map_zones')
    .update({ deleted_at: null })
    .eq('id', id)
    .not('deleted_at', 'is', null)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ zone: data });
}
