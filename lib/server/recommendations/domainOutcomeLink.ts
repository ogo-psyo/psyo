import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseRecommendationStore, type RecommendationStore } from './repository';
import {
  createSupabaseRecommendationDomainAdapter,
  recordOutcomeForOwner,
  type RecommendationDomainAdapter,
  type RecommendationOutcome,
} from './lifecycle';

type LinkInput = {
  supabase: SupabaseClient;
  ownerId: string;
  recommendationId: string;
  domainType: RecommendationOutcome['domainType'];
  domainId: string;
  result: RecommendationOutcome['result'];
  idempotencyKey: string;
  occurredAt?: string;
};

type LinkDependencies = {
  store: (supabase: SupabaseClient) => RecommendationStore;
  domain: (supabase: SupabaseClient) => RecommendationDomainAdapter;
  record: typeof recordOutcomeForOwner;
};

const defaultDependencies: LinkDependencies = {
  store: createSupabaseRecommendationStore,
  domain: createSupabaseRecommendationDomainAdapter,
  record: recordOutcomeForOwner,
};

function linkKey(input: LinkInput) {
  const digest = createHash('sha256').update(JSON.stringify({
    recommendationId: input.recommendationId,
    domainType: input.domainType,
    domainId: input.domainId,
    result: input.result,
    idempotencyKey: input.idempotencyKey,
  })).digest('hex');
  return `recout:${digest}`;
}

function failureCode(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  for (const code of ['RECOMMENDATION_NOT_FOUND', 'DOMAIN_TARGET_NOT_FOUND', 'DOMAIN_ACTION_MISMATCH', 'INVALID_RECOMMENDATION_TRANSITION']) {
    if (message.includes(code)) return code;
  }
  return 'OUTCOME_LINK_FAILED';
}

export async function linkRecommendationOutcome(
  input: LinkInput,
  dependencies: LinkDependencies = defaultDependencies,
): Promise<'linked' | 'pending'> {
  const occurredAt = input.occurredAt && Number.isFinite(Date.parse(input.occurredAt))
    ? new Date(input.occurredAt).toISOString()
    : new Date().toISOString();
  const idempotencyKey = linkKey(input);
  try {
    await dependencies.record({
      store: dependencies.store(input.supabase),
      domain: dependencies.domain(input.supabase),
      ownerId: input.ownerId,
      outcome: {
        recommendationId: input.recommendationId,
        domainType: input.domainType,
        domainId: input.domainId,
        result: input.result,
        occurredAt,
      },
      now: new Date(occurredAt),
      idempotencyKey,
    });
    return 'linked';
  } catch (error) {
    try {
      const failure = await input.supabase.from('recommendation_outcome_failures').upsert({
        owner_id: input.ownerId,
        outcome_key: idempotencyKey,
        recommendation_id: input.recommendationId,
        domain_type: input.domainType,
        domain_id: input.domainId,
        result: input.result,
        occurred_at: occurredAt,
        error_code: failureCode(error),
        next_retry_at: new Date(Date.parse(occurredAt) + 5 * 60_000).toISOString(),
      }, { onConflict: 'owner_id,outcome_key' });
      if (failure.error) console.error('recommendation outcome retry record failed');
    } catch {
      console.error('recommendation outcome retry record failed');
    }
    return 'pending';
  }
}
