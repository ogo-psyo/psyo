import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
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
  return { id: row.id, petId: row.pet_id, type: row.type, title: row.title, dueAt: row.due_at, recurrence: row.recurrence, status: row.status, completedAt: row.completed_at, snoozedUntil: row.snoozed_until, nextDueAt: row.next_due_at };
}

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const url = new URL(request.url);
  const petId = url.searchParams.get('petId');
  const status = url.searchParams.get('status');
  const due = url.searchParams.get('due') as DueFilter | null;

  if (!supabase) return NextResponse.json({ reminders: [], ...demoModeResponse('Set Supabase env.') });
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

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
  return NextResponse.json({ reminders: (data ?? []).map(mapReminder), mode: 'user' });
}

export async function POST(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.dueAt || !body?.petId) return careError('REMINDER_FIELDS_REQUIRED', 'Укажите собаку, название и дату дела.', 400);
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно сохранить дело. Повторите попытку.', 400);
  if (!supabase) return NextResponse.json({ reminder: { id: crypto.randomUUID(), status: 'active', ...body }, ...demoModeResponse('Connect Supabase.') }, { status: 201 });
  if (!ownerId) return careError('AUTH_REQUIRED', 'Откройте Псё из Telegram и попробуйте снова.', 401);

  const fingerprint = careRequestFingerprint({
    petId: body.petId,
    title: String(body.title).trim(),
    dueAt: body.dueAt,
    type: body.type || 'custom',
    recurrence: body.recurrence || 'none',
  });
  try {
    const { data, error } = await supabase.rpc('care_create_reminder_atomic', {
      p_owner_id: ownerId,
      p_idempotency_key: idempotencyKey,
      p_request_fingerprint: fingerprint,
      p_pet_id: body.petId,
      p_type: body.type || 'custom',
      p_title: String(body.title).trim(),
      p_due_at: body.dueAt,
      p_recurrence: body.recurrence || 'none',
      p_source: body.source || 'manual',
    });
    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return careMutationError(error);
  }
}
