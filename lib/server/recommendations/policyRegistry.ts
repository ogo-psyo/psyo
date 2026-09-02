import { PHASE_ZERO_POLICIES, type EvaluationContext, type RecommendationPolicy } from './policies';
import type { RecommendationContextSnapshot } from './contextSnapshot';

export function listActivePolicies(): readonly RecommendationPolicy[] {
  return PHASE_ZERO_POLICIES;
}

export function getPolicy(key: string, version?: string): RecommendationPolicy | undefined {
  return PHASE_ZERO_POLICIES.find((policy) => policy.key === key && (!version || policy.version === version));
}

export function buildCandidates(snapshot: RecommendationContextSnapshot, context: EvaluationContext) {
  return PHASE_ZERO_POLICIES.flatMap((policy) => policy.generate(snapshot, context));
}

export type { EvaluationContext, RecommendationPolicy } from './policies';
