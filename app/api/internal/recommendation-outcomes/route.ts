import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { processSupabaseRecommendationOutcomeRetries } from '@/lib/server/recommendations/outcomeRetry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'CRON_AUTH_REQUIRED' }, { status: 401 });
  if (process.env.RECOMMENDATIONS_FOUNDATION_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, skipped: 'RECOMMENDATIONS_DISABLED' });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'STORAGE_REQUIRED' }, { status: 503 });
  try {
    const result = await processSupabaseRecommendationOutcomeRetries({ supabase });
    return NextResponse.json({ ok: result.exhausted === 0, ...result }, { status: result.exhausted > 0 ? 503 : 200 });
  } catch {
    return NextResponse.json({ ok: false, error: 'RECOMMENDATION_RETRY_FAILED' }, { status: 503 });
  }
}
