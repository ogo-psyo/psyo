import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { careError } from '@/lib/server/careHttp';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? session?.ownerId;
  if (!ownerId || !supabase) return careError('AUTH_REQUIRED', 'Откройте Псё из Telegram и попробуйте снова.', 401);
  const owned = await supabase.from('reminders').select('id, pets!inner(owner_id)').eq('id', id).eq('pets.owner_id', ownerId).maybeSingle();
  if (owned.error || !owned.data) return careError('REMINDER_NOT_FOUND', 'Это дело не найдено или недоступно.', 404);
  const history = await supabase.from('reminder_events').select('id,event_type,payload,created_at').eq('reminder_id', id).eq('event_type', 'completed').order('created_at', { ascending: false });
  if (history.error) return careError('CARE_HISTORY_FAILED', 'Не удалось загрузить историю. Попробуйте ещё раз.', 500);
  return NextResponse.json({ history: history.data ?? [] });
}
