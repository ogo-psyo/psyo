import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseRecommendationDomainAdapter, recordOutcomeForOwner, type RecommendationOutcome } from './lifecycle';
import { createSupabaseRecommendationStore } from './repository';

export type OutcomeRetryItem = {
  id: string;
  ownerId: string;
  outcomeKey: string;
  recommendationId: string;
  domainType: RecommendationOutcome['domainType'];
  domainId: string;
  result: RecommendationOutcome['result'];
  occurredAt: string;
  attemptCount: number;
};

export type OutcomeRetryStore = {
  listDue(now: string, limit: number): Promise<OutcomeRetryItem[]>;
  remove(id: string): Promise<void>;
  reschedule(update: { id: string; attemptCount: number; nextRetryAt: string; errorCode: string }): Promise<void>;
  countExhausted(): Promise<number>;
};

type RetryRecordInput = OutcomeRetryItem & { idempotencyKey: string };

function retryErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return ['RECOMMENDATION_NOT_FOUND', 'DOMAIN_TARGET_NOT_FOUND', 'DOMAIN_ACTION_MISMATCH', 'INVALID_RECOMMENDATION_TRANSITION']
    .find((code) => message.includes(code)) ?? 'OUTCOME_RETRY_FAILED';
}

export async function processRecommendationOutcomeRetries(input: {
  now: Date;
  store: OutcomeRetryStore;
  record: (item: RetryRecordInput) => Promise<void>;
  limit?: number;
}) {
  const due = await input.store.listDue(input.now.toISOString(), input.limit ?? 50);
  let linked = 0;
  let rescheduled = 0;
  for (const item of due) {
    try {
      await input.record({ ...item, idempotencyKey: item.outcomeKey });
      await input.store.remove(item.id);
      linked += 1;
    } catch (error) {
      const attemptCount = item.attemptCount + 1;
      const delayMinutes = Math.min(24 * 60, 5 * (2 ** attemptCount));
      await input.store.reschedule({
        id: item.id,
        attemptCount,
        nextRetryAt: new Date(input.now.getTime() + delayMinutes * 60_000).toISOString(),
        errorCode: retryErrorCode(error),
      });
      rescheduled += 1;
    }
  }
  return {
    scanned: due.length,
    linked,
    rescheduled,
    exhausted: await input.store.countExhausted(),
  };
}

export function createSupabaseOutcomeRetryStore(supabase: SupabaseClient): OutcomeRetryStore {
  return {
    async listDue(now, limit) {
      const result = await supabase.from('recommendation_outcome_failures')
        .select('id,owner_id,outcome_key,recommendation_id,domain_type,domain_id,result,occurred_at,attempt_count')
        .lt('attempt_count', 10).lte('next_retry_at', now).order('next_retry_at', { ascending: true }).limit(limit);
      if (result.error) throw result.error;
      return (result.data ?? []).map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        outcomeKey: row.outcome_key,
        recommendationId: row.recommendation_id,
        domainType: row.domain_type as OutcomeRetryItem['domainType'],
        domainId: row.domain_id,
        result: row.result as OutcomeRetryItem['result'],
        occurredAt: row.occurred_at,
        attemptCount: row.attempt_count,
      }));
    },
    async remove(id) {
      const result = await supabase.from('recommendation_outcome_failures').delete().eq('id', id);
      if (result.error) throw result.error;
    },
    async reschedule(update) {
      const result = await supabase.from('recommendation_outcome_failures').update({
        attempt_count: update.attemptCount,
        next_retry_at: update.nextRetryAt,
        error_code: update.errorCode,
      }).eq('id', update.id);
      if (result.error) throw result.error;
    },
    async countExhausted() {
      const result = await supabase.from('recommendation_outcome_failures')
        .select('id', { count: 'exact', head: true }).gte('attempt_count', 10);
      if (result.error) throw result.error;
      return result.count ?? 0;
    },
  };
}

export async function processSupabaseRecommendationOutcomeRetries(input: {
  supabase: SupabaseClient;
  now?: Date;
  limit?: number;
}) {
  return processRecommendationOutcomeRetries({
    now: input.now ?? new Date(),
    limit: input.limit,
    store: createSupabaseOutcomeRetryStore(input.supabase),
    record: async (item) => {
      await recordOutcomeForOwner({
        store: createSupabaseRecommendationStore(input.supabase),
        domain: createSupabaseRecommendationDomainAdapter(input.supabase),
        ownerId: item.ownerId,
        outcome: {
          recommendationId: item.recommendationId,
          domainType: item.domainType,
          domainId: item.domainId,
          result: item.result,
          occurredAt: item.occurredAt,
        },
        now: new Date(),
        idempotencyKey: item.idempotencyKey,
      });
    },
  });
}
