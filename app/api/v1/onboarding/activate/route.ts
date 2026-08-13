import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { createPet } from '@/lib/server/onboardingService';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { problem, validateCreatePetInput } from '@/packages/contracts';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const appSession = getAppSessionFromRequest(request);
  const auth = await getRequestAuth(request);
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!ownerId) {
    const payload = problem('AUTH_REQUIRED', 401, 'Authentication is required', 'A verified Telegram app session is required to activate onboarding.');
    return NextResponse.json(payload, { status: payload.status });
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim() ?? '';
  const body = await request.json().catch(() => null);
  const parsed = validateCreatePetInput({
    ...(body && typeof body === 'object' ? body as Record<string, unknown> : {}),
    idempotencyKey,
  });
  if (!parsed.ok) return NextResponse.json(parsed.error, { status: parsed.error.status });

  // The activation RPC is intentionally service-role only. ownerId is derived
  // from verified server auth/session state and never accepted from the body.
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const payload = problem('SUPABASE_NOT_CONFIGURED', 503, 'Profile storage is unavailable', 'Onboarding activation requires configured owner-scoped storage.');
    return NextResponse.json(payload, { status: payload.status });
  }

  try {
    const result = await createPet({
      supabase,
      ownerId,
      name: parsed.input.name,
      idempotencyKey: parsed.input.idempotencyKey,
    });
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
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
          'Dog could not be added',
          conflictCode === 'IDEMPOTENCY_KEY_REUSED'
            ? 'This idempotency key was already used for a different dog.'
            : 'This owner already has a dog. Load the existing private profile instead of creating another first dog.',
          { reason: conflictCode },
        )
      : problem(
          'ONBOARDING_ACTIVATION_FAILED',
          500,
          'Dog could not be added',
          'The dog was not saved. Retry with the same idempotency key.',
        );
    return NextResponse.json(payload, { status: payload.status });
  }
}
