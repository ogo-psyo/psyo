import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { archiveHabitForOwner, normalizeHabitUpdate, updateHabitForOwner } from '@/lib/server/habitService';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { problem } from '@/packages/contracts';

export const runtime = 'nodejs';

async function context(request: Request) {
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  return { ownerId: auth.user?.id ?? session?.ownerId, supabase: getSupabaseAdmin() };
}

export async function PATCH(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const { id } = await routeContext.params;
  const update = normalizeHabitUpdate(await request.json().catch(() => null));
  if (!update) return NextResponse.json(problem('VALIDATION_FAILED', 400, 'Habit is invalid', 'Check the title, type and cadence.'), { status: 400 });
  const { ownerId, supabase } = await context(request);
  if (!ownerId) return NextResponse.json(problem('AUTH_REQUIRED', 401, 'Authentication required', 'Open Псё from Telegram.'), { status: 401 });
  if (!supabase) return NextResponse.json(problem('STORAGE_UNAVAILABLE', 503, 'Storage unavailable', 'Habit storage is not configured.'), { status: 503 });
  try {
    return NextResponse.json({ habit: await updateHabitForOwner({ supabase, ownerId, habitId: id, update }) });
  } catch (error) {
    const status = error instanceof Error && error.message.includes('HABIT_NOT_FOUND') ? 404 : 500;
    return NextResponse.json(problem(status === 404 ? 'HABIT_NOT_FOUND' : 'HABIT_UPDATE_FAILED', status, 'Habit was not updated', 'Could not update this habit.'), { status });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const { id } = await routeContext.params;
  const { ownerId, supabase } = await context(request);
  if (!ownerId) return NextResponse.json(problem('AUTH_REQUIRED', 401, 'Authentication required', 'Open Псё from Telegram.'), { status: 401 });
  if (!supabase) return NextResponse.json(problem('STORAGE_UNAVAILABLE', 503, 'Storage unavailable', 'Habit storage is not configured.'), { status: 503 });
  try {
    return NextResponse.json({ habit: await archiveHabitForOwner({ supabase, ownerId, habitId: id }) });
  } catch (error) {
    const status = error instanceof Error && error.message.includes('HABIT_NOT_FOUND') ? 404 : 500;
    return NextResponse.json(problem(status === 404 ? 'HABIT_NOT_FOUND' : 'HABIT_ARCHIVE_FAILED', status, 'Habit was not archived', 'Could not archive this habit.'), { status });
  }
}
