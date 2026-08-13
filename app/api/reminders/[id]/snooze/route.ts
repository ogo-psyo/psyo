import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { snoozeReminder, type CareReminderState } from '@/lib/server/careLifecycle';
import { abortCareMutation, beginCareMutation, careError, careMutationError, careRequestFingerprint, finishCareMutation, readCareIdempotencyKey } from '@/lib/server/careHttp';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? session?.ownerId;
  if (!ownerId || !supabase) return careError('AUTH_REQUIRED', 'Откройте Псё из Telegram и попробуйте снова.', 401);
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно перенести дело.', 400);
  const snoozedUntil = body.snoozedUntil || new Date(Date.now() + 86_400_000).toISOString();
  const owned = await supabase.from('reminders').select('*, pets!inner(owner_id)').eq('id', id).eq('pets.owner_id', ownerId).maybeSingle();
  if (owned.error || !owned.data) return careError('REMINDER_NOT_FOUND', 'Это дело не найдено или недоступно.', 404);
  const fingerprint = careRequestFingerprint({ id, snoozedUntil });
  try {
    const claim = await beginCareMutation({ supabase, ownerId, idempotencyKey, operation: 'reminder:snooze', fingerprint });
    if (claim.replayed) return NextResponse.json(claim.response);
    const snoozed = snoozeReminder({ id, petId: owned.data.pet_id, title: owned.data.title, dueAt: owned.data.due_at, recurrence: owned.data.recurrence ?? 'none', status: owned.data.status } as CareReminderState, snoozedUntil);
    const updated = await supabase.from('reminders').update({ status: snoozed.status, snoozed_until: snoozed.snoozedUntil }).eq('id', id).select('*').single();
    if (updated.error) throw updated.error;
    const event = await supabase.from('reminder_events').insert({ reminder_id: id, event_type: 'snoozed', idempotency_key: idempotencyKey, payload: { snoozedUntil: snoozed.snoozedUntil } });
    if (event.error) throw event.error;
    const response = { reminder: updated.data };
    await finishCareMutation({ supabase, ownerId, idempotencyKey, response });
    return NextResponse.json(response);
  } catch (error) {
    await abortCareMutation({ supabase, ownerId, idempotencyKey });
    return careMutationError(error);
  }
}
