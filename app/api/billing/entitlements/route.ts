import { NextResponse } from 'next/server';
import { freeEntitlementSnapshot, rc1Config } from '@/lib/rc1';
import { getRequestAuth } from '@/lib/server/auth';
import { defaultEntitlements, getUserEntitlements } from '@/lib/server/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const entitlements = auth.user ? await getUserEntitlements(auth.user.id, auth.supabase) : defaultEntitlements;

  return NextResponse.json({
    data: freeEntitlementSnapshot,
    entitlements,
    meta: {
      service: 'BillingService',
      billingEnabled: rc1Config.flags.billing_enabled,
      paywallEnabled: rc1Config.flags.plus_paywall_enabled,
      priceStars: rc1Config.priceStars,
      subscriptionPeriodSeconds: rc1Config.subscriptionPeriodSeconds,
      readiness: rc1Config.flags.billing_enabled ? 'partial' : 'blocked',
      blockedReason: rc1Config.flags.billing_enabled
        ? 'Telegram Stars webhook processing still requires payment smoke before broad release.'
        : 'Production billing is intentionally disabled until owner/legal release gates are approved.',
    },
  });
}
