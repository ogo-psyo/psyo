import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };
async function ownedReminder(supabase: any, userId: string, id: string) {
  return supabase.from('reminders').select('id, pets!inner(owner_id)').eq('id', id).eq('pets.owner_id', userId).single();
}
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId || !supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const owned = await ownedReminder(supabase, ownerId, id);
  if (owned.error) return NextResponse.json({ error: 'REMINDER_NOT_FOUND' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.title) patch.title = body.title;
  if (body.dueAt) patch.due_at = body.dueAt;
  if (body.type) patch.type = body.type;
  if (body.recurrence) patch.recurrence = body.recurrence;
  if (body.status) patch.status = body.status;
  const { data, error } = await supabase.from('reminders').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('reminder_events').insert({ reminder_id: id, event_type: 'updated', payload: patch });
  return NextResponse.json({ reminder: data });
}
export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId || !supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const owned = await ownedReminder(supabase, ownerId, id);
  if (owned.error) return NextResponse.json({ error: 'REMINDER_NOT_FOUND' }, { status: 404 });
  await supabase.from('reminder_events').insert({ reminder_id: id, event_type: 'deleted', payload: {} });
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
