import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { checkInHabitForOwner } from '@/lib/server/habitService';
import { readCareIdempotencyKey } from '@/lib/server/careHttp';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { problem } from '@/packages/contracts';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  const ownerId = auth.user?.id ?? session?.ownerId;
  const supabase = getSupabaseAdmin();
  if (!ownerId) return NextResponse.json(problem('AUTH_REQUIRED', 401, 'Authentication required', 'Open Псё from Telegram.'), { status: 401 });
  if (!supabase) return NextResponse.json(problem('STORAGE_UNAVAILABLE', 503, 'Storage unavailable', 'Habit storage is not configured.'), { status: 503 });
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return NextResponse.json(problem('IDEMPOTENCY_KEY_REQUIRED', 400, 'Safe retry key required', 'Retry the habit check-in.'), { status: 400 });
  try {
    const checkin = await checkInHabitForOwner({
      supabase,
      ownerId,
      habitId: id,
      idempotencyKey,
      completedAt: typeof body.completedAt === 'string' ? body.completedAt : undefined,
      note: typeof body.note === 'string' ? body.note : undefined,
    });
    return NextResponse.json({ checkin }, { status: checkin.replayed ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message.includes('HABIT_NOT_FOUND') ? 404 : message.includes('IDEMPOTENCY_KEY_REUSED') ? 409 : 500;
    const code = status === 404 ? 'HABIT_NOT_FOUND' : status === 409 ? 'IDEMPOTENCY_KEY_REUSED' : 'HABIT_CHECKIN_FAILED';
    return NextResponse.json(problem(code, status, 'Habit was not updated', status === 409 ? 'Retry with the original habit check-in.' : 'Could not mark this habit.'), { status });
  }
}
