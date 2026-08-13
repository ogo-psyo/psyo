import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { completeReminder, type CareReminderState } from '@/lib/server/careLifecycle';
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
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно отметить дело выполненным.', 400);
  const owned = await supabase.from('reminders').select('*, pets!inner(owner_id)').eq('id', id).eq('pets.owner_id', ownerId).maybeSingle();
  if (owned.error || !owned.data) return careError('REMINDER_NOT_FOUND', 'Это дело не найдено или недоступно.', 404);
  const completedAt = typeof body.completedAt === 'string' ? body.completedAt : new Date().toISOString();
  const fingerprint = careRequestFingerprint({ id, completedAt });
  try {
    const claim = await beginCareMutation({ supabase, ownerId, idempotencyKey, operation: 'reminder:complete', fingerprint });
    if (claim.replayed) return NextResponse.json(claim.response);
    const row = owned.data;
    const completion = completeReminder({
      id: row.id, petId: row.pet_id, title: row.title, dueAt: row.due_at,
      recurrence: row.recurrence ?? 'none', status: row.status,
      completedAt: row.completed_at, snoozedUntil: row.snoozed_until, nextDueAt: row.next_due_at,
    } as CareReminderState, completedAt);
    const updated = await supabase.from('reminders').update({
      status: completion.reminder.status,
      due_at: completion.reminder.dueAt,
      completed_at: completion.reminder.completedAt,
      snoozed_until: null,
      next_due_at: completion.reminder.nextDueAt,
    }).eq('id', id).select('*').single();
    if (updated.error) throw updated.error;
    const event = await supabase.from('reminder_events').insert({
      reminder_id: id, event_type: 'completed', idempotency_key: idempotencyKey,
      payload: { ...completion.historyOccurrence, nextDueAt: completion.nextOccurrence?.dueAt ?? null },
    });
    if (event.error) throw event.error;
    const response = { reminder: updated.data, historyOccurrence: completion.historyOccurrence, nextOccurrence: completion.nextOccurrence };
    await finishCareMutation({ supabase, ownerId, idempotencyKey, response });
    return NextResponse.json(response);
  } catch (error) {
    await abortCareMutation({ supabase, ownerId, idempotencyKey });
    return careMutationError(error);
  }
}
