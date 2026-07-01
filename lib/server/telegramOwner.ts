import { getSupabaseAdmin } from './supabase';

export type OwnerIdentity = { id: string; email?: string | null; user_metadata?: Record<string, unknown> };

function syntheticTelegramEmail(psyoUserId: string) {
  return `telegram-${psyoUserId}@auth.psyo.local`;
}

function isMissingTelegramIdentityTable(error: { code?: string; message?: string }) {
  return error.code === '42P01'
    || error.code === 'PGRST205'
    || /telegram_identities|schema cache|does not exist/i.test(error.message ?? '');
}

async function findAuthUserByEmail(email: string): Promise<OwnerIdentity | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');

  for (let page = 1; page <= 20; page += 1) {
    const listed = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (listed.error) throw listed.error;

    const user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (listed.data.users.length < 1000) return null;
  }

  return null;
}

async function ensureProfileRow(owner: OwnerIdentity) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');

  await supabase.from('profiles').upsert({
    id: owner.id,
    email: owner.email ?? null,
    display_name: owner.user_metadata?.display_name ?? 'Telegram owner',
  });
}

export async function ensureTelegramOwner(psyoUserId: string): Promise<OwnerIdentity> {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  const email = syntheticTelegramEmail(psyoUserId);

  const existing = await supabase
    .from('telegram_identities')
    .select('owner_id')
    .eq('psyo_user_id', psyoUserId)
    .maybeSingle();
  if (existing.error && !isMissingTelegramIdentityTable(existing.error)) throw existing.error;

  if (existing.data?.owner_id) {
    return { id: existing.data.owner_id, email: null, user_metadata: { provider: 'telegram' } };
  }

  const existingAuthUser = await findAuthUserByEmail(email);
  if (existingAuthUser) {
    await ensureProfileRow(existingAuthUser);
    return existingAuthUser;
  }

  const created = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { provider: 'telegram', psyo_user_id: psyoUserId },
  });
  if (created.error || !created.data.user) {
    const racedAuthUser = await findAuthUserByEmail(email);
    if (racedAuthUser) {
      await ensureProfileRow(racedAuthUser);
      return racedAuthUser;
    }
    throw created.error ?? new Error('TELEGRAM_OWNER_CREATE_FAILED');
  }

  const owner = created.data.user;
  const identity = await supabase.from('telegram_identities').insert({
    psyo_user_id: psyoUserId,
    owner_id: owner.id,
  });
  if (identity.error) {
    await ensureProfileRow(owner);
    return owner;
  }

  await ensureProfileRow(owner);

  return owner;
}
