import { NextResponse } from 'next/server';
import { clearAppSessionCookie, getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { problem } from '@/packages/contracts';

export const runtime = 'nodejs';

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  if (body?.confirmation !== 'DELETE_ACCOUNT') {
    const payload = problem('DELETE_CONFIRMATION_REQUIRED', 400, 'Account deletion must be confirmed', 'Send confirmation DELETE_ACCOUNT.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const appSession = getAppSessionFromRequest(request);
  const auth = await getRequestAuth(request);
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId) {
    const payload = problem('AUTH_REQUIRED', 401, 'Authentication is required', 'Deleting an account requires a verified owner session.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'STORAGE_REQUIRED' }, { status: 503 });

  const deleted = await supabase.auth.admin.deleteUser(ownerId);
  if (deleted.error) return NextResponse.json({ error: deleted.error.message }, { status: 500 });

  const response = NextResponse.json({ deleted: true });
  clearAppSessionCookie(response);
  return response;
}
