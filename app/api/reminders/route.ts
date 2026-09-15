import {z} from 'zod';
import {reminderMode} from '@/lib/reminder';
import {principalsAgree} from '@/lib/socialCore';
import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import {
  careError,
  careMutationError,
  careRequestFingerprint,
  readCareIdempotencyKey,
} from '@/lib/server/careHttp';

export const runtime = 'nodejs';

type DueFilter = 'today' | 'upcoming' | 'overdue';

function mapReminder(row: any) {
  return { id: row.id, petId: row.pet_id, type: row.type, title: row.title, dueAt: row.due_at, recurrence: row.recurrence, status: row.status, completedAt: row.completed_at, snoozedUntil: row.snoozed_until, nextDueAt: row.next_due_at, timeMode: reminderMode(row.metadata?.timeMode) };
}

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  if(!principalsAgree({bearerOwnerId:auth.user?.id,sessionOwnerId:appSession?.ownerId}))return careError("AUTH_REQUIRED","Откройте Псё заново через Telegram.",401);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const url = new URL(request.url);
  const petId = url.searchParams.get('petId');
  const status = url.searchParams.get('status');
  const due = url.searchParams.get('due') as DueFilter | null;

  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!supabase) return careError('STORAGE_UNAVAILABLE','Не удалось загрузить дела. Повторите попытку позже.',503);

  let query = supabase.from('reminders').select('*, pets!inner(owner_id)').eq('pets.owner_id', ownerId).order('due_at', { ascending: true });
  if (petId) query = query.eq('pet_id', petId);
  if (status) query = query.eq('status', status);
  const now = new Date();
  if (due === 'overdue') query = query.lt('due_at', now.toISOString()).neq('status', 'done');
  if (due === 'today') {
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    query = query.gte('due_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()).lte('due_at', end.toISOString());
  }
  if (due === 'upcoming') query = query.gt('due_at', now.toISOString());

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminders: (data ?? []).map(mapReminder), mode: 'user' },{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  if(!principalsAgree({bearerOwnerId:auth.user?.id,sessionOwnerId:appSession?.ownerId}))return careError("AUTH_REQUIRED","Откройте Псё заново через Telegram.",401);
  const supabase = getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const body = await request.json().catch(() => null);
  if (!ownerId) return careError('AUTH_REQUIRED', 'Откройте Псё из Telegram и попробуйте снова.', 401);
  if (!supabase) return careError('STORAGE_UNAVAILABLE','Не удалось сохранить дело. Повторите попытку позже.',503);
  const parsed=z.object({title:z.string().trim().min(1).max(200),petId:z.string().min(1),dueAt:z.iso.datetime({offset:true}),type:z.string().min(1).max(80).optional(),recurrence:z.enum(['none','daily','weekly','monthly','quarterly','yearly']).optional(),timeMode:z.enum(['exact','flexible','approximate']).optional()}).safeParse(body);
  if(!parsed.success)return careError('REMINDER_FIELDS_REQUIRED','Проверьте название, дату и время дела.',400);
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно сохранить дело. Повторите попытку.', 400);

  const fingerprint = careRequestFingerprint({
    petId: body.petId,
    title: String(body.title).trim(),
    dueAt: body.dueAt,
    type: body.type || 'custom',
    recurrence: body.recurrence || 'none',
    ...(body.timeMode?{timeMode:body.timeMode}:{}),
  });
  try {
    const { data, error } = await supabase.rpc(body.timeMode?'care_create_reminder_v2':'care_create_reminder_atomic', {
      p_owner_id: ownerId,
      p_idempotency_key: idempotencyKey,
      p_request_fingerprint: fingerprint,
      p_pet_id: body.petId,
      p_type: body.type || 'custom',
      p_title: String(body.title).trim(),
      p_due_at: body.dueAt,
      p_recurrence: body.recurrence || 'none',
      p_source: body.source || 'manual',
      ...(body.timeMode?{p_time_mode:body.timeMode}:{}),
    });
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return careMutationError(error);
  }
}
