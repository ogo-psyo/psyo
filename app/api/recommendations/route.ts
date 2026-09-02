import { NextResponse } from 'next/server';
import { createRecommendationService } from '@/lib/server/recommendations/repository';
import {
  disabledProblem,
  parseExplicitRequest,
  publicRecommendation,
  recommendationProblem,
  recommendationRequestContext,
  recommendationRouteError,
  recommendationsEnabled,
} from '@/lib/server/recommendations/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: Record<string, unknown>) {
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  if (!recommendationsEnabled()) return disabledProblem();
  const context = await recommendationRequestContext(request);
  if ('error' in context) return context.error;
  const petId = new URL(request.url).searchParams.get('petId')?.trim() ?? '';
  if (!petId) return recommendationProblem('PET_REQUIRED', 400, 'Dog required', 'Choose a dog.');
  try {
    const service = createRecommendationService(context.supabase);
    const recommendations = await service.listForPet({ ownerId: context.ownerId, petId });
    return json({ recommendations: recommendations.map(publicRecommendation) });
  } catch (error) {
    return recommendationRouteError(error);
  }
}

export async function POST(request: Request) {
  if (!recommendationsEnabled()) return disabledProblem();
  const context = await recommendationRequestContext(request);
  if ('error' in context) return context.error;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const petId = typeof body?.petId === 'string' ? body.petId.trim() : '';
  const explicitRequest = parseExplicitRequest(body?.explicitRequest);
  if (!petId || !body || explicitRequest === null) {
    return recommendationProblem('VALIDATION_FAILED', 400, 'Request is invalid', 'Provide a dog and a valid explicit request.');
  }
  try {
    const service = createRecommendationService(context.supabase);
    const result = await service.recalculateForPet({
      ownerId: context.ownerId,
      petId,
      now: new Date(),
      explicitRequest,
    });
    return json({
      main: result.main ? publicRecommendation(result.main) : null,
      secondary: result.secondary.map(publicRecommendation),
      evaluatedAt: result.evaluatedAt,
    });
  } catch (error) {
    return recommendationRouteError(error);
  }
}
