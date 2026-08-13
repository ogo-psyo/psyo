import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export async function socialRequestContext(request: Request) {
  const [auth, appSession] = await Promise.all([
    getRequestAuth(request),
    Promise.resolve(getAppSessionFromRequest(request)),
  ]);
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId) {
    return { response: NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 }) } as const;
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { response: NextResponse.json({ error: 'SOCIAL_STORAGE_UNAVAILABLE' }, { status: 503 }) } as const;
  }
  return {
    ownerId,
    supabase,
    verifiedTelegramContact: appSession?.verifiedTelegramContact ?? { username: null },
  } as const;
}

export function socialStorageError(error?: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/INVITE_GONE/.test(message)) return NextResponse.json({ error: 'INVITE_GONE' }, { status: 410 });
  if (/INVITE_SELF_ACCEPT_FORBIDDEN/.test(message)) return NextResponse.json({ error: 'INVITE_SELF_ACCEPT_FORBIDDEN' }, { status: 409 });
  if (/RECIPIENT_PET_NOT_FOUND/.test(message)) return NextResponse.json({ error: 'RECIPIENT_PET_NOT_FOUND' }, { status: 404 });
  if (/INVITE_NOT_AVAILABLE/.test(message)) return NextResponse.json({ error: 'INVITE_NOT_AVAILABLE' }, { status: 404 });
  return NextResponse.json({ error: 'SOCIAL_STORAGE_FAILED' }, { status: 500 });
}

export function readIdempotencyKey(request: Request, body: unknown) {
  const source = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const key = String(request.headers.get('idempotency-key') ?? source.idempotencyKey ?? '').trim();
  return key.length >= 8 && key.length <= 128 ? key : null;
}
