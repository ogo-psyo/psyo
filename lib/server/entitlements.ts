import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entitlements, PlanTier } from '@/packages/contracts';
import { getSupabaseAdmin } from './supabase';

export const defaultEntitlements: Entitlements = {
  tier: 'free',
  maxPets: 1,
  aiActionsPerDay: 5,
  advancedAnalytics: false,
  expiresAt: null,
};

export const plusEntitlementLimits: Omit<Entitlements, 'tier' | 'expiresAt'> = {
  maxPets: 5,
  aiActionsPerDay: 1000,
  advancedAnalytics: true,
};

type SubscriptionRow = {
  tier: PlanTier | string | null;
  expires_at: string | null;
  status: string | null;
};

function isExpired(expiresAt: string | null) {
  return Boolean(expiresAt && new Date(expiresAt) < new Date());
}

function mapSubscriptionToEntitlements(subscription: SubscriptionRow | null): Entitlements {
  if (!subscription || subscription.status !== 'active' || isExpired(subscription.expires_at)) {
    return defaultEntitlements;
  }

  if (subscription.tier === 'plus') {
    return {
      tier: 'plus',
      ...plusEntitlementLimits,
      expiresAt: subscription.expires_at,
    };
  }

  return defaultEntitlements;
}

export async function getUserEntitlements(userId: string, client: SupabaseClient | null = getSupabaseAdmin()): Promise<Entitlements> {
  if (!client) return defaultEntitlements;

  const { data, error } = await client
    .from('subscriptions')
    .select('tier, expires_at, status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('expires_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) return defaultEntitlements;
  return mapSubscriptionToEntitlements(data as SubscriptionRow | null);
}

export async function requirePlusTier(request: Request, client: SupabaseClient | null = getSupabaseAdmin()): Promise<boolean> {
  if (!client) return false;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return false;

  const { data } = await client.auth.getUser(token);
  if (!data.user) return false;

  const entitlements = await getUserEntitlements(data.user.id, client);
  return entitlements.tier === 'plus';
}
