import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramIdentityRow = {
  psyo_user_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

function isAdminRequest(request: Request) {
  const expected = process.env.PSYO_ADMIN_TOKEN;
  if (!expected) return { ok: false, status: 503, error: 'ADMIN_NOT_CONFIGURED' };
  const actual = request.headers.get('x-psyo-admin-token') || '';
  if (actual !== expected) return { ok: false, status: 401, error: 'ADMIN_AUTH_REQUIRED' };
  return { ok: true as const };
}

export async function GET(request: Request) {
  const admin = isAdminRequest(request);
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const supabase = getSupabaseAdmin();
  if (!supabase) return NextResponse.json({ error: 'SUPABASE_ADMIN_NOT_CONFIGURED' }, { status: 503 });

  const { data: identities, error } = await supabase
    .from('telegram_identities')
    .select('psyo_user_id, owner_id, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'TELEGRAM_IDENTITIES_READ_FAILED', detail: error.message }, { status: 500 });

  const rows = (identities ?? []) as TelegramIdentityRow[];
  const ownerIds = rows.map((row) => row.owner_id);

  const [{ data: profiles }, { data: subscriptions }, { data: pets }] = await Promise.all([
    ownerIds.length
      ? supabase.from('profiles').select('id, email, display_name, created_at, updated_at').in('id', ownerIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length
      ? supabase.from('subscriptions').select('user_id, tier, status, expires_at, provider, updated_at').in('user_id', ownerIds)
      : Promise.resolve({ data: [] }),
    ownerIds.length
      ? supabase.from('pets').select('id, owner_id, name, created_at').in('owner_id', ownerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileByOwner = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));
  const subscriptionByOwner = new Map((subscriptions ?? []).map((subscription: any) => [subscription.user_id, subscription]));
  const petsByOwner = new Map<string, any[]>();
  for (const pet of pets ?? []) {
    const bucket = petsByOwner.get((pet as any).owner_id) ?? [];
    bucket.push(pet);
    petsByOwner.set((pet as any).owner_id, bucket);
  }

  return NextResponse.json({
    owners: rows.map((row) => ({
      psyoUserId: row.psyo_user_id,
      ownerId: row.owner_id,
      profile: profileByOwner.get(row.owner_id) ?? null,
      subscription: subscriptionByOwner.get(row.owner_id) ?? null,
      pets: petsByOwner.get(row.owner_id) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    meta: {
      authModel: 'telegram_init_data_to_http_only_app_session',
      managedBy: 'PSYO_ADMIN_TOKEN',
      limit: 100,
    },
  });
}
