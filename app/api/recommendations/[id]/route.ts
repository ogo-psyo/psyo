import { NextResponse } from 'next/server';
import { parseLifecycleCommand } from '@/packages/recommendations/contracts';
import { createRecommendationService } from '@/lib/server/recommendations/repository';
import { createSupabaseRecommendationDomainAdapter, transitionForOwner } from '@/lib/server/recommendations/lifecycle';
import {
  disabledProblem,
  publicRecommendation,
  readRecommendationIdempotencyKey,
  recommendationProblem,
  recommendationRequestContext,
  recommendationRouteError,
  recommendationsEnabled,
} from '@/lib/server/recommendations/http';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  if (!recommendationsEnabled()) return disabledProblem();
  const auth = await recommendationRequestContext(request);
  if ('error' in auth) return auth.error;
  const idempotencyKey = readRecommendationIdempotencyKey(request);
  if (!idempotencyKey) {
    return recommendationProblem('IDEMPOTENCY_KEY_REQUIRED', 400, 'Request key required', 'Send a valid Idempotency-Key header.');
  }
  const parsed = parseLifecycleCommand(await request.json().catch(() => null));
  if (!parsed.ok) return recommendationProblem(parsed.error, 400, 'Command is invalid', 'Check the lifecycle command.');
  const { id } = await context.params;
  if (!id.trim()) return recommendationProblem('RECOMMENDATION_REQUIRED', 400, 'Recommendation required', 'Provide a recommendation id.');
  try {
    const service = createRecommendationService(auth.supabase);
    const result = await transitionForOwner({
      store: service.store,
      domain: createSupabaseRecommendationDomainAdapter(auth.supabase),
      ownerId: auth.ownerId,
      recommendationId: id,
      command: parsed.value,
      now: new Date(),
      idempotencyKey,
    });
    return NextResponse.json({
      recommendation: publicRecommendation(result.recommendation),
      correctionSource: result.correctionSource,
      synchronizedOutcome: result.synchronizedOutcome,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return recommendationRouteError(error);
  }
}
