import { principalsAgree } from '@/lib/socialCore';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { careError, careMutationError, careRequestFingerprint, readCareIdempotencyKey } from '@/lib/server/careHttp';
export const runtime = 'nodejs';
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
 const { id } = await ctx.params;
 const body = await request.json().catch(() => null);
 const auth = await getRequestAuth(request), session = getAppSessionFromRequest(request);
 if (!principalsAgree({ bearerOwnerId: auth.user?.id, sessionOwnerId: session?.ownerId })) return careError('AUTH_REQUIRED','Войдите в Псё.',401);
 const ownerId = auth.user?.id ?? session?.ownerId, supabase = getSupabaseAdmin();
 if (!ownerId || !supabase) return careError('AUTH_REQUIRED','Войдите в Псё.',401);
 const key = readCareIdempotencyKey(request, body);
 if (!key || typeof body?.completedAt !== 'string' || !Number.isFinite(Date.parse(body.completedAt))) return careError('INVALID_COMPLETION','Не удалось определить выполнение для отмены.',400);
 try {
  const { data, error } = await supabase.rpc('care_undo_reminder_completion_atomic', { p_owner_id:ownerId, p_idempotency_key:key, p_request_fingerprint:careRequestFingerprint({id,completedAt:body.completedAt}), p_reminder_id:id, p_completed_at:body.completedAt });
  if (error) { if (error.message?.includes('COMPLETION_CHANGED')) return careError('COMPLETION_CHANGED','Дело уже изменилось. Обнови список — последующие изменения не отменены.',409); throw error; }
  return Response.json(data);
 } catch (error) { return careMutationError(error); }
}
