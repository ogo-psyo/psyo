import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { principalsAgree } from '@/lib/socialCore';
import { problem } from '@/packages/contracts';
import type { Recommendation, RecommendationEvidence } from '@/packages/recommendations/contracts';
import type { EvaluationContext } from './policyRegistry';

export function recommendationsEnabled() {
  return process.env.RECOMMENDATIONS_FOUNDATION_ENABLED === 'true';
}

export function recommendationProblem(code: string, status: number, title: string, detail: string) {
  return NextResponse.json(problem(code, status, title, detail), {
    status,
    headers: { 'Content-Type': 'application/problem+json', 'Cache-Control': 'no-store' },
  });
}

export function disabledProblem() {
  return recommendationProblem('RECOMMENDATIONS_DISABLED', 404, 'Recommendations unavailable', 'This private foundation is not enabled.');
}

type RecommendationRequestContext =
  | { error: NextResponse }
  | { ownerId: string; supabase: SupabaseClient };

export async function recommendationRequestContext(request: Request): Promise<RecommendationRequestContext> {
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  if (!principalsAgree({ bearerOwnerId: auth.user?.id, sessionOwnerId: session?.ownerId })) {
    return { error: recommendationProblem('IDENTITY_PRINCIPAL_MISMATCH', 401, 'Authentication conflict', 'Open Псё again from Telegram.') };
  }
  const ownerId = auth.user?.id ?? session?.ownerId;
  if (!ownerId) {
    return { error: recommendationProblem('AUTH_REQUIRED', 401, 'Authentication required', 'Open Псё from Telegram.') };
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { error: recommendationProblem('STORAGE_UNAVAILABLE', 503, 'Storage unavailable', 'Recommendation storage is not configured.') };
  }
  return { ownerId, supabase };
}

export function readRecommendationIdempotencyKey(request: Request) {
  const value = request.headers.get('idempotency-key')?.trim() ?? '';
  return /^[A-Za-z0-9._:-]{8,128}$/.test(value) ? value : null;
}

function publicEvidence(item: RecommendationEvidence) {
  return {
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    capturedAt: item.capturedAt,
    observedAt: item.observedAt,
    dueAt: item.dueAt,
    updatedAt: item.updatedAt,
    ownerConfirmed: item.ownerConfirmed,
    inputConfidence: item.inputConfidence,
    excerpt: item.excerpt,
  };
}

export function publicRecommendation(item: Recommendation) {
  return {
    id: item.id,
    petId: item.petId,
    scenarioKey: item.scenarioKey,
    policyVersion: item.policyVersion,
    category: item.category,
    risk: item.risk,
    status: item.status,
    createdAt: item.createdAt,
    freshUntil: item.freshUntil,
    expiresAt: item.expiresAt,
    evidence: item.evidence.map(publicEvidence),
    missingData: item.missingData,
    conflicts: item.conflicts,
    suppressionReasons: item.suppressionReasons,
    confidence: item.confidence,
    rank: item.rank,
    title: item.title,
    whyNow: item.whyNow,
    limitation: item.limitation,
    primaryAction: item.primaryAction,
    fingerprint: item.fingerprint,
    shownAt: item.shownAt,
    resolvedAt: item.resolvedAt,
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function requiredText(value: unknown, limit = 160) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= limit ? normalized : null;
}

export function parseExplicitRequest(value: unknown): Omit<EvaluationContext, 'now'> | null {
  if (value === undefined) return {};
  const source = record(value);
  if (!source) return null;
  if (Object.keys(source).some((key) => !['explicitGoal', 'walk', 'thing'].includes(key))) return null;
  const result: Omit<EvaluationContext, 'now'> = {};
  if (source.explicitGoal !== undefined) {
    const goal = record(source.explicitGoal);
    const requestId = requiredText(goal?.requestId);
    const kind = requiredText(goal?.kind, 80);
    const title = requiredText(goal?.title, 120);
    const cadence = goal?.cadence;
    const targetPerPeriod = Number(goal?.targetPerPeriod);
    if (!requestId || !kind || !title || !['daily', 'weekly'].includes(String(cadence))
      || !Number.isInteger(targetPerPeriod) || targetPerPeriod < 1 || targetPerPeriod > 12) return null;
    result.explicitGoal = { requestId, kind, title, cadence: cadence as 'daily' | 'weekly', targetPerPeriod };
  }
  if (source.walk !== undefined) {
    const walk = record(source.walk);
    const requestId = requiredText(walk?.requestId);
    if (!requestId || walk?.mode !== 'explicit') return null;
    result.walk = { requestId, mode: 'explicit' };
  }
  if (source.thing !== undefined) {
    const thing = record(source.thing);
    const requestId = requiredText(thing?.requestId);
    const title = requiredText(thing?.title, 120);
    const category = requiredText(thing?.category, 80);
    const reason = requiredText(thing?.reason, 160);
    const reminderId = thing?.reminderId === undefined ? undefined : requiredText(thing.reminderId);
    if (!requestId || !title || !category || !reason || thing?.reminderId !== undefined && !reminderId) return null;
    result.thing = { requestId, title, category, reason, ...(reminderId ? { reminderId } : {}) };
  }
  return result;
}

export function recommendationRouteError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('IDEMPOTENCY_KEY_REUSED')) {
    return recommendationProblem('IDEMPOTENCY_KEY_REUSED', 409, 'Request key reused', 'Use a new key for a different mutation.');
  }
  if (['PET_NOT_FOUND', 'RECOMMENDATION_NOT_FOUND', 'DOMAIN_TARGET_NOT_FOUND'].some((code) => message.includes(code))) {
    return recommendationProblem('RECOMMENDATION_NOT_FOUND', 404, 'Recommendation not found', 'The dog or recommendation is unavailable.');
  }
  if (['INVALID_', 'DOMAIN_ACTION_MISMATCH', 'SAFETY_OVERRIDE_PREFERENCE_FORBIDDEN'].some((code) => message.includes(code))) {
    return recommendationProblem('VALIDATION_FAILED', 400, 'Request is invalid', 'Check the recommendation command.');
  }
  return recommendationProblem('STORAGE_UNAVAILABLE', 503, 'Storage unavailable', 'Could not access recommendation storage.');
}
