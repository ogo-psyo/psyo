import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { validateCreatePetCommand } from '@/packages/contracts';
import { savePetProfile } from '@/lib/server/profileService';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { getAppSessionFromRequest } from '@/lib/server/appSession';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = validateCreatePetCommand(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error.detail, problem: parsed.error }, { status: parsed.error.status });

  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ pet: { id: crypto.randomUUID(), name: parsed.command.dogName }, ...demoModeResponse('Connect Supabase env to persist pet profile.') }, { status: 201 });

  const owner = auth.user ?? (appSession?.ownerId ? { id: appSession.ownerId, email: null, user_metadata: { provider: 'telegram' } } : null);
  if (!owner) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  try {
    const result = await savePetProfile({ supabase, user: owner, profile: parsed.command });
    return NextResponse.json({ mode: auth.user ? 'user' : 'telegram', ...result }, { status: parsed.command.backendPetId ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save pet' }, { status: 500 });
  }
}
