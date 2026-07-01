import { NextResponse } from 'next/server';
import { rc1Config } from '@/lib/rc1';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'psyo-bff',
    environment: process.env.APP_ENV || process.env.VERCEL_ENV || 'development',
    release: process.env.RELEASE_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_URL || null,
    checks: {
      appUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      telegramBot: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      telegramWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseServerKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
      sessionSecret: Boolean(process.env.PSYO_SESSION_SIGNING_KEY || process.env.SESSION_SECRET || process.env.PSYO_ID_PEPPER),
      betterAuthReady: Boolean((process.env.BETTER_AUTH_DATABASE_URL || process.env.DATABASE_URL) && process.env.BETTER_AUTH_SECRET && process.env.TELEGRAM_BOT_TOKEN),
    },
    flags: rc1Config.flags,
  });
}
