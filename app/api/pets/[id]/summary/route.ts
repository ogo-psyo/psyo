import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { getDogSummaryForOwner } from '@/lib/server/dogSummaryService';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { problem } from '@/packages/contracts';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  const ownerId = auth.user?.id ?? session?.ownerId;
  const supabase = getSupabaseAdmin();
  if (!ownerId) return NextResponse.json(problem('AUTH_REQUIRED', 401, 'Authentication required', 'Open Псё from Telegram.'), { status: 401 });
  if (!supabase) return NextResponse.json(problem('STORAGE_UNAVAILABLE', 503, 'Storage unavailable', 'Dog summary storage is not configured.'), { status: 503 });
  try {
    return NextResponse.json({ summary: await getDogSummaryForOwner({ supabase, ownerId, petId: id }) });
  } catch (error) {
    const status = error instanceof Error && error.message.includes('PET_NOT_FOUND') ? 404 : 500;
    return NextResponse.json(problem(status === 404 ? 'PET_NOT_FOUND' : 'DOG_SUMMARY_FAILED', status, 'Dog summary unavailable', 'Could not load this summary.'), { status });
  }
}
