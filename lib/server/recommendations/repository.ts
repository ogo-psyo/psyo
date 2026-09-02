import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Recommendation,
  RecommendationCategory,
  RecommendationEvidence,
  RecommendationStatus,
} from '@/packages/recommendations/contracts';
import { loadRecommendationContext, type RecommendationContextSnapshot } from './contextSnapshot';
import { evaluateRecommendations, recommendationFingerprint, type PersistedRecommendationState } from './engine';
import { buildCandidates, type EvaluationContext } from './policyRegistry';

const ACTIVE_STATUSES = new Set<RecommendationStatus>(['candidate', 'eligible', 'shown', 'accepted', 'snoozed']);

export type StoredRecommendation = Recommendation & {
  ownerId: string;
  subjectId: string;
  snoozedUntil?: string;
};

export type PersistEvaluationInput = {
  ownerId: string;
  petId: string;
  evaluatedAt: string;
  supersedeIds: string[];
  upserts: Array<{ recommendation: Recommendation; subjectId: string }>;
};

export type StoreTransitionInput = {
  ownerId: string;
  recommendationId: string;
  action: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
  idempotencyKey?: string;
};

export interface RecommendationStore {
  assertOwnedPet(ownerId: string, petId: string): Promise<void>;
  listHistory(ownerId: string, petId: string): Promise<StoredRecommendation[]>;
  listPreferences(ownerId: string, petId: string): Promise<Array<{ category: RecommendationCategory; enabled: boolean }>>;
  persistEvaluation(input: PersistEvaluationInput): Promise<StoredRecommendation[]>;
  getForOwner(ownerId: string, recommendationId: string): Promise<StoredRecommendation | null>;
  transition(input: StoreTransitionInput): Promise<StoredRecommendation>;
  setPreference(ownerId: string, petId: string, category: RecommendationCategory, enabled: boolean): Promise<void>;
  deleteHistory(ownerId: string, petId: string): Promise<void>;
}

type RecalculateInput = {
  store: RecommendationStore;
  ownerId: string;
  petId: string;
  now: Date;
  explicitRequest?: Omit<EvaluationContext, 'now'>;
  loadContext: (input: { ownerId: string; petId: string; now: Date }) => Promise<RecommendationContextSnapshot>;
};

function persistedState(item: StoredRecommendation): PersistedRecommendationState {
  return {
    id: item.id,
    fingerprint: item.fingerprint,
    scenarioKey: item.scenarioKey,
    subjectId: item.subjectId,
    status: item.status,
    createdAt: item.createdAt,
    shownAt: item.shownAt,
    resolvedAt: item.resolvedAt,
    snoozedUntil: item.snoozedUntil,
  };
}

export async function recalculateForPet(input: RecalculateInput) {
  await input.store.assertOwnedPet(input.ownerId, input.petId);
  const [snapshot, history, preferences] = await Promise.all([
    input.loadContext({ ownerId: input.ownerId, petId: input.petId, now: input.now }),
    input.store.listHistory(input.ownerId, input.petId),
    input.store.listPreferences(input.ownerId, input.petId),
  ]);
  const candidates = buildCandidates(snapshot, { now: input.now, ...input.explicitRequest });
  const decisions = evaluateRecommendations({
    petId: input.petId,
    now: input.now,
    candidates,
    existing: history.map(persistedState),
    preferences,
  });
  const eligible = decisions.flatMap((decision) => decision.status === 'eligible' ? [decision.recommendation] : []);
  const subjectByFingerprint = new Map(candidates.map((candidate) => [recommendationFingerprint(candidate), candidate.subjectId]));
  const upserts = eligible.map((recommendation) => ({
    recommendation,
    subjectId: subjectByFingerprint.get(recommendation.fingerprint) ?? '',
  }));
  if (upserts.some((item) => !item.subjectId)) throw new Error('RECOMMENDATION_SUBJECT_MISSING');
  const replacements = new Set(upserts.map((item) => `${item.recommendation.scenarioKey}:${item.subjectId}`));
  const fingerprints = new Set(upserts.map((item) => item.recommendation.fingerprint));
  const supersedeIds = history.filter((item) => ACTIVE_STATUSES.has(item.status)
    && replacements.has(`${item.scenarioKey}:${item.subjectId}`)
    && !fingerprints.has(item.fingerprint)).map((item) => item.id);
  const persisted = await input.store.persistEvaluation({
    ownerId: input.ownerId,
    petId: input.petId,
    evaluatedAt: input.now.toISOString(),
    supersedeIds,
    upserts,
  });
  const byFingerprint = new Map(persisted.map((item) => [item.fingerprint, item]));
  const ordered = eligible.flatMap((item) => byFingerprint.get(item.fingerprint) ?? []);
  return { main: ordered[0] ?? null, secondary: ordered.slice(1, 3), evaluatedAt: input.now.toISOString() };
}

export async function listForPet(input: { store: RecommendationStore; ownerId: string; petId: string; now?: Date }) {
  await input.store.assertOwnedPet(input.ownerId, input.petId);
  const now = (input.now ?? new Date()).getTime();
  return (await input.store.listHistory(input.ownerId, input.petId)).filter((item) => (
    ACTIVE_STATUSES.has(item.status)
    && (item.status === 'accepted' || (
      Number.isFinite(Date.parse(item.expiresAt)) && Date.parse(item.expiresAt) > now
    ))
    && !(item.status === 'snoozed' && Number.isFinite(Date.parse(item.snoozedUntil ?? '')) && Date.parse(item.snoozedUntil!) > now)
  ));
}

type EvidenceRow = {
  source_type: RecommendationEvidence['sourceType']; source_id: string; captured_at: string;
  observed_at?: string | null; due_at?: string | null; source_updated_at?: string | null;
  owner_confirmed: boolean; input_confidence?: number | null; excerpt?: string | null;
};

type RecommendationRow = {
  id: string; owner_id: string; pet_id: string; subject_id: string; scenario_key: string; policy_version: string;
  category: Recommendation['category']; risk: Recommendation['risk']; status: RecommendationStatus; fingerprint: string;
  title: string; why_now: string[]; limitation?: string | null; primary_action: Recommendation['primaryAction'];
  confidence: Recommendation['confidence']; rank: Recommendation['rank']; suppression_reasons?: Recommendation['suppressionReasons'];
  fresh_until: string; expires_at: string; created_at: string; shown_at?: string | null; resolved_at?: string | null;
  snoozed_until?: string | null; recommendation_evidence?: EvidenceRow[];
};

function evidenceFromRow(row: EvidenceRow): RecommendationEvidence {
  return {
    sourceType: row.source_type,
    sourceId: row.source_id,
    capturedAt: row.captured_at,
    observedAt: row.observed_at ?? undefined,
    dueAt: row.due_at ?? undefined,
    updatedAt: row.source_updated_at ?? undefined,
    ownerConfirmed: row.owner_confirmed,
    inputConfidence: row.input_confidence ?? undefined,
    excerpt: row.excerpt ?? undefined,
  };
}

function recommendationFromRow(row: RecommendationRow): StoredRecommendation {
  return {
    id: row.id,
    ownerId: row.owner_id,
    petId: row.pet_id,
    subjectId: row.subject_id,
    scenarioKey: row.scenario_key,
    policyVersion: row.policy_version,
    category: row.category,
    risk: row.risk,
    status: row.status,
    fingerprint: row.fingerprint,
    title: row.title,
    whyNow: row.why_now,
    limitation: row.limitation ?? undefined,
    primaryAction: row.primary_action,
    confidence: row.confidence,
    rank: row.rank,
    suppressionReasons: row.suppression_reasons ?? [],
    evidence: (row.recommendation_evidence ?? []).map(evidenceFromRow),
    missingData: [],
    conflicts: [],
    freshUntil: row.fresh_until,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    shownAt: row.shown_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    snoozedUntil: row.snoozed_until ?? undefined,
  };
}

function requestFingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function createSupabaseRecommendationStore(supabase: SupabaseClient): RecommendationStore {
  const select = '*,recommendation_evidence(*)';
  return {
    async assertOwnedPet(ownerId, petId) {
      const result = await supabase.from('pets').select('id').eq('id', petId).eq('owner_id', ownerId).maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('PET_NOT_FOUND');
    },
    async listHistory(ownerId, petId) {
      const result = await supabase.from('recommendations').select(select).eq('owner_id', ownerId).eq('pet_id', petId)
        .order('created_at', { ascending: false });
      if (result.error) throw result.error;
      return ((result.data ?? []) as unknown as RecommendationRow[]).map(recommendationFromRow);
    },
    async listPreferences(ownerId, petId) {
      const result = await supabase.from('recommendation_preferences').select('category,enabled')
        .eq('owner_id', ownerId).eq('pet_id', petId);
      if (result.error) throw result.error;
      return (result.data ?? []).map((row) => ({ category: row.category as RecommendationCategory, enabled: row.enabled }));
    },
    async persistEvaluation(input) {
      const result = await supabase.rpc('recommendation_persist_evaluation_atomic', {
        p_owner_id: input.ownerId,
        p_pet_id: input.petId,
        p_evaluated_at: input.evaluatedAt,
        p_supersede_ids: input.supersedeIds,
        p_recommendations: input.upserts.map(({ recommendation, subjectId }) => ({ ...recommendation, subjectId })),
      });
      if (result.error) throw result.error;
      return ((result.data ?? []) as unknown as RecommendationRow[]).map(recommendationFromRow);
    },
    async getForOwner(ownerId, recommendationId) {
      const result = await supabase.from('recommendations').select(select).eq('owner_id', ownerId).eq('id', recommendationId).maybeSingle();
      if (result.error) throw result.error;
      return result.data ? recommendationFromRow(result.data as unknown as RecommendationRow) : null;
    },
    async transition(input) {
      const payload = input.payload ?? {};
      const fingerprint = requestFingerprint({ id: input.recommendationId, action: input.action, payload });
      const idempotencyKey = input.idempotencyKey ?? `recommendation:${fingerprint.slice(0, 48)}`;
      const outcome = input.action === 'complete' || input.action === 'fail';
      const result = outcome
        ? await supabase.rpc('recommendation_outcome_atomic', {
          p_owner_id: input.ownerId,
          p_idempotency_key: idempotencyKey,
          p_request_fingerprint: fingerprint,
          p_recommendation_id: input.recommendationId,
          p_result: input.action,
          p_payload: payload,
        })
        : await supabase.rpc('recommendation_transition_atomic', {
          p_owner_id: input.ownerId,
          p_idempotency_key: idempotencyKey,
          p_request_fingerprint: fingerprint,
          p_recommendation_id: input.recommendationId,
          p_action: input.action,
          p_payload: payload,
        });
      if (result.error) throw result.error;
      const recommendation = await this.getForOwner(input.ownerId, input.recommendationId);
      if (!recommendation) throw new Error('RECOMMENDATION_NOT_FOUND');
      return recommendation;
    },
    async setPreference(ownerId, petId, category, enabled) {
      const result = await supabase.from('recommendation_preferences').upsert({
        owner_id: ownerId, pet_id: petId, category, enabled,
      }, { onConflict: 'pet_id,category' });
      if (result.error) throw result.error;
    },
    async deleteHistory(ownerId, petId) {
      const result = await supabase.rpc('recommendation_delete_history_for_owner', {
        p_owner_id: ownerId, p_pet_id: petId,
      });
      if (result.error) throw result.error;
    },
  };
}

export function createRecommendationService(supabase: SupabaseClient) {
  const store = createSupabaseRecommendationStore(supabase);
  return {
    recalculateForPet: (input: Omit<RecalculateInput, 'store' | 'loadContext'>) => recalculateForPet({
      ...input,
      store,
      loadContext: (contextInput) => loadRecommendationContext({ supabase, ...contextInput }),
    }),
    listForPet: (input: { ownerId: string; petId: string; now?: Date }) => listForPet({ store, ...input }),
    store,
  };
}
