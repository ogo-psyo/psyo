import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { abortCareMutation, beginCareMutation, careError, careMutationError, careRequestFingerprint, finishCareMutation, readCareIdempotencyKey } from '@/lib/server/careHttp';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно вернуть запись.', 400);
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? session?.ownerId;
  if (!ownerId || !supabase) return careError('AUTH_REQUIRED', 'Откройте Псё из Telegram и попробуйте снова.', 401);
  const owned = await supabase.from('pet_observations').select('id,deleted_at,pets!inner(owner_id)').eq('id', id).eq('pets.owner_id', ownerId).maybeSingle();
  if (owned.error || !owned.data) return careError('OBSERVATION_NOT_FOUND', 'Эта запись не найдена или недоступна.', 404);
  const fingerprint = careRequestFingerprint({ id });
  try {
    const claim = await beginCareMutation({ supabase, ownerId, idempotencyKey, operation: 'observation:restore', fingerprint });
    if (claim.replayed) return NextResponse.json(claim.response);
    const restored = await supabase.from('pet_observations').update({ deleted_at: null }).eq('id', id).select('*').single();
    if (restored.error) throw restored.error;
    const response = { observation: restored.data, restored: true };
    await finishCareMutation({ supabase, ownerId, idempotencyKey, response });
    return NextResponse.json(response);
  } catch (error) {
    await abortCareMutation({ supabase, ownerId, idempotencyKey });
    return careMutationError(error);
  }
}
