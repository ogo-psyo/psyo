import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { validateCreatePetCommand } from '@/packages/contracts';
import { createPetProfileIdempotently, savePetProfile } from '@/lib/server/profileService';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { getAppSessionFromRequest } from '@/lib/server/appSession';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateCreatePetCommand(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error.detail, problem: parsed.error }, { status: parsed.error.status });

  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const admin = getSupabaseAdmin();
  const supabase = auth.supabase ?? admin;
  if (!supabase) return NextResponse.json({ pet: { id: crypto.randomUUID(), name: parsed.command.dogName }, ...demoModeResponse('Connect Supabase env to persist pet profile.') }, { status: 201 });

  const owner = auth.user ?? (appSession?.ownerId ? { id: appSession.ownerId, email: null, user_metadata: { provider: 'telegram' } } : null);
  if (!owner) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  try {
    const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
    if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
      return NextResponse.json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
    }
    if (!admin) return NextResponse.json({ error: 'STORAGE_REQUIRED' }, { status: 503 });
    const result = parsed.command.backendPetId
      ? await savePetProfile({ supabase: admin!, user: owner, profile: parsed.command, idempotencyKey })
      : await createPetProfileIdempotently({ supabase: admin!, user: owner, profile: parsed.command, idempotencyKey });
    const replayed = 'replayed' in result && result.replayed === true;
    return NextResponse.json({ mode: auth.user ? 'user' : 'telegram', ...result }, { status: parsed.command.backendPetId || replayed ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    if (message.includes('PROFILE_VERSION_CONFLICT')) return NextResponse.json({ error: 'PROFILE_VERSION_CONFLICT' }, { status: 409 });
    if (message.includes('IDEMPOTENCY_KEY_REUSED')) return NextResponse.json({ error: 'IDEMPOTENCY_KEY_REUSED' }, { status: 409 });
    if (message.includes('PET_NOT_FOUND')) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save pet' }, { status: 500 });
  }
}
