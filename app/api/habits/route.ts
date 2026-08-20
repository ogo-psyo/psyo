import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { createHabitForOwner, listHabitsForOwner, normalizeHabitInput } from '@/lib/server/habitService';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { problem } from '@/packages/contracts';

export const runtime = 'nodejs';

async function context(request: Request) {
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  return { ownerId: auth.user?.id ?? session?.ownerId, supabase: getSupabaseAdmin() };
}

export async function GET(request: Request) {
  const petId = new URL(request.url).searchParams.get('petId')?.trim() ?? '';
  const { ownerId, supabase } = await context(request);
  if (!ownerId) return NextResponse.json(problem('AUTH_REQUIRED', 401, 'Authentication required', 'Open Псё from Telegram.'), { status: 401 });
  if (!supabase) return NextResponse.json(problem('STORAGE_UNAVAILABLE', 503, 'Storage unavailable', 'Habit storage is not configured.'), { status: 503 });
  if (!petId) return NextResponse.json(problem('PET_REQUIRED', 400, 'Dog required', 'Choose a dog.'), { status: 400 });
  try {
    return NextResponse.json({ habits: await listHabitsForOwner({ supabase, ownerId, petId }) });
  } catch (error) {
    const status = error instanceof Error && error.message.includes('PET_NOT_FOUND') ? 404 : 500;
    return NextResponse.json(problem(status === 404 ? 'PET_NOT_FOUND' : 'HABIT_LIST_FAILED', status, 'Habits unavailable', 'Could not load habits.'), { status });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const habit = normalizeHabitInput(body);
  if (!habit) return NextResponse.json(problem('VALIDATION_FAILED', 400, 'Habit is invalid', 'Check the dog, title, type and cadence.'), { status: 400 });
  const { ownerId, supabase } = await context(request);
  if (!ownerId) return NextResponse.json(problem('AUTH_REQUIRED', 401, 'Authentication required', 'Open Псё from Telegram.'), { status: 401 });
  if (!supabase) return NextResponse.json(problem('STORAGE_UNAVAILABLE', 503, 'Storage unavailable', 'Habit storage is not configured.'), { status: 503 });
  try {
    return NextResponse.json({ habit: await createHabitForOwner({ supabase, ownerId, habit }) }, { status: 201 });
  } catch (error) {
    const status = error instanceof Error && error.message.includes('PET_NOT_FOUND') ? 404 : 500;
    return NextResponse.json(problem(status === 404 ? 'PET_NOT_FOUND' : 'HABIT_CREATE_FAILED', status, 'Habit was not saved', 'Could not save this habit.'), { status });
  }
}
