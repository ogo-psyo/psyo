import { NextResponse } from 'next/server';
import { createRecommendationService } from '@/lib/server/recommendations/repository';
import {
  createSupabaseRecommendationDomainAdapter,
  recordOutcomeForOwner,
  type RecommendationOutcome,
} from '@/lib/server/recommendations/lifecycle';
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

function parseOutcome(value: unknown, recommendationId: string): RecommendationOutcome | null {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const domainType = source.domainType;
  const domainId = typeof source.domainId === 'string' ? source.domainId.trim() : '';
  const result = source.result;
  const occurredAt = typeof source.occurredAt === 'string' && Number.isFinite(Date.parse(source.occurredAt))
    ? new Date(source.occurredAt).toISOString()
    : '';
  if (!['reminder', 'habit', 'route', 'wishlist', 'social_request', 'social_signal'].includes(String(domainType))
    || !domainId || !['completed', 'failed'].includes(String(result)) || !occurredAt) return null;
  return {
    recommendationId,
    domainType: domainType as RecommendationOutcome['domainType'],
    domainId,
    result: result as RecommendationOutcome['result'],
    occurredAt,
  };
}

export async function POST(request: Request, context: Context) {
  if (!recommendationsEnabled()) return disabledProblem();
  const auth = await recommendationRequestContext(request);
  if ('error' in auth) return auth.error;
  const idempotencyKey = readRecommendationIdempotencyKey(request);
  if (!idempotencyKey) {
    return recommendationProblem('IDEMPOTENCY_KEY_REQUIRED', 400, 'Request key required', 'Send a valid Idempotency-Key header.');
  }
  const { id } = await context.params;
  const outcome = parseOutcome(await request.json().catch(() => null), id);
  if (!outcome) return recommendationProblem('INVALID_RECOMMENDATION_OUTCOME', 400, 'Outcome is invalid', 'Check the domain result.');
  try {
    const service = createRecommendationService(auth.supabase);
    const recommendation = await recordOutcomeForOwner({
      store: service.store,
      domain: createSupabaseRecommendationDomainAdapter(auth.supabase),
      ownerId: auth.ownerId,
      outcome,
      now: new Date(),
      idempotencyKey,
    });
    return NextResponse.json({ recommendation: publicRecommendation(recommendation) }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return recommendationRouteError(error);
  }
}
