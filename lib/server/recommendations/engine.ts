import { createHash } from 'node:crypto';
import type {
  Recommendation,
  RecommendationCandidate,
  RecommendationCategory,
  RecommendationDecision,
  RecommendationStatus,
  SuppressionReason,
} from '@/packages/recommendations/contracts';
import { getPolicy } from './policyRegistry';

export const GATE_ORDER = Object.freeze([
  'ownership', 'required_evidence', 'freshness', 'owner_confirmation',
  'conflict', 'action_available', 'preference', 'dedup', 'cooldown',
] as const);

export type PersistedRecommendationState = {
  id: string;
  fingerprint: string;
  scenarioKey: string;
  subjectId: string;
  status: RecommendationStatus;
  createdAt?: string;
  shownAt?: string;
  resolvedAt?: string;
  snoozedUntil?: string;
  dismissReason?: string;
};

export type RecommendationPreference = { category: RecommendationCategory; enabled: boolean };

type EvaluationInput = {
  petId: string;
  now: Date;
  candidates: RecommendationCandidate[];
  existing?: PersistedRecommendationState[];
  preferences?: RecommendationPreference[];
  availableActionIntents?: string[];
};

const activeStatuses = new Set<RecommendationStatus>(['candidate', 'eligible', 'shown', 'accepted', 'snoozed']);
const allActionIntents = ['open_reminder', 'open_health', 'open_habits', 'plan_walk', 'add_wishlist'];
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function normalizeReason(value: string) {
  return value.normalize('NFKC').trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stableValue(item)]));
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export function recommendationFingerprint(candidate: RecommendationCandidate) {
  const identity = {
    petId: candidate.petId,
    scenarioKey: candidate.scenarioKey,
    subjectId: candidate.subjectId,
    normalizedReason: normalizeReason(candidate.normalizedReason),
    policyVersion: candidate.policyVersion,
  };
  return createHash('sha256').update(stableJson(identity)).digest('hex');
}

function time(value?: string) {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

function within(timestamp: string | undefined, now: number, duration: number) {
  const parsed = time(timestamp);
  return Number.isFinite(parsed) && parsed <= now && parsed + duration > now;
}

function onCooldown(candidate: RecommendationCandidate, fingerprint: string, history: PersistedRecommendationState[], now: number) {
  const related = history.filter((item) => item.fingerprint === fingerprint
    || (item.scenarioKey === candidate.scenarioKey && item.subjectId === candidate.subjectId));
  if (related.some((item) => Number.isFinite(time(item.snoozedUntil)) && time(item.snoozedUntil) > now)) return true;

  if (candidate.scenarioKey === 'care_due') {
    return related.some((item) => within(item.shownAt ?? item.resolvedAt, now, DAY));
  }
  if (candidate.scenarioKey === 'wellbeing_change') {
    return related.some((item) => item.fingerprint === fingerprint && !['candidate', 'eligible', 'expired', 'superseded'].includes(item.status));
  }
  if (candidate.scenarioKey === 'habit_explicit_goal') {
    return related.some((item) => item.status === 'dismissed' && within(item.resolvedAt, now, 30 * DAY));
  }
  if (candidate.scenarioKey === 'walk_with_constraints') {
    return related.some((item) => within(item.shownAt ?? item.resolvedAt, now, 12 * HOUR));
  }
  if (candidate.scenarioKey === 'thing_for_task') {
    return related.some((item) => item.status === 'completed'
      || (item.status === 'dismissed' && within(item.resolvedAt, now, 30 * DAY))
      || (item.status === 'snoozed' && within(item.resolvedAt, now, 7 * DAY)));
  }
  return false;
}

function firstSuppression(input: {
  candidate: RecommendationCandidate;
  fingerprint: string;
  petId: string;
  now: number;
  history: PersistedRecommendationState[];
  preferences: RecommendationPreference[];
  availableActions: Set<string>;
  duplicate: boolean;
}): SuppressionReason | null {
  const { candidate } = input;
  const policy = getPolicy(candidate.scenarioKey, candidate.policyVersion);
  if (candidate.petId !== input.petId) return 'conflict';
  if (!policy || Object.values(candidate.confidence).includes('insufficient')) return 'missing_evidence';
  const evidenceTypes = new Set(candidate.evidence.map((item) => item.sourceType));
  const hasRequiredEvidence = policy.requiredEvidence.some((alternative) => alternative.every((source) => evidenceTypes.has(source)));
  if (!hasRequiredEvidence) return 'missing_evidence';
  const freshUntil = time(candidate.freshUntil);
  const expiresAt = time(candidate.expiresAt);
  if (!Number.isFinite(freshUntil) || !Number.isFinite(expiresAt) || freshUntil <= input.now || expiresAt <= input.now) {
    return 'stale_evidence';
  }
  if (candidate.evidence.some((item) => !item.ownerConfirmed)) return 'owner_unconfirmed';
  if (candidate.conflicts.length > 0) return 'conflict';
  if (!policy.allowedActionIntents.includes(candidate.primaryAction.intent) || !input.availableActions.has(candidate.primaryAction.intent)) {
    return 'action_unavailable';
  }
  if (candidate.risk !== 'safety_override'
    && input.preferences.some((preference) => preference.category === candidate.category && !preference.enabled)) {
    return 'category_disabled';
  }
  if (input.duplicate) return 'duplicate';
  if (onCooldown(candidate, input.fingerprint, input.history, input.now)) return 'cooldown';
  return null;
}

function toRecommendation(
  candidate: RecommendationCandidate,
  fingerprint: string,
  now: Date,
  existing?: PersistedRecommendationState,
): Recommendation {
  const { subjectId: _subjectId, normalizedReason: _normalizedReason, ...recommendation } = candidate;
  return {
    ...recommendation,
    id: existing?.id ?? fingerprint,
    status: 'eligible',
    createdAt: existing?.createdAt ?? now.toISOString(),
    fingerprint,
  };
}

function dueTime(recommendation: Recommendation) {
  const values = recommendation.evidence.map((item) => time(item.dueAt)).filter(Number.isFinite);
  return values.length ? Math.min(...values) : Number.POSITIVE_INFINITY;
}

function signalTime(recommendation: Recommendation) {
  const values = recommendation.evidence.map((item) => time(item.observedAt)).filter(Number.isFinite);
  return values.length ? Math.max(...values) : Number.NEGATIVE_INFINITY;
}

function rank(left: Recommendation, right: Recommendation) {
  const safety = Number(right.risk === 'safety_override') - Number(left.risk === 'safety_override');
  if (safety) return safety;
  return left.rank.tier - right.rank.tier
    || right.rank.urgency - left.rank.urgency
    || right.rank.actionability - left.rank.actionability
    || right.rank.relevance - left.rank.relevance
    || left.rank.annoyancePenalty - right.rank.annoyancePenalty
    || dueTime(left) - dueTime(right)
    || signalTime(right) - signalTime(left)
    || left.id.localeCompare(right.id);
}

export function evaluateRecommendations(input: EvaluationInput): RecommendationDecision[] {
  const now = input.now.getTime();
  const history = input.existing ?? [];
  const preferences = input.preferences ?? [];
  const availableActions = new Set(input.availableActionIntents ?? allActionIntents);
  const envelopes = input.candidates.map((candidate) => ({
    candidate,
    fingerprint: recommendationFingerprint(candidate),
    canonical: stableJson(candidate),
  })).sort((left, right) => left.fingerprint.localeCompare(right.fingerprint) || left.canonical.localeCompare(right.canonical));
  const seen = new Set<string>();

  const decisions = envelopes.map(({ candidate, fingerprint }) => {
    const suppression = firstSuppression({
      candidate, fingerprint, petId: input.petId, now, history, preferences, availableActions,
      duplicate: seen.has(fingerprint),
    });
    seen.add(fingerprint);
    if (suppression) {
      const suppressedCandidate = { ...candidate, suppressionReasons: [suppression] };
      return { status: 'suppressed', candidate: suppressedCandidate, reasons: [suppression] } satisfies RecommendationDecision;
    }
    const existing = history.find((item) => item.fingerprint === fingerprint && activeStatuses.has(item.status));
    return {
      status: 'eligible', recommendation: toRecommendation(candidate, fingerprint, input.now, existing),
    } satisfies RecommendationDecision;
  });

  return decisions.sort((left, right) => {
    if (left.status === 'eligible' && right.status === 'eligible') return rank(left.recommendation, right.recommendation);
    if (left.status === 'eligible') return -1;
    if (right.status === 'eligible') return 1;
    const leftFingerprint = recommendationFingerprint(left.candidate);
    const rightFingerprint = recommendationFingerprint(right.candidate);
    return leftFingerprint.localeCompare(rightFingerprint)
      || left.reasons[0]!.localeCompare(right.reasons[0]!);
  });
}

export function selectMainRecommendation(decisions: RecommendationDecision[]): Recommendation | null {
  const eligible = decisions.flatMap((decision) => decision.status === 'eligible' ? [decision.recommendation] : []);
  return eligible.sort(rank)[0] ?? null;
}
