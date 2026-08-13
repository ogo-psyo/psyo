import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { careError, careMutationError, careRequestFingerprint, readCareIdempotencyKey } from '@/lib/server/careHttp';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  const supabase = getSupabaseAdmin();
  const ownerId = auth.user?.id ?? session?.ownerId;
  if (!ownerId || !supabase) return careError('AUTH_REQUIRED', 'Откройте Псё из Telegram и попробуйте снова.', 401);
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно перенести дело.', 400);
  const snoozedUntil = typeof body.snoozedUntil === 'string' ? body.snoozedUntil : null;
  const fingerprint = careRequestFingerprint({ id, snoozedUntil: body.snoozedUntil ?? null });
  try {
    const { data, error } = await supabase.rpc('care_snooze_reminder_atomic', {
      p_owner_id: ownerId,
      p_idempotency_key: idempotencyKey,
      p_request_fingerprint: fingerprint,
      p_reminder_id: id,
      p_snoozed_until: snoozedUntil,
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return careMutationError(error);
  }
}
