import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import {reminderMode} from '@/lib/reminder';
import {principalsAgree} from '@/lib/socialCore';
import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import {
  careError,
  careMutationError,
  careRequestFingerprint,
  readCareIdempotencyKey,
} from '@/lib/server/careHttp';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

async function context(request: Request):Promise<{response:Response}|{supabase:SupabaseClient;ownerId:string}> {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  if(!principalsAgree({bearerOwnerId:auth.user?.id,sessionOwnerId:appSession?.ownerId}))return {response:careError("AUTH_REQUIRED","Откройте Псё заново через Telegram.",401)} as const;
  const supabase = getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId || !supabase) return { response: careError('AUTH_REQUIRED', 'Откройте Псё из Telegram и попробуйте снова.', 401) } as const;
  return { supabase, ownerId } as const;
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const requestContext = await context(request);
  if ('response' in requestContext) return requestContext.response;
  const { supabase, ownerId } = requestContext;
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно сохранить изменения. Повторите попытку.', 400);
  if(!body||typeof body!=='object'||Array.isArray(body))return careError('NO_VALID_FIELDS','Проверьте поля дела.',400);
  if(('timeMode' in body&&!reminderMode(body.timeMode))||('dueAt' in body&&!z.iso.datetime({offset:true}).safeParse(body.dueAt).success))return careError('INVALID_TIME_MODE','Проверьте дату и точность времени.',400);
  const patch: Record<string, unknown> = {};
  if(body.timeMode)patch.time_mode=body.timeMode;
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim();
  if (body.dueAt) patch.due_at = body.dueAt;
  if (body.type) patch.type = body.type;
  if (body.recurrence) patch.recurrence = body.recurrence;
  if (Object.keys(patch).length === 0) return careError('NO_VALID_FIELDS', 'Измените хотя бы одно поле дела.', 400);
  const fingerprint = careRequestFingerprint({ id, patch });

  try {
    const { data, error } = await supabase.rpc('care_update_reminder_atomic', {
      p_owner_id: ownerId,
      p_idempotency_key: idempotencyKey,
      p_request_fingerprint: fingerprint,
      p_reminder_id: id,
      p_patch: patch,
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return careMutationError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const requestContext = await context(request);
  if ('response' in requestContext) return requestContext.response;
  const { supabase, ownerId } = requestContext;
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно удалить дело. Повторите попытку.', 400);
  const fingerprint = careRequestFingerprint({ id });
  try {
    const { data, error } = await supabase.rpc('care_delete_reminder_atomic', {
      p_owner_id: ownerId,
      p_idempotency_key: idempotencyKey,
      p_request_fingerprint: fingerprint,
      p_reminder_id: id,
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return careMutationError(error);
  }
}
