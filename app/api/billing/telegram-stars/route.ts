import { NextResponse } from 'next/server';
import { rc1Config } from '@/lib/rc1';
import { buildPsyoUserId } from '@/lib/server/telegram';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TelegramStarsPayload = {
  telegram_payment_charge_id?: string;
  user_id?: number | string;
  subscription_period?: 'monthly' | 'yearly';
};

function isAuthorizedWebhook(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.APP_ENV === 'production';
  if (!expectedSecret) return !isProduction;
  return request.headers.get('x-telegram-bot-api-secret-token') === expectedSecret;
}

function subscriptionExpiresAt(period: TelegramStarsPayload['subscription_period']) {
  const expiresAt = new Date();
  if (period === 'yearly') {
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 1);
  }
  return expiresAt.toISOString();
}

export async function POST(request: Request) {
  if (!isAuthorizedWebhook(request)) {
    return NextResponse.json({ error: 'UNAUTHORIZED_WEBHOOK' }, { status: 401 });
  }

  if (!rc1Config.flags.billing_enabled) {
    return NextResponse.json({ error: 'BILLING_DISABLED' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'SUPABASE_NOT_CONFIGURED' }, { status: 503 });
  }

  try {
    const payload = (await request.json()) as TelegramStarsPayload;
    const telegramChargeId = String(payload.telegram_payment_charge_id || '').trim();
    const telegramUserId = String(payload.user_id || '').trim();

    if (!telegramChargeId || !telegramUserId) {
      return NextResponse.json({ error: 'INVALID_PAYMENT_PAYLOAD' }, { status: 400 });
    }

    const psyoUserId = buildPsyoUserId(telegramUserId);
    const { data: identity, error: identityError } = await supabase
      .from('telegram_identities')
      .select('owner_id')
      .eq('psyo_user_id', psyoUserId)
      .maybeSingle();

    if (identityError) {
      return NextResponse.json({ error: 'IDENTITY_LOOKUP_FAILED' }, { status: 500 });
    }

    if (!identity?.owner_id) {
      return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const { error } = await supabase.from('subscriptions').upsert({
      user_id: identity.owner_id,
      tier: 'plus',
      status: 'active',
      provider: 'telegram_stars',
      provider_charge_id: telegramChargeId,
      expires_at: subscriptionExpiresAt(payload.subscription_period),
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

    if (error) {
      return NextResponse.json({ error: 'SUBSCRIPTION_UPSERT_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'WEBHOOK_FAILED' }, { status: 500 });
  }
}
