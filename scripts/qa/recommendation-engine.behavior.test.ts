import assert from 'node:assert/strict';
import test from 'node:test';

import { loadRecommendationContext } from '../../lib/server/recommendations/contextSnapshot';
import type { RecommendationContextSnapshot } from '../../lib/server/recommendations/contextSnapshot';
import { buildCandidates, getPolicy, listActivePolicies } from '../../lib/server/recommendations/policyRegistry';
import {
  GATE_ORDER,
  evaluateRecommendations,
  recommendationFingerprint,
  selectMainRecommendation,
} from '../../lib/server/recommendations/engine';

type Fixture = { data: unknown; error: unknown };

class QueryStub implements PromiseLike<Fixture> {
  constructor(
    private readonly fixture: Fixture,
    private readonly calls: string[],
    private readonly table: string,
  ) {}

  select(columns: string) { this.calls.push(`${this.table}.select:${columns}`); return this; }
  eq(column: string, value: unknown) { this.calls.push(`${this.table}.eq:${column}=${String(value)}`); return this; }
  neq(column: string, value: unknown) { this.calls.push(`${this.table}.neq:${column}=${String(value)}`); return this; }
  is(column: string, value: unknown) { this.calls.push(`${this.table}.is:${column}=${String(value)}`); return this; }
  order(column: string, options: unknown) { this.calls.push(`${this.table}.order:${column}:${JSON.stringify(options)}`); return this; }
  limit(value: number) { this.calls.push(`${this.table}.limit:${value}`); return this; }
  maybeSingle() { return Promise.resolve(this.fixture); }
  then<TResult1 = Fixture, TResult2 = never>(
    onfulfilled?: ((value: Fixture) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.fixture).then(onfulfilled, onrejected);
  }
}

function supabaseStub(fixtures: Record<string, Fixture>) {
  const calls: string[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        calls.push(`from:${table}`);
        return new QueryStub(fixtures[table] ?? { data: [], error: null }, calls, table);
      },
    },
  };
}

test('context snapshot is owner scoped, bounded, provenance rich and privacy allowlisted', async () => {
  const now = new Date('2026-09-02T12:00:00.000Z');
  const { client, calls } = supabaseStub({
    pets: { data: {
      id: 'pet-1', owner_id: 'owner-1', life_stage: 'adult', weight_kg: 18,
      breed_id: 'labrador', breed_group_id: 'retriever',
      avatar_url: 'SECRET_PHOTO', photo_urls: ['SECRET_PHOTO_2'],
    }, error: null },
    pet_passports: { data: {
      pet_id: 'pet-1', diet: 'dry', allergies: 'chicken', medication: null,
      health_notes: 'sensitive stomach', vaccine_status: 'actual', parasite_status: 'actual',
      updated_at: '2026-09-01T10:00:00.000Z', microchip: 'SECRET_MICROCHIP', vet_contact: 'SECRET_CONTACT',
    }, error: null },
    social_profiles: { data: {
      pet_id: 'pet-1', social_mode: 'ask_first', temperament: 'calm', energy_level: 'medium',
      play_style: 'gentle', trainability: 'high', child_friendly: 'yes', dog_friendly: 'careful',
      cat_friendly: 'unknown', triggers: ['scooters'], updated_at: '2026-09-01T11:00:00.000Z',
    }, error: null },
    reminders: { data: [{
      id: 'reminder-1', type: 'grooming', title: 'Когти', due_at: '2026-09-01T09:00:00.000Z',
      snoozed_until: null, status: 'active', updated_at: '2026-08-30T09:00:00.000Z',
      metadata: { documentContent: 'SECRET_DOCUMENT_CONTENT' },
    }], error: null },
    pet_observations: { data: [
      {
        id: 'observation-voice-ok', type: 'appetite', value: 'ест меньше', note: 'SECRET_RAW_NOTE',
        observed_at: '2026-09-02T08:00:00.000Z', source: 'assistant', updated_at: '2026-09-02T08:01:00.000Z',
        metadata: {
          voiceCapture: { inputSource: 'voice' },
          candidate: { confirmed: true, confidence: 0.91, transcriptSpan: 'ест меньше' },
        },
      },
      {
        id: 'observation-voice-low', type: 'energy', value: 'вялая', note: 'SECRET_UNCONFIRMED_NOTE',
        observed_at: '2026-09-02T07:00:00.000Z', source: 'assistant', updated_at: '2026-09-02T07:01:00.000Z',
        metadata: { inputSource: 'voice', ownerConfirmed: false, inputConfidence: 0.99, excerpt: 'вялая' },
      },
      {
        id: 'observation-manual', type: 'mood', value: 'спокойная', note: 'SECRET_MANUAL_NOTE',
        observed_at: '2026-09-01T18:00:00.000Z', source: 'manual', updated_at: '2026-09-01T18:01:00.000Z', metadata: {},
      },
    ], error: null },
    pet_habits: { data: [{
      id: 'habit-1', kind: 'training', title: 'Выдержка', cadence: 'daily', target_per_period: 1,
      status: 'active', created_at: '2026-08-20T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z',
    }], error: null },
    map_zones: { data: [{
      id: 'zone-1', type: 'risk_zone', title: 'Самокаты', area_label: 'у парка', note: 'много самокатов',
      approximate_lat: 55.751, approximate_lng: 37.618, radius_meters: 80,
      created_at: '2026-08-25T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z',
    }], error: null },
    wishlist_items: { data: [{
      id: 'thing-1', title: 'Шлейка', category: 'gear', reason: 'для прогулки', priority: 'medium',
      status: 'not_suitable', created_at: '2026-08-22T10:00:00.000Z', updated_at: '2026-09-01T10:00:00.000Z',
      url: 'SECRET_SHOPPING_URL',
    }], error: null },
  });

  const snapshot = await loadRecommendationContext({
    supabase: client as never, ownerId: 'owner-1', petId: 'pet-1', now,
  });
  const serialized = JSON.stringify(snapshot);

  for (const secret of [
    'SECRET_PHOTO', 'SECRET_PHOTO_2', 'SECRET_MICROCHIP', 'SECRET_CONTACT',
    'SECRET_DOCUMENT_CONTENT', 'SECRET_RAW_NOTE', 'SECRET_UNCONFIRMED_NOTE',
    'SECRET_MANUAL_NOTE', 'SECRET_SHOPPING_URL', '55.751', '37.618',
  ]) assert.equal(serialized.includes(secret), false, `snapshot leaked ${secret}`);

  assert.equal(snapshot.pet.id, 'pet-1');
  assert.equal(snapshot.reminders.length, 1);
  assert.equal(snapshot.observations.length, 3);
  assert.equal(snapshot.observations[0]?.sufficient, true);
  assert.equal(snapshot.observations[0]?.evidence.ownerConfirmed, true);
  assert.equal(snapshot.observations[0]?.evidence.inputConfidence, 0.91);
  assert.equal(snapshot.observations[0]?.evidence.excerpt, 'ест меньше');
  assert.equal(snapshot.observations[1]?.sufficient, false);
  assert.equal(snapshot.observations[1]?.value, undefined);
  assert.equal(snapshot.observations[2]?.value, 'спокойная');
  assert.deepEqual(snapshot.zones[0], {
    id: 'zone-1', type: 'risk_zone', title: 'Самокаты', areaLabel: 'у парка', note: 'много самокатов',
    evidence: snapshot.zones[0]?.evidence,
  });
  assert.equal(snapshot.facts.every((fact) => fact.capturedAt === now.toISOString()), true);
  assert.equal(calls.includes('pet_observations.limit:20'), true);
  assert.equal(calls.includes('pet_habits.eq:status=active'), true);
  assert.equal(calls.includes('wishlist_items.is:deleted_at=null'), true);
});

test('context snapshot stops after the owner check for an unowned pet', async () => {
  const { client, calls } = supabaseStub({ pets: { data: null, error: null } });

  await assert.rejects(
    loadRecommendationContext({
      supabase: client as never,
      ownerId: 'owner-1',
      petId: 'unowned-pet',
      now: new Date('2026-09-02T12:00:00.000Z'),
    }),
    /PET_NOT_FOUND/,
  );

  assert.deepEqual(calls.filter((call) => call.startsWith('from:')), ['from:pets']);
});

function policySnapshot(overrides: Partial<RecommendationContextSnapshot> = {}): RecommendationContextSnapshot {
  const capturedAt = '2026-09-02T12:00:00.000Z';
  const profileEvidence = {
    sourceType: 'profile' as const, sourceId: 'pet-1', capturedAt, ownerConfirmed: true,
  };
  return {
    petId: 'pet-1', capturedAt,
    pet: { id: 'pet-1', lifeStage: 'adult', evidence: profileEvidence },
    passport: null,
    social: null,
    reminders: [],
    observations: [],
    habits: [],
    zones: [],
    wishlist: [],
    facts: [profileEvidence],
    ...overrides,
  };
}

test('policy registry exposes exactly five immutable versioned policies', () => {
  assert.deepEqual(listActivePolicies().map(({ key, version }) => [key, version]), [
    ['care_due', 'care_due@1'],
    ['wellbeing_change', 'wellbeing_change@1'],
    ['habit_explicit_goal', 'habit_explicit_goal@1'],
    ['walk_with_constraints', 'walk_with_constraints@1'],
    ['thing_for_task', 'thing_for_task@1'],
  ]);
  assert.equal(getPolicy('care_due')?.version, 'care_due@1');
  assert.equal(getPolicy('care_due', 'care_due@1')?.key, 'care_due');
  assert.equal(getPolicy('care_due', 'care_due@99'), undefined);
  assert.equal(getPolicy('red_flag'), undefined);
  assert.equal(listActivePolicies().every((policy) => Object.isFrozen(policy)), true);
  assert.equal(Object.isFrozen(listActivePolicies()), true);
});

test('policy care_due creates candidates only for overdue or upcoming active reminders', () => {
  const capturedAt = '2026-09-02T12:00:00.000Z';
  const reminder = (id: string, dueAt: string, status = 'active') => ({
    id, type: 'grooming', title: `Дело ${id}`, dueAt, status,
    evidence: { sourceType: 'reminder' as const, sourceId: id, capturedAt, dueAt, ownerConfirmed: true },
  });
  const candidates = buildCandidates(policySnapshot({
    reminders: [
      reminder('overdue', '2026-09-01T12:00:00.000Z'),
      reminder('upcoming', '2026-09-05T12:00:00.000Z'),
      reminder('far', '2026-10-01T12:00:00.000Z'),
      reminder('done', '2026-09-01T12:00:00.000Z', 'done'),
    ],
  }), { now: new Date(capturedAt) });
  const care = candidates.filter((candidate) => candidate.scenarioKey === 'care_due');
  assert.deepEqual(care.map((candidate) => candidate.subjectId), ['overdue', 'upcoming']);
  assert.deepEqual(care.map((candidate) => candidate.primaryAction.intent), ['open_reminder', 'open_reminder']);
});

test('policy wellbeing_change needs two comparable owner-confirmed observations and never diagnoses', () => {
  const capturedAt = '2026-09-02T12:00:00.000Z';
  const observation = (id: string, type: string, observedAt: string, sufficient = true, value = 'ест меньше') => ({
    id, type, observedAt, source: 'assistant', sufficient, value: sufficient ? value : undefined,
    evidence: {
      sourceType: 'observation' as const, sourceId: id, capturedAt, observedAt,
      ownerConfirmed: sufficient, inputConfidence: 0.91, excerpt: sufficient ? 'ест меньше' : undefined,
    },
  });
  const positive = buildCandidates(policySnapshot({ observations: [
    observation('new', 'appetite', '2026-09-02T10:00:00.000Z'),
    observation('old', 'appetite', '2026-09-01T10:00:00.000Z', true, 'как обычно'),
  ] }), { now: new Date(capturedAt) }).filter((candidate) => candidate.scenarioKey === 'wellbeing_change');
  assert.equal(positive.length, 1);
  assert.equal(positive[0]?.risk, 'caution');
  assert.equal(positive[0]?.primaryAction.intent, 'open_health');
  assert.equal(positive[0]?.limitation, 'Это наблюдение, а не диагноз.');
  assert.equal(JSON.stringify(positive).includes('заболевание'), false);

  const unconfirmed = buildCandidates(policySnapshot({ observations: [
    observation('new', 'appetite', '2026-09-02T10:00:00.000Z', false),
    observation('old', 'appetite', '2026-09-01T10:00:00.000Z'),
  ] }), { now: new Date(capturedAt) });
  assert.equal(unconfirmed.some((candidate) => candidate.scenarioKey === 'wellbeing_change'), false);
});

test('policy habit_explicit_goal requires an explicit goal and respects habit and wellbeing conflicts', () => {
  const now = new Date('2026-09-02T12:00:00.000Z');
  const explicitGoal = { requestId: 'request-habit-1', kind: 'training', title: 'Выдержка', cadence: 'daily' as const, targetPerPeriod: 1 };
  const positive = buildCandidates(policySnapshot(), { now, explicitGoal });
  assert.equal(positive.filter((candidate) => candidate.scenarioKey === 'habit_explicit_goal').length, 1);
  assert.equal(buildCandidates(policySnapshot(), { now }).some((candidate) => candidate.scenarioKey === 'habit_explicit_goal'), false);
  assert.equal(buildCandidates(policySnapshot({ pet: {
    id: 'pet-1', lifeStage: 'adult', breedId: 'border-collie', evidence: policySnapshot().pet.evidence,
  } }), { now }).some((candidate) => candidate.scenarioKey === 'habit_explicit_goal'), false);

  const existingHabit = {
    id: 'habit-1', kind: 'training', title: 'выдержка', cadence: 'daily', targetPerPeriod: 1, status: 'active',
    evidence: { sourceType: 'habit' as const, sourceId: 'habit-1', capturedAt: now.toISOString(), ownerConfirmed: true },
  };
  assert.equal(buildCandidates(policySnapshot({ habits: [existingHabit] }), { now, explicitGoal })
    .some((candidate) => candidate.scenarioKey === 'habit_explicit_goal'), false);
});

test('policy walk_with_constraints is explicit and exposes zone IDs without coordinates', () => {
  const capturedAt = '2026-09-02T12:00:00.000Z';
  const zone = {
    id: 'zone-1', type: 'risk_zone', title: 'Самокаты', areaLabel: 'у парка',
    evidence: { sourceType: 'map_zone' as const, sourceId: 'zone-1', capturedAt, ownerConfirmed: true },
  };
  const passive = buildCandidates(policySnapshot({ zones: [zone] }), { now: new Date(capturedAt) });
  assert.equal(passive.some((candidate) => candidate.scenarioKey === 'walk_with_constraints'), false);
  const active = buildCandidates(policySnapshot({ zones: [zone] }), {
    now: new Date(capturedAt), walk: { requestId: 'request-walk-1', mode: 'explicit' },
  }).filter((candidate) => candidate.scenarioKey === 'walk_with_constraints');
  assert.equal(active.length, 1);
  assert.deepEqual(active[0]?.primaryAction, {
    intent: 'plan_walk', zoneIds: ['zone-1'], limitation: 'route_not_verified_safe',
  });
  assert.equal(active[0]?.limitation, 'Псё не подтверждает безопасность маршрута.');
});

test('policy thing_for_task needs a reason and suppresses bought or unsuitable matches', () => {
  const now = new Date('2026-09-02T12:00:00.000Z');
  const request = { requestId: 'request-thing-1', title: 'Шлейка', category: 'gear', reason: 'для прогулки' };
  const positive = buildCandidates(policySnapshot(), { now, thing: request })
    .filter((candidate) => candidate.scenarioKey === 'thing_for_task');
  assert.equal(positive.length, 1);
  assert.deepEqual(positive[0]?.primaryAction, {
    intent: 'add_wishlist', draft: { title: 'Шлейка', category: 'gear', reason: 'для прогулки' },
  });
  assert.equal(buildCandidates(policySnapshot(), {
    now, thing: { ...request, reason: '' },
  }).some((candidate) => candidate.scenarioKey === 'thing_for_task'), false);
  const prior = {
    id: 'thing-1', title: 'шлейка', category: 'gear', reason: 'для прогулки', priority: 'medium', status: 'not_suitable',
    evidence: { sourceType: 'wishlist' as const, sourceId: 'thing-1', capturedAt: now.toISOString(), ownerConfirmed: true },
  };
  assert.equal(buildCandidates(policySnapshot({ wishlist: [prior] }), { now, thing: request })
    .some((candidate) => candidate.scenarioKey === 'thing_for_task'), false);
});

function engineCandidates() {
  const now = new Date('2026-09-02T12:00:00.000Z');
  const capturedAt = now.toISOString();
  const reminder = {
    id: 'reminder-engine', type: 'grooming', title: 'Когти', dueAt: '2026-09-01T12:00:00.000Z', status: 'active',
    evidence: {
      sourceType: 'reminder' as const, sourceId: 'reminder-engine', capturedAt,
      dueAt: '2026-09-01T12:00:00.000Z', ownerConfirmed: true,
    },
  };
  const candidates = buildCandidates(policySnapshot({ reminders: [reminder] }), { now });
  return { now, care: candidates.find((candidate) => candidate.scenarioKey === 'care_due')! };
}

test('AC01 keeps one active canonical fingerprint and reuses persisted identity', () => {
  const { now, care } = engineCandidates();
  const equivalent = { ...care, normalizedReason: `  ${care.normalizedReason.toUpperCase()}   ` };
  assert.equal(recommendationFingerprint(care), recommendationFingerprint(equivalent));
  const fingerprint = recommendationFingerprint(care);
  const decisions = evaluateRecommendations({
    petId: 'pet-1', now, candidates: [care, equivalent],
    existing: [{ id: 'persisted-1', fingerprint, scenarioKey: care.scenarioKey, subjectId: care.subjectId, status: 'eligible' }],
  });
  assert.equal(decisions.filter((decision) => decision.status === 'eligible').length, 1);
  assert.equal(decisions.filter((decision) => decision.status === 'suppressed' && decision.reasons.includes('duplicate')).length, 1);
  assert.equal(decisions.find((decision) => decision.status === 'eligible')?.recommendation.id, 'persisted-1');
});

test('AC02 hard gates keep fixed order and report the first suppression reason', () => {
  assert.deepEqual(GATE_ORDER, [
    'ownership', 'required_evidence', 'freshness', 'owner_confirmation',
    'conflict', 'action_available', 'preference', 'dedup', 'cooldown',
  ]);
  const { now, care } = engineCandidates();
  const decisions = evaluateRecommendations({
    petId: 'pet-1', now,
    candidates: [{ ...care, evidence: [], freshUntil: '2026-09-01T00:00:00.000Z' }],
  });
  assert.deepEqual(decisions[0], {
    status: 'suppressed', candidate: { ...care, evidence: [], freshUntil: '2026-09-01T00:00:00.000Z', suppressionReasons: ['missing_evidence'] },
    reasons: ['missing_evidence'],
  });
});

test('AC03 safety override always owns the main slot over routine score', () => {
  const { now, care } = engineCandidates();
  const safety = {
    ...care,
    scenarioKey: 'wellbeing_change', policyVersion: 'wellbeing_change@1', category: 'wellbeing' as const,
    risk: 'safety_override' as const, subjectId: 'safety-1', normalizedReason: 'approved safety fixture',
    evidence: [{ ...care.evidence[0]!, sourceType: 'observation' as const, sourceId: 'safety-1' }],
    primaryAction: { intent: 'open_health' as const, observationId: 'safety-1' },
    rank: { tier: 99, urgency: 0, actionability: 0, relevance: 0, annoyancePenalty: 100 },
  };
  const decisions = evaluateRecommendations({ petId: 'pet-1', now, candidates: [care, safety] });
  assert.equal(selectMainRecommendation(decisions)?.risk, 'safety_override');
});

test('AC04 explicit snooze wins and suppresses recalculation until its time', () => {
  const { now, care } = engineCandidates();
  const fingerprint = recommendationFingerprint(care);
  const before = evaluateRecommendations({
    petId: 'pet-1', now, candidates: [care],
    existing: [{
      id: 'persisted-1', fingerprint, scenarioKey: care.scenarioKey, subjectId: care.subjectId,
      status: 'snoozed', snoozedUntil: '2026-09-02T13:00:00.000Z',
    }],
  });
  assert.deepEqual(before[0]?.status === 'suppressed' ? before[0].reasons : [], ['cooldown']);
  const after = evaluateRecommendations({
    petId: 'pet-1', now: new Date('2026-09-02T13:00:01.000Z'), candidates: [care],
    existing: [{
      id: 'persisted-1', fingerprint, scenarioKey: care.scenarioKey, subjectId: care.subjectId,
      status: 'snoozed', snoozedUntil: '2026-09-02T13:00:00.000Z',
    }],
  });
  assert.equal(after[0]?.status, 'eligible');
});

test('AC11 engine has no LLM path and preserves approved policy copy', () => {
  const { now, care } = engineCandidates();
  const result = evaluateRecommendations({ petId: 'pet-1', now, candidates: [care] });
  const recommendation = result[0]?.status === 'eligible' ? result[0].recommendation : null;
  assert.equal(recommendation?.title, care.title);
  assert.deepEqual(recommendation?.whyNow, care.whyNow);
});

test('AC12 disabled routine category suppresses routine but never safety override', () => {
  const { now, care } = engineCandidates();
  const routine = evaluateRecommendations({
    petId: 'pet-1', now, candidates: [care], preferences: [{ category: 'care', enabled: false }],
  });
  assert.deepEqual(routine[0]?.status === 'suppressed' ? routine[0].reasons : [], ['category_disabled']);
  const safety = { ...care, risk: 'safety_override' as const };
  assert.equal(evaluateRecommendations({
    petId: 'pet-1', now, candidates: [safety], preferences: [{ category: 'care', enabled: false }],
  })[0]?.status, 'eligible');
});

test('scenario cooldown defaults are enforced without crossing their boundaries', () => {
  const { now, care } = engineCandidates();
  const snapshot = policySnapshot();
  const habit = buildCandidates(snapshot, { now, explicitGoal: {
    requestId: 'habit-cooldown', kind: 'training', title: 'Выдержка', cadence: 'daily', targetPerPeriod: 1,
  } }).find((candidate) => candidate.scenarioKey === 'habit_explicit_goal')!;
  const walk = buildCandidates(snapshot, {
    now, walk: { requestId: 'walk-cooldown', mode: 'explicit' },
  }).find((candidate) => candidate.scenarioKey === 'walk_with_constraints')!;
  const thing = buildCandidates(snapshot, { now, thing: {
    requestId: 'thing-cooldown', title: 'Шлейка', category: 'gear', reason: 'для прогулки',
  } }).find((candidate) => candidate.scenarioKey === 'thing_for_task')!;
  const checks = [
    { candidate: care, status: 'shown' as const, at: '2026-09-01T13:00:00.000Z', field: 'shownAt' as const, blocked: true },
    { candidate: care, status: 'shown' as const, at: '2026-09-01T11:00:00.000Z', field: 'shownAt' as const, blocked: false },
    { candidate: habit, status: 'dismissed' as const, at: '2026-08-04T12:00:00.000Z', field: 'resolvedAt' as const, blocked: true },
    { candidate: walk, status: 'shown' as const, at: '2026-09-02T01:00:00.000Z', field: 'shownAt' as const, blocked: true },
    { candidate: thing, status: 'dismissed' as const, at: '2026-08-04T12:00:00.000Z', field: 'resolvedAt' as const, blocked: true },
    { candidate: thing, status: 'snoozed' as const, at: '2026-08-26T13:00:00.000Z', field: 'resolvedAt' as const, blocked: true },
    { candidate: thing, status: 'snoozed' as const, at: '2026-08-25T11:00:00.000Z', field: 'resolvedAt' as const, blocked: false },
  ];
  for (const [index, check] of checks.entries()) {
    const state = {
      id: `history-${index}`, fingerprint: recommendationFingerprint(check.candidate),
      scenarioKey: check.candidate.scenarioKey, subjectId: check.candidate.subjectId, status: check.status,
      [check.field]: check.at,
    };
    const decision = evaluateRecommendations({ petId: 'pet-1', now, candidates: [check.candidate], existing: [state] })[0];
    assert.equal(decision?.status, check.blocked ? 'suppressed' : 'eligible');
    if (check.blocked && decision?.status === 'suppressed') assert.deepEqual(decision.reasons, ['cooldown']);
  }
});

test('ranking is tiered, stable, and deterministic across 100 shuffled replays', () => {
  const { now, care } = engineCandidates();
  const highTier = { ...care, subjectId: 'tier-4', normalizedReason: 'tier four', rank: { ...care.rank, tier: 4, urgency: 100 } };
  const lowScoreBetterTier = { ...care, subjectId: 'tier-3', normalizedReason: 'tier three', rank: { ...care.rank, tier: 3, urgency: 0 } };
  const baseline = JSON.stringify(evaluateRecommendations({ petId: 'pet-1', now, candidates: [highTier, lowScoreBetterTier] }));
  assert.equal(selectMainRecommendation(JSON.parse(baseline))?.fingerprint, recommendationFingerprint(lowScoreBetterTier));
  for (let index = 0; index < 100; index += 1) {
    const shuffled = index % 2 ? [lowScoreBetterTier, highTier] : [highTier, lowScoreBetterTier];
    assert.equal(JSON.stringify(evaluateRecommendations({ petId: 'pet-1', now, candidates: shuffled })), baseline);
  }
});
