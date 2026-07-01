import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabase';

export type RequestAuth = {
  user: User | null;
  supabase: SupabaseClient | null;
  token: string | null;
};

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function getRequestAuth(request: Request): Promise<RequestAuth> {
  const token = bearerToken(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !anon) return { user: null, supabase: null, token };

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { user: null, supabase: null, token };
  return { user: data.user, supabase, token };
}

export async function requireUser(request: Request) {
  const auth = await getRequestAuth(request);
  if (!auth.user || !auth.supabase) throw new Error('AUTH_REQUIRED');
  return auth as Required<RequestAuth>;
}

export async function ensureProfile(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin.from('profiles').upsert({
    id: user.id,
    email: user.email ?? null,
    display_name: user.user_metadata?.display_name ?? user.email ?? 'Owner',
  });
}
