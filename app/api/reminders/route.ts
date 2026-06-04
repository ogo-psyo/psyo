import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

type DueFilter = 'today' | 'upcoming' | 'overdue';

function mapReminder(row: any) {
  return { id: row.id, petId: row.pet_id, type: row.type, title: row.title, dueAt: row.due_at, recurrence: row.recurrence, status: row.status, completedAt: row.completed_at, snoozedUntil: row.snoozed_until };
}

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const url = new URL(request.url);
  const petId = url.searchParams.get('petId');
  const status = url.searchParams.get('status');
  const due = url.searchParams.get('due') as DueFilter | null;

  if (!supabase) return NextResponse.json({ reminders: [], ...demoModeResponse('Set Supabase env.') });
  if (!auth.user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  let query = supabase.from('reminders').select('*, pets!inner(owner_id)').eq('pets.owner_id', auth.user.id).order('due_at', { ascending: true });
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
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const body = await request.json().catch(() => null);
  if (!body?.title || !body?.dueAt || !body?.petId) return NextResponse.json({ error: 'petId, title and dueAt are required' }, { status: 400 });
  if (!supabase) return NextResponse.json({ reminder: { id: crypto.randomUUID(), status: 'active', ...body }, ...demoModeResponse('Connect Supabase.') }, { status: 201 });
  if (!auth.user) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const { data: pet, error: petError } = await supabase.from('pets').select('id').eq('id', body.petId).eq('owner_id', auth.user.id).single();
  if (petError || !pet) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

  const { data, error } = await supabase.from('reminders').insert({
    pet_id: body.petId,
    type: body.type || 'custom',
    title: body.title,
    due_at: body.dueAt,
    recurrence: body.recurrence || 'none',
    status: 'active',
    metadata: { source: body.source || 'manual' },
  }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('reminder_events').insert({ reminder_id: data.id, event_type: 'created', payload: { source: body.source || 'manual' } });
  return NextResponse.json({ reminder: mapReminder(data), mode: 'user' }, { status: 201 });
}
