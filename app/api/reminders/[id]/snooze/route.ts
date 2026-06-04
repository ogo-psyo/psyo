import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  if (!auth.user || !auth.supabase) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const snoozedUntil = body.snoozedUntil || new Date(Date.now() + 86400000).toISOString();
  const owned = await auth.supabase.from('reminders').select('id, pets!inner(owner_id)').eq('id', id).eq('pets.owner_id', auth.user.id).single();
  if (owned.error) return NextResponse.json({ error: 'REMINDER_NOT_FOUND' }, { status: 404 });
  const { data, error } = await auth.supabase.from('reminders').update({ status: 'snoozed', snoozed_until: snoozedUntil }).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.supabase.from('reminder_events').insert({ reminder_id: id, event_type: 'snoozed', payload: { snoozedUntil } });
  return NextResponse.json({ reminder: data });
}
