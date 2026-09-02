import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  RecommendationAction,
  RecommendationEvidence,
  RecommendationLifecycleCommand,
} from '@/packages/recommendations/contracts';
import type { RecommendationStore, StoredRecommendation } from './repository';

export type RecommendationOutcome = {
  recommendationId: string;
  domainType: 'reminder' | 'habit' | 'route' | 'wishlist';
  domainId: string;
  result: 'completed' | 'failed';
  occurredAt: string;
};

export type SynchronizedOutcome = Omit<RecommendationOutcome, 'recommendationId' | 'result'>;

export interface RecommendationDomainAdapter {
  targetBelongsToOwnerPet(input: {
    ownerId: string;
    petId: string;
    domainType: RecommendationOutcome['domainType'];
    domainId: string;
  }): Promise<boolean>;
  verifyAndSynchronize(input: {
    ownerId: string;
    petId: string;
    action: RecommendationAction;
  }): Promise<{ verified: false } | ({ verified: true } & SynchronizedOutcome)>;
}

type LifecycleResult = {
  recommendation: StoredRecommendation;
  correctionSource?: Pick<RecommendationEvidence, 'sourceType' | 'sourceId'>;
  synchronizedOutcome?: SynchronizedOutcome;
};

function sourceForCorrection(recommendation: StoredRecommendation) {
  const source = recommendation.evidence[0];
  return source ? { sourceType: source.sourceType, sourceId: source.sourceId } : undefined;
}

export async function transitionForOwner(input: {
  store: RecommendationStore;
  domain: RecommendationDomainAdapter;
  ownerId: string;
  recommendationId: string;
  command: RecommendationLifecycleCommand;
  now: Date;
  idempotencyKey?: string;
}): Promise<LifecycleResult> {
  const recommendation = await input.store.getForOwner(input.ownerId, input.recommendationId);
  if (!recommendation) throw new Error('RECOMMENDATION_NOT_FOUND');

  if (input.command.action === 'snooze') {
    const until = Date.parse(input.command.until);
    if (!Number.isFinite(until) || until <= input.now.getTime()) throw new Error('INVALID_SNOOZE_UNTIL');
    return { recommendation: await input.store.transition({
      ownerId: input.ownerId, recommendationId: input.recommendationId, action: 'snooze',
      payload: { until: new Date(until).toISOString() }, occurredAt: input.now.toISOString(), idempotencyKey: input.idempotencyKey,
    }) };
  }

  if (input.command.action === 'accept') {
    return { recommendation: await input.store.transition({
      ownerId: input.ownerId, recommendationId: input.recommendationId, action: 'accept',
      occurredAt: input.now.toISOString(), idempotencyKey: input.idempotencyKey,
    }) };
  }

  const reason = input.command.reason;
  if (reason === 'never_suggest' && recommendation.risk === 'safety_override') {
    throw new Error('SAFETY_OVERRIDE_PREFERENCE_FORBIDDEN');
  }
  if (reason === 'already_done') {
    const synchronized = await input.domain.verifyAndSynchronize({
      ownerId: input.ownerId, petId: recommendation.petId, action: recommendation.primaryAction,
    });
    if (synchronized.verified) {
      const completed = await input.store.transition({
        ownerId: input.ownerId,
        recommendationId: input.recommendationId,
        action: 'complete',
        payload: { reason, ...synchronized },
        occurredAt: input.now.toISOString(),
        idempotencyKey: input.idempotencyKey,
      });
      const { verified: _verified, ...synchronizedOutcome } = synchronized;
      return { recommendation: completed, synchronizedOutcome };
    }
  }

  const dismissed = await input.store.transition({
    ownerId: input.ownerId,
    recommendationId: input.recommendationId,
    action: 'dismiss',
    payload: { reason },
    occurredAt: input.now.toISOString(),
    idempotencyKey: input.idempotencyKey,
  });
  if (reason === 'never_suggest') {
    await input.store.setPreference(input.ownerId, recommendation.petId, recommendation.category, false);
  }
  return {
    recommendation: dismissed,
    correctionSource: reason === 'wrong_data' ? sourceForCorrection(recommendation) : undefined,
  };
}

function expectedDomain(action: RecommendationAction): RecommendationOutcome['domainType'] | null {
  if (action.intent === 'open_reminder') return 'reminder';
  if (action.intent === 'open_habits') return 'habit';
  if (action.intent === 'plan_walk') return 'route';
  if (action.intent === 'add_wishlist') return 'wishlist';
  return null;
}

function intentTargetsDomainId(action: RecommendationAction, outcome: RecommendationOutcome) {
  if (action.intent === 'open_reminder') return action.reminderId === outcome.domainId;
  return true;
}

export async function recordOutcomeForOwner(input: {
  store: RecommendationStore;
  domain: RecommendationDomainAdapter;
  ownerId: string;
  outcome: RecommendationOutcome;
  now: Date;
  idempotencyKey?: string;
}) {
  const recommendation = await input.store.getForOwner(input.ownerId, input.outcome.recommendationId);
  if (!recommendation) throw new Error('RECOMMENDATION_NOT_FOUND');
  const matchingTerminal = recommendation.status === (input.outcome.result === 'completed' ? 'completed' : 'failed')
    && Boolean(input.idempotencyKey);
  if (!['shown', 'accepted'].includes(recommendation.status) && !matchingTerminal) {
    throw new Error('INVALID_RECOMMENDATION_OUTCOME_STATE');
  }
  if (!input.outcome.domainId.trim() || !Number.isFinite(Date.parse(input.outcome.occurredAt))) {
    throw new Error('INVALID_RECOMMENDATION_OUTCOME');
  }
  if (expectedDomain(recommendation.primaryAction) !== input.outcome.domainType
    || !intentTargetsDomainId(recommendation.primaryAction, input.outcome)) {
    throw new Error('DOMAIN_ACTION_MISMATCH');
  }
  const belongs = await input.domain.targetBelongsToOwnerPet({
    ownerId: input.ownerId,
    petId: recommendation.petId,
    domainType: input.outcome.domainType,
    domainId: input.outcome.domainId,
  });
  if (!belongs) throw new Error('DOMAIN_TARGET_NOT_FOUND');
  return input.store.transition({
    ownerId: input.ownerId,
    recommendationId: recommendation.id,
    action: input.outcome.result === 'completed' ? 'complete' : 'fail',
    payload: {
      domainType: input.outcome.domainType,
      domainId: input.outcome.domainId,
      occurredAt: new Date(input.outcome.occurredAt).toISOString(),
    },
    occurredAt: input.now.toISOString(),
    idempotencyKey: input.idempotencyKey,
  });
}

export async function deleteRecommendationHistoryForOwner(input: {
  store: RecommendationStore;
  ownerId: string;
  petId: string;
}) {
  await input.store.assertOwnedPet(input.ownerId, input.petId);
  await input.store.deleteHistory(input.ownerId, input.petId);
}

function resultRow(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function resultOccurredAt(row: Record<string, unknown>) {
  for (const key of ['completed_at', 'updated_at', 'created_at']) {
    const value = row[key];
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  }
  return new Date(0).toISOString();
}

export function createSupabaseRecommendationDomainAdapter(supabase: SupabaseClient): RecommendationDomainAdapter {
  return {
    async targetBelongsToOwnerPet(input) {
      if (input.domainType === 'route') {
        const result = await supabase.from('map_routes').select('id').eq('id', input.domainId)
          .eq('pet_id', input.petId).eq('owner_id', input.ownerId).maybeSingle();
        if (result.error) throw result.error;
        return Boolean(result.data);
      }
      const table = input.domainType === 'reminder' ? 'reminders'
        : input.domainType === 'habit' ? 'pet_habits' : 'wishlist_items';
      const result = await supabase.from(table).select('id,pets!inner(owner_id)').eq('id', input.domainId)
        .eq('pet_id', input.petId).eq('pets.owner_id', input.ownerId).maybeSingle();
      if (result.error) throw result.error;
      return Boolean(result.data);
    },
    async verifyAndSynchronize(input) {
      if (input.action.intent === 'open_reminder') {
        const result = await supabase.from('reminders').select('id,status,completed_at,updated_at,pets!inner(owner_id)')
          .eq('id', input.action.reminderId).eq('pet_id', input.petId).eq('pets.owner_id', input.ownerId).maybeSingle();
        if (result.error) throw result.error;
        const row = resultRow(result.data);
        if (row?.status === 'done') return {
          verified: true as const, domainType: 'reminder' as const, domainId: String(row.id), occurredAt: resultOccurredAt(row),
        };
        return { verified: false as const };
      }
      if (input.action.intent === 'open_habits' && input.action.draft) {
        const result = await supabase.from('pet_habits').select('id,created_at,pets!inner(owner_id)')
          .eq('pet_id', input.petId).eq('pets.owner_id', input.ownerId)
          .eq('kind', input.action.draft.kind).eq('title', input.action.draft.title).eq('status', 'active').limit(1).maybeSingle();
        if (result.error) throw result.error;
        const row = resultRow(result.data);
        if (row) return {
          verified: true as const, domainType: 'habit' as const, domainId: String(row.id), occurredAt: resultOccurredAt(row),
        };
      }
      if (input.action.intent === 'add_wishlist') {
        const result = await supabase.from('wishlist_items').select('id,created_at,pets!inner(owner_id)')
          .eq('pet_id', input.petId).eq('pets.owner_id', input.ownerId)
          .eq('title', input.action.draft.title).eq('category', input.action.draft.category)
          .eq('reason', input.action.draft.reason).is('deleted_at', null).limit(1).maybeSingle();
        if (result.error) throw result.error;
        const row = resultRow(result.data);
        if (row) return {
          verified: true as const, domainType: 'wishlist' as const, domainId: String(row.id), occurredAt: resultOccurredAt(row),
        };
      }
      return { verified: false as const };
    },
  };
}
