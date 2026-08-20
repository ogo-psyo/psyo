import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { listHealthTimelineForOwner } from '@/lib/server/healthTimelineService';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { problem } from '@/packages/contracts';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  const ownerId = auth.user?.id ?? session?.ownerId;
  const supabase = getSupabaseAdmin();
  const petId = new URL(request.url).searchParams.get('petId')?.trim() ?? '';
  if (!ownerId) return NextResponse.json(problem('AUTH_REQUIRED', 401, 'Authentication required', 'Open Псё from Telegram.'), { status: 401 });
  if (!supabase) return NextResponse.json(problem('STORAGE_UNAVAILABLE', 503, 'Storage unavailable', 'Health timeline storage is not configured.'), { status: 503 });
  if (!petId) return NextResponse.json(problem('PET_REQUIRED', 400, 'Dog required', 'Choose a dog.'), { status: 400 });
  try {
    return NextResponse.json({ entries: await listHealthTimelineForOwner({ supabase, ownerId, petId }) });
  } catch {
    return NextResponse.json(problem('HEALTH_TIMELINE_FAILED', 500, 'Health timeline unavailable', 'Could not load the timeline.'), { status: 500 });
  }
}
