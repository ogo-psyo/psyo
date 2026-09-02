export type RecommendationCategory = 'care' | 'wellbeing' | 'habit' | 'walk' | 'thing' | 'social';

export type RecommendationRisk = 'routine' | 'caution' | 'safety_override';

export type RecommendationStatus =
  | 'candidate'
  | 'eligible'
  | 'suppressed'
  | 'shown'
  | 'accepted'
  | 'snoozed'
  | 'dismissed'
  | 'completed'
  | 'expired'
  | 'superseded'
  | 'failed';

export type RecommendationSourceType =
  | 'profile'
  | 'passport'
  | 'reminder'
  | 'observation'
  | 'habit'
  | 'map_zone'
  | 'route'
  | 'wishlist'
  | 'social_signal'
  | 'social_request'
  | 'explicit_request';

export type ConfidenceLevel = 'high' | 'medium' | 'insufficient';

export type SuppressionReason =
  | 'missing_evidence'
  | 'stale_evidence'
  | 'owner_unconfirmed'
  | 'category_disabled'
  | 'duplicate'
  | 'cooldown'
  | 'conflict'
  | 'action_unavailable'
  | 'safety_pack_unavailable';

export type DismissReason = 'not_relevant' | 'already_done' | 'wrong_data' | 'never_suggest';

export type RecommendationAction =
  | { intent: 'open_reminder'; reminderId: string }
  | { intent: 'open_health'; observationId?: string }
  | {
      intent: 'open_habits';
      draft?: {
        kind: string;
        title: string;
        cadence: 'daily' | 'weekly';
        targetPerPeriod: number;
      };
    }
  | { intent: 'plan_walk'; zoneIds: string[]; limitation: 'route_not_verified_safe' }
  | {
      intent: 'add_wishlist';
      draft: { title: string; category: string; reason: string };
    }
  | { intent: 'open_gav'; view: 'live_signal'; signalId: string }
  | { intent: 'open_gav'; view: 'requests'; requestId: string }
  | { intent: 'open_gav'; view: 'give_signal' };

export type RecommendationEvidence = {
  sourceType: RecommendationSourceType;
  sourceId: string;
  capturedAt: string;
  observedAt?: string;
  dueAt?: string;
  updatedAt?: string;
  ownerConfirmed: boolean;
  inputConfidence?: number;
  excerpt?: string;
};

export type RecommendationConfidence = {
  dataSufficiency: ConfidenceLevel;
  sourceReliability: ConfidenceLevel;
  ruleCertainty: ConfidenceLevel;
};

export type RecommendationRank = {
  tier: number;
  urgency: number;
  actionability: number;
  relevance: number;
  annoyancePenalty: number;
};

export type Recommendation = {
  id: string;
  petId: string;
  scenarioKey: string;
  policyVersion: string;
  category: RecommendationCategory;
  risk: RecommendationRisk;
  status: RecommendationStatus;
  createdAt: string;
  freshUntil: string;
  expiresAt: string;
  evidence: RecommendationEvidence[];
  missingData: string[];
  conflicts: string[];
  suppressionReasons: SuppressionReason[];
  confidence: RecommendationConfidence;
  rank: RecommendationRank;
  title: string;
  whyNow: string[];
  limitation?: string;
  primaryAction: RecommendationAction;
  fingerprint: string;
  shownAt?: string;
  resolvedAt?: string;
};

export type RecommendationCandidate = Omit<
  Recommendation,
  'id' | 'status' | 'createdAt' | 'fingerprint' | 'shownAt' | 'resolvedAt'
> & {
  subjectId: string;
  normalizedReason: string;
};

export type RecommendationContextSnapshot = {
  petId: string;
  capturedAt: string;
  facts: RecommendationEvidence[];
};

export type RecommendationDecision =
  | { status: 'eligible'; recommendation: Recommendation }
  | {
      status: 'suppressed';
      candidate: RecommendationCandidate;
      reasons: SuppressionReason[];
    };

export type RecommendationLifecycleCommand =
  | { action: 'show' }
  | { action: 'accept' }
  | { action: 'snooze'; until: string }
  | { action: 'dismiss'; reason: DismissReason };

export type RecommendationValidation = { ok: true } | { ok: false; error: string };

const dismissReasons = new Set<DismissReason>([
  'not_relevant',
  'already_done',
  'wrong_data',
  'never_suggest',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIsoDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function parseLifecycleCommand(
  input: unknown,
): { ok: true; value: RecommendationLifecycleCommand } | { ok: false; error: string } {
  if (!isRecord(input)) return { ok: false, error: 'INVALID_LIFECYCLE_COMMAND' };

  if (input.action === 'show' || input.action === 'accept') {
    return { ok: true, value: { action: input.action } };
  }

  if (input.action === 'snooze') {
    const until = normalizeIsoDate(input.until);
    return until
      ? { ok: true, value: { action: 'snooze', until } }
      : { ok: false, error: 'INVALID_SNOOZE_UNTIL' };
  }

  if (input.action === 'dismiss' && dismissReasons.has(input.reason as DismissReason)) {
    return { ok: true, value: { action: 'dismiss', reason: input.reason as DismissReason } };
  }

  return { ok: false, error: 'INVALID_LIFECYCLE_COMMAND' };
}

function isRecommendationAction(action: RecommendationAction) {
  if (!isRecord(action) || typeof action.intent !== 'string') return false;
  if (action.intent === 'open_reminder') return typeof action.reminderId === 'string' && Boolean(action.reminderId.trim());
  if (action.intent === 'open_health') return action.observationId === undefined || typeof action.observationId === 'string';
  if (action.intent === 'plan_walk') {
    return Array.isArray(action.zoneIds)
      && action.zoneIds.every((id) => typeof id === 'string')
      && action.limitation === 'route_not_verified_safe';
  }
  if (action.intent === 'open_habits') {
    if (action.draft === undefined) return true;
    return isRecord(action.draft)
      && typeof action.draft.kind === 'string'
      && typeof action.draft.title === 'string'
      && (action.draft.cadence === 'daily' || action.draft.cadence === 'weekly')
      && Number.isInteger(action.draft.targetPerPeriod)
      && Number(action.draft.targetPerPeriod) > 0;
  }
  if (action.intent === 'add_wishlist') {
    return isRecord(action.draft)
      && typeof action.draft.title === 'string'
      && typeof action.draft.category === 'string'
      && typeof action.draft.reason === 'string'
      && Boolean(action.draft.reason.trim());
  }
  if (action.intent === 'open_gav') {
    if (action.view === 'give_signal') return true;
    if (action.view === 'live_signal') return typeof action.signalId === 'string' && Boolean(action.signalId.trim());
    if (action.view === 'requests') return typeof action.requestId === 'string' && Boolean(action.requestId.trim());
  }
  return false;
}

export function validateRecommendation(recommendation: Recommendation): RecommendationValidation {
  if (!Array.isArray(recommendation.whyNow) || recommendation.whyNow.length === 0) {
    return { ok: false, error: 'WHY_NOW_REQUIRED' };
  }
  if (recommendation.whyNow.length > 2) {
    return { ok: false, error: 'WHY_NOW_LIMIT_EXCEEDED' };
  }
  if (recommendation.whyNow.some((line) => typeof line !== 'string' || line.length > 160)) {
    return { ok: false, error: 'WHY_NOW_COPY_INVALID' };
  }
  if (!Array.isArray(recommendation.evidence) || recommendation.evidence.length === 0) {
    return { ok: false, error: 'EVIDENCE_REQUIRED' };
  }
  if (recommendation.evidence.some((item) => item.excerpt && item.excerpt.length > 160)) {
    return { ok: false, error: 'EVIDENCE_EXCERPT_LIMIT_EXCEEDED' };
  }
  if (!isRecommendationAction(recommendation.primaryAction)) {
    return { ok: false, error: 'PRIMARY_ACTION_INVALID' };
  }
  if (!/^[a-f0-9]{64}$/.test(recommendation.fingerprint)) {
    return { ok: false, error: 'FINGERPRINT_INVALID' };
  }
  return { ok: true };
}
