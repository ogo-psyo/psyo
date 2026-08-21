import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'CRON_AUTH_REQUIRED' }, { status: 401 });
  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'STORAGE_REQUIRED' }, { status: 503 });

  const now = new Date().toISOString();
  let objectsDeleted = 0;
  let rowsDeleted = 0;
  let scanned = 0;
  const failures: string[] = [];
  for (let batch = 0; batch < 10; batch += 1) {
    const expired = await supabase.from('avatar_assets')
      .select('id,storage_bucket,storage_path')
      .lt('retention_until', now)
      .is('deleted_at', null)
      .neq('status', 'active')
      .limit(100);
    if (expired.error) return NextResponse.json({ error: 'RETENTION_READ_FAILED' }, { status: 500 });
    if (!expired.data?.length) break;
    scanned += expired.data.length;
    let batchProgress = 0;
    for (const asset of expired.data) {
      if (asset.storage_bucket && asset.storage_path) {
        const removed = await supabase.storage.from(asset.storage_bucket).remove([asset.storage_path]);
        if (removed.error) {
          failures.push(asset.id);
          continue; // keep the row eligible so the next cron run retries it
        }
        objectsDeleted += 1;
      }
      const tombstoned = await supabase.from('avatar_assets').update({
        deleted_at: now,
        status: 'archived',
        storage_path: null,
        public_url: null,
      }).eq('id', asset.id).is('deleted_at', null);
      if (tombstoned.error) failures.push(asset.id);
      else { rowsDeleted += 1; batchProgress += 1; }
    }
    if (batchProgress === 0 || expired.data.length < 100) break;
  }

  const jobs = await supabase.from('avatar_jobs')
    .delete()
    .lt('retention_until', now);
  if (jobs.error) failures.push('avatar_jobs');
  const reservations = await supabase.from('avatar_upload_reservations')
    .delete()
    .lt('claimed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (reservations.error) failures.push('avatar_upload_reservations');

  const backlog = await supabase.from('avatar_assets')
    .select('id', { count: 'exact', head: true })
    .lt('retention_until', now).is('deleted_at', null).neq('status', 'active');
  if (backlog.error) failures.push('avatar_backlog');

  const unhealthy = failures.length > 0 || (backlog.count ?? 0) > 0;
  return NextResponse.json({
    ok: !unhealthy,
    scanned,
    objectsDeleted,
    rowsDeleted,
    backlogRemaining: backlog.count ?? null,
    retryCount: failures.length,
  }, { status: unhealthy ? 503 : 200 });
}
