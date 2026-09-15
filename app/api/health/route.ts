import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { healthTimelinePageForOwner, parseHealthCursor } from '@/lib/server/healthTimelineService';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { problem } from '@/packages/contracts';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  const ownerId = auth.user?.id ?? session?.ownerId;
  const supabase = getSupabaseAdmin();
  const petId = new URL(request.url).searchParams.get('petId')?.trim() ?? '';
  if (auth.user?.id && session?.ownerId && auth.user.id !== session.ownerId) return NextResponse.json(problem('AUTH_MISMATCH',403,'Conflicting sessions','Open Псё again.'),{status:403});
  if (!ownerId) return NextResponse.json(problem('AUTH_REQUIRED', 401, 'Authentication required', 'Open Псё from Telegram.'), { status: 401 });
  if (!supabase) return NextResponse.json(problem('STORAGE_UNAVAILABLE', 503, 'Storage unavailable', 'Health timeline storage is not configured.'), { status: 503 });
  if (!petId) return NextResponse.json(problem('PET_REQUIRED', 400, 'Dog required', 'Choose a dog.'), { status: 400 });
  try {
    const before = parseHealthCursor(new URL(request.url).searchParams.get('before'));
    return NextResponse.json(await healthTimelinePageForOwner({supabase,ownerId,petId,before}), {headers:{'Cache-Control':'private, no-store'}});
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_HEALTH_CURSOR') return NextResponse.json(problem('INVALID_HEALTH_CURSOR',400,'Invalid page','Reload the records.'),{status:400});
    return NextResponse.json(problem('HEALTH_TIMELINE_FAILED', 500, 'Health timeline unavailable', 'Could not load the timeline.'), { status: 500 });
  }
}
