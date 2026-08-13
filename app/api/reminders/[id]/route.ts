import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import {
  abortCareMutation,
  beginCareMutation,
  careError,
  careMutationError,
  careRequestFingerprint,
  finishCareMutation,
  readCareIdempotencyKey,
} from '@/lib/server/careHttp';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

async function ownedReminder(supabase: any, userId: string, id: string) {
  return supabase.from('reminders').select('*, pets!inner(owner_id)').eq('id', id).eq('pets.owner_id', userId).maybeSingle();
}

async function context(request: Request, id: string) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId || !supabase) return { response: careError('AUTH_REQUIRED', 'Откройте Псё из Telegram и попробуйте снова.', 401) } as const;
  const owned = await ownedReminder(supabase, ownerId, id);
  if (owned.error || !owned.data) return { response: careError('REMINDER_NOT_FOUND', 'Это дело не найдено или недоступно.', 404) } as const;
  return { supabase, ownerId, reminder: owned.data } as const;
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const requestContext = await context(request, id);
  if ('response' in requestContext) return requestContext.response;
  const { supabase, ownerId } = requestContext;
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно сохранить изменения. Повторите попытку.', 400);
  const patch: Record<string, unknown> = {};
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if (body.dueAt) patch.due_at = body.dueAt;
  if (body.type) patch.type = body.type;
  if (body.recurrence) patch.recurrence = body.recurrence;
  if (Object.keys(patch).length === 0) return careError('NO_VALID_FIELDS', 'Измените хотя бы одно поле дела.', 400);
  const fingerprint = careRequestFingerprint({ id, patch });

  try {
    const claim = await beginCareMutation({ supabase, ownerId, idempotencyKey, operation: 'reminder:update', fingerprint });
    if (claim.replayed) return NextResponse.json(claim.response);
    const { data, error } = await supabase.from('reminders').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    const event = await supabase.from('reminder_events').insert({ reminder_id: id, event_type: 'updated', idempotency_key: idempotencyKey, payload: patch });
    if (event.error) throw event.error;
    const response = { reminder: data };
    await finishCareMutation({ supabase, ownerId, idempotencyKey, response });
    return NextResponse.json(response);
  } catch (error) {
    await abortCareMutation({ supabase, ownerId, idempotencyKey });
    return careMutationError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const requestContext = await context(request, id);
  if ('response' in requestContext) return requestContext.response;
  const { supabase, ownerId } = requestContext;
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно удалить дело. Повторите попытку.', 400);
  const fingerprint = careRequestFingerprint({ id });
  try {
    const claim = await beginCareMutation({ supabase, ownerId, idempotencyKey, operation: 'reminder:delete', fingerprint });
    if (claim.replayed) return NextResponse.json(claim.response);
    const event = await supabase.from('reminder_events').insert({ reminder_id: id, event_type: 'deleted', idempotency_key: idempotencyKey, payload: {} });
    if (event.error) throw event.error;
    const removed = await supabase.from('reminders').delete().eq('id', id);
    if (removed.error) throw removed.error;
    const response = { ok: true };
    await finishCareMutation({ supabase, ownerId, idempotencyKey, response });
    return NextResponse.json(response);
  } catch (error) {
    await abortCareMutation({ supabase, ownerId, idempotencyKey });
    return careMutationError(error);
  }
}
