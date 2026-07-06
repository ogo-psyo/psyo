import { NextResponse } from 'next/server';
import { plusPlanSnapshot, rc1Config } from '@/lib/rc1';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { createTelegramStarsInvoiceLink } from '@/lib/server/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const ownerId = auth.user?.id ?? appSession?.ownerId;

  if (!ownerId) {
    return NextResponse.json({ error: 'AUTH_REQUIRED', plan: plusPlanSnapshot }, { status: 401 });
  }

  if (!rc1Config.flags.billing_enabled || !rc1Config.flags.new_invoices_enabled) {
    return NextResponse.json({
      error: 'BILLING_NOT_READY',
      plan: plusPlanSnapshot,
      meta: {
        billingEnabled: rc1Config.flags.billing_enabled,
        newInvoicesEnabled: rc1Config.flags.new_invoices_enabled,
        disabledReason: rc1Config.flags.billing_enabled
          ? 'New invoices are disabled until Telegram Stars payment smoke passes.'
          : 'Production billing is disabled until owner/legal release gates are approved.',
      },
    }, { status: 403 });
  }

  const invoice = await createTelegramStarsInvoiceLink({ ownerId, requestUrl: request.url });
  if (!invoice.ok) {
    return NextResponse.json({ error: invoice.error, detail: invoice.detail, plan: plusPlanSnapshot }, { status: invoice.status });
  }

  return NextResponse.json({
    plan: plusPlanSnapshot,
    invoiceLink: invoice.invoiceLink,
  });
}
