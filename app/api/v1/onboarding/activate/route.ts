import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { activateFirstCareLoop } from '@/lib/server/onboardingService';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { problem, validateOnboardingActivationCommand } from '@/packages/contracts';

export const runtime = 'nodejs';

function validIdempotencyKey(value: string) {
  return /^[A-Za-z0-9._:-]{8,128}$/.test(value);
}

export async function POST(request: Request) {
  const appSession = getAppSessionFromRequest(request);
  const auth = await getRequestAuth(request);
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId) {
    const payload = problem('AUTH_REQUIRED', 401, 'Authentication is required', 'A verified Telegram app session is required to activate onboarding.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
  if (!validIdempotencyKey(idempotencyKey)) {
    const payload = problem('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency key is required', 'Send an Idempotency-Key header containing 8-128 safe characters.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const parsed = validateOnboardingActivationCommand(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json(parsed.error, { status: parsed.error.status });

  // The activation RPC is intentionally service-role only. ownerId is derived
  // from verified server auth/session state and never accepted from the body.
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const payload = problem('SUPABASE_NOT_CONFIGURED', 503, 'Profile storage is unavailable', 'Onboarding activation requires configured owner-scoped storage.');
    return NextResponse.json(payload, { status: payload.status });
  }

  try {
    const result = await activateFirstCareLoop({ supabase, ownerId, idempotencyKey, command: parsed.command });
    return NextResponse.json({
      service: 'ProfileService',
      mode: auth.user ? 'supabase-auth' : 'telegram',
      activation: result,
      restore: { href: `/api/app/bootstrap?petId=${encodeURIComponent(String(result.pet.id))}` },
      privacy: 'The pet and first reminder are private and owner-scoped by default.',
    }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    const internalMessage = error instanceof Error ? error.message : '';
    const conflictCode = internalMessage.includes('IDEMPOTENCY_KEY_REUSED')
      ? 'IDEMPOTENCY_KEY_REUSED'
      : internalMessage.includes('ONBOARDING_ALREADY_ACTIVATED')
        ? 'ONBOARDING_ALREADY_ACTIVATED'
        : null;
    const payload = conflictCode
      ? problem(
          'ONBOARDING_ACTIVATION_CONFLICT',
          409,
          'Onboarding is already activated',
          conflictCode === 'IDEMPOTENCY_KEY_REUSED'
            ? 'This idempotency key was already used for a different onboarding request.'
            : 'This owner already has a pet. Load the existing private profile instead of creating another first pet.',
          { reason: conflictCode },
        )
      : problem(
          'ONBOARDING_ACTIVATION_FAILED',
          500,
          'Onboarding could not be activated',
          'The first pet and reminder were not saved. Retry with the same idempotency key.',
        );
    return NextResponse.json(payload, { status: payload.status });
  }
}
