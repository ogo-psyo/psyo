import type {
  RecommendationAction,
  RecommendationCandidate,
  RecommendationCategory,
  RecommendationEvidence,
  RecommendationSourceType,
} from '@/packages/recommendations/contracts';
import type { RecommendationContextSnapshot } from './contextSnapshot';

export type EvaluationContext = {
  now: Date;
  explicitGoal?: {
    requestId: string;
    kind: string;
    title: string;
    cadence: 'daily' | 'weekly';
    targetPerPeriod: number;
  };
  walk?: { requestId: string; mode: 'explicit' | 'open_flow' };
  thing?: { requestId: string; title: string; category: string; reason: string; reminderId?: string };
};

export type RecommendationPolicy = Readonly<{
  key: string;
  version: string;
  category: RecommendationCategory;
  tier: number;
  requiredEvidence: readonly (readonly RecommendationSourceType[])[];
  freshnessMs: number;
  expiryMs: number;
  defaultCooldownMs: number | null;
  allowedActionIntents: readonly RecommendationAction['intent'][];
  template: Readonly<{ title: string }>;
  generate: (snapshot: RecommendationContextSnapshot, context: EvaluationContext) => RecommendationCandidate[];
}>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const comparableWellbeingTypes = new Set(['appetite', 'energy', 'mood', 'stool', 'sleep']);

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
}

function future(now: Date, durationMs: number) {
  return new Date(now.getTime() + durationMs).toISOString();
}

function explicitEvidence(sourceId: string, capturedAt: string, excerpt: string): RecommendationEvidence {
  return { sourceType: 'explicit_request', sourceId, capturedAt, ownerConfirmed: true, excerpt: excerpt.slice(0, 160) };
}

function candidate(input: {
  snapshot: RecommendationContextSnapshot;
  scenarioKey: string;
  policyVersion: string;
  category: RecommendationCategory;
  risk: 'routine' | 'caution';
  subjectId: string;
  normalizedReason: string;
  freshUntil: string;
  expiresAt: string;
  evidence: RecommendationEvidence[];
  tier: number;
  urgency: number;
  relevance: number;
  title: string;
  whyNow: string[];
  limitation?: string;
  primaryAction: RecommendationAction;
}): RecommendationCandidate {
  return {
    petId: input.snapshot.petId,
    scenarioKey: input.scenarioKey,
    policyVersion: input.policyVersion,
    category: input.category,
    risk: input.risk,
    subjectId: input.subjectId,
    normalizedReason: normalize(input.normalizedReason),
    freshUntil: input.freshUntil,
    expiresAt: input.expiresAt,
    evidence: input.evidence,
    missingData: [],
    conflicts: [],
    suppressionReasons: [],
    confidence: { dataSufficiency: 'high', sourceReliability: 'high', ruleCertainty: 'high' },
    rank: {
      tier: input.tier,
      urgency: input.urgency,
      actionability: 100,
      relevance: input.relevance,
      annoyancePenalty: 0,
    },
    title: input.title,
    whyNow: input.whyNow,
    limitation: input.limitation,
    primaryAction: input.primaryAction,
  };
}

function careDue(snapshot: RecommendationContextSnapshot, context: EvaluationContext) {
  const upcomingBoundary = context.now.getTime() + 7 * DAY;
  return snapshot.reminders.flatMap((reminder) => {
    const dueTime = Date.parse(reminder.snoozedUntil ?? reminder.dueAt);
    if (!['active', 'snoozed'].includes(reminder.status) || !Number.isFinite(dueTime) || dueTime > upcomingBoundary) return [];
    const overdue = dueTime < context.now.getTime();
    const dueLabel = new Date(dueTime).toISOString().slice(0, 10);
    return [candidate({
      snapshot, scenarioKey: 'care_due', policyVersion: 'care_due@1', category: 'care', risk: 'routine',
      subjectId: reminder.id, normalizedReason: `${reminder.type}:${new Date(dueTime).toISOString()}`,
      freshUntil: future(context.now, DAY), expiresAt: future(context.now, 2 * DAY),
      evidence: [reminder.evidence], tier: overdue ? 2 : 3,
      urgency: overdue ? 100 : Math.max(1, 90 - Math.floor((dueTime - context.now.getTime()) / HOUR)),
      relevance: 100, title: overdue ? `Проверить просроченное дело: ${reminder.title}` : `Скоро: ${reminder.title}`,
      whyNow: [`Срок — ${dueLabel}`], primaryAction: { intent: 'open_reminder', reminderId: reminder.id },
    })];
  });
}

function comparableChanges(snapshot: RecommendationContextSnapshot, now: Date) {
  const freshBoundary = now.getTime() - DAY;
  const eligible = snapshot.observations
    .filter((item) => item.sufficient && item.evidence.ownerConfirmed && item.value && comparableWellbeingTypes.has(item.type))
    .sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt));
  return eligible.flatMap((latest) => {
    if (Date.parse(latest.observedAt) < freshBoundary) return [];
    const previous = eligible.find((item) => item.id !== latest.id && item.type === latest.type && item.value !== latest.value);
    return previous ? [{ latest, previous }] : [];
  }).filter((pair, index, all) => all.findIndex((item) => item.latest.type === pair.latest.type) === index);
}

function wellbeingChange(snapshot: RecommendationContextSnapshot, context: EvaluationContext) {
  return comparableChanges(snapshot, context.now).map(({ latest, previous }) => candidate({
    snapshot, scenarioKey: 'wellbeing_change', policyVersion: 'wellbeing_change@1', category: 'wellbeing', risk: 'caution',
    subjectId: latest.id, normalizedReason: `${latest.type}:${latest.value}:${previous.value}`,
    freshUntil: future(context.now, 12 * HOUR), expiresAt: future(context.now, DAY),
    evidence: [latest.evidence, previous.evidence], tier: 2, urgency: 90, relevance: 100,
    title: 'Проверить изменение самочувствия',
    whyNow: [`Новое наблюдение: ${latest.evidence.excerpt ?? latest.value}`],
    limitation: 'Это наблюдение, а не диагноз.',
    primaryAction: { intent: 'open_health', observationId: latest.id },
  }));
}

function habitExplicitGoal(snapshot: RecommendationContextSnapshot, context: EvaluationContext) {
  const goal = context.explicitGoal;
  if (!goal || !goal.requestId.trim() || !goal.title.trim() || !goal.kind.trim()) return [];
  if (!['daily', 'weekly'].includes(goal.cadence) || !Number.isInteger(goal.targetPerPeriod) || goal.targetPerPeriod < 1) return [];
  const sameHabit = snapshot.habits.some((habit) => habit.status === 'active'
    && normalize(habit.kind) === normalize(goal.kind)
    && normalize(habit.title) === normalize(goal.title));
  if (sameHabit || comparableChanges(snapshot, context.now).length > 0) return [];
  const requestEvidence = explicitEvidence(goal.requestId, snapshot.capturedAt, goal.title);
  return [candidate({
    snapshot, scenarioKey: 'habit_explicit_goal', policyVersion: 'habit_explicit_goal@1', category: 'habit', risk: 'routine',
    subjectId: goal.requestId, normalizedReason: `${goal.kind}:${goal.title}:${goal.cadence}:${goal.targetPerPeriod}`,
    freshUntil: future(context.now, 3 * DAY), expiresAt: future(context.now, 7 * DAY), evidence: [requestEvidence],
    tier: 4, urgency: 40, relevance: 100, title: `Начать короткую привычку: ${goal.title}`,
    whyNow: ['Вы сами выбрали эту цель'],
    primaryAction: { intent: 'open_habits', draft: {
      kind: goal.kind, title: goal.title.trim(), cadence: goal.cadence, targetPerPeriod: goal.targetPerPeriod,
    } },
  })];
}

function walkWithConstraints(snapshot: RecommendationContextSnapshot, context: EvaluationContext) {
  if (!context.walk?.requestId.trim()) return [];
  const riskZones = snapshot.zones.filter((zone) => zone.type === 'risk_zone');
  const requestEvidence = explicitEvidence(context.walk.requestId, snapshot.capturedAt, 'Запрос на прогулку');
  const constraints = [
    ...riskZones.map((zone) => zone.evidence),
    ...(snapshot.social?.triggers.length ? [snapshot.social.evidence] : []),
  ];
  const zoneIds = riskZones.map((zone) => zone.id).sort();
  return [candidate({
    snapshot, scenarioKey: 'walk_with_constraints', policyVersion: 'walk_with_constraints@1', category: 'walk', risk: 'routine',
    subjectId: context.walk.requestId, normalizedReason: `walk:${zoneIds.join(',')}:${snapshot.social?.triggers.join(',') ?? ''}`,
    freshUntil: future(context.now, 6 * HOUR), expiresAt: future(context.now, 12 * HOUR),
    evidence: [requestEvidence, ...constraints], tier: 4, urgency: 50, relevance: 100,
    title: 'Спланировать прогулку с учётом ограничений',
    whyNow: constraints.length ? ['Учтены ваши отметки и триггеры'] : ['Вы открыли планирование прогулки'],
    limitation: 'Псё не подтверждает безопасность маршрута.',
    primaryAction: { intent: 'plan_walk', zoneIds, limitation: 'route_not_verified_safe' },
  })];
}

function thingForTask(snapshot: RecommendationContextSnapshot, context: EvaluationContext) {
  const thing = context.thing;
  if (!thing || !thing.requestId.trim() || !thing.title.trim() || !thing.category.trim() || !thing.reason.trim()) return [];
  const title = normalize(thing.title);
  const category = normalize(thing.category);
  const reason = normalize(thing.reason);
  const blocked = snapshot.wishlist.some((item) => ['bought', 'not_suitable'].includes(item.status)
    && normalize(item.title) === title
    && normalize(item.category) === category
    && normalize(item.reason ?? '') === reason);
  if (blocked) return [];
  const reminder = thing.reminderId ? snapshot.reminders.find((item) => item.id === thing.reminderId) : undefined;
  const sourceEvidence = reminder?.evidence ?? explicitEvidence(thing.requestId, snapshot.capturedAt, thing.reason);
  return [candidate({
    snapshot, scenarioKey: 'thing_for_task', policyVersion: 'thing_for_task@1', category: 'thing', risk: 'routine',
    subjectId: thing.requestId, normalizedReason: `${category}:${title}:${reason}`,
    freshUntil: future(context.now, 3 * DAY), expiresAt: future(context.now, 7 * DAY), evidence: [sourceEvidence],
    tier: 5, urgency: reminder ? 60 : 30, relevance: 100, title: `Добавить в список: ${thing.title.trim()}`,
    whyNow: [`Для задачи: ${thing.reason.trim()}`],
    primaryAction: { intent: 'add_wishlist', draft: {
      title: thing.title.trim(), category: thing.category.trim(), reason: thing.reason.trim(),
    } },
  })];
}

function socialContactAllowed(snapshot: RecommendationContextSnapshot) {
  return !['do_not_approach', 'known_only'].includes(snapshot.social?.socialMode ?? '')
    && snapshot.social?.dogFriendly !== 'no';
}

function gavIncomingRequest(snapshot: RecommendationContextSnapshot, context: EvaluationContext) {
  return snapshot.socialRequests.filter((request) => request.status === 'pending').map((request) => candidate({
    snapshot, scenarioKey: 'gav_incoming_request', policyVersion: 'gav_incoming_request@1', category: 'social', risk: 'routine',
    subjectId: request.id, normalizedReason: `${request.scenario}:${request.source}:${request.createdAt}`,
    freshUntil: future(context.now, 12 * HOUR), expiresAt: future(context.now, DAY), evidence: [request.evidence],
    tier: 1, urgency: 95, relevance: 100, title: 'В Гав ждёт новый отклик',
    whyNow: ['Другой владелец ждёт вашего решения'],
    limitation: 'Контакт откроется только после взаимного согласия.',
    primaryAction: { intent: 'open_gav', view: 'requests', requestId: request.id },
  }));
}

function gavNearbySignal(snapshot: RecommendationContextSnapshot, context: EvaluationContext) {
  if (!socialContactAllowed(snapshot)) return [];
  return snapshot.walkSignals.flatMap((signal) => {
    const expiresAt = Date.parse(signal.expiresAt);
    const startsAt = Date.parse(signal.startsAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= context.now.getTime() || signal.dogFriendly === 'no') return [];
    if (snapshot.social?.socialMode === 'calm_dogs_only' && signal.temperament !== 'calm') return [];
    const freshUntil = new Date(Math.min(expiresAt, context.now.getTime() + 2 * HOUR)).toISOString();
    return [candidate({
      snapshot, scenarioKey: 'gav_nearby_signal', policyVersion: 'gav_nearby_signal@1', category: 'social', risk: 'routine',
      subjectId: signal.id, normalizedReason: `${signal.petId}:${signal.startsAt}:${signal.pace}`,
      freshUntil, expiresAt: signal.expiresAt, evidence: [signal.evidence], tier: 3,
      urgency: Number.isFinite(startsAt) && startsAt <= context.now.getTime() + 30 * 60_000 ? 90 : 70,
      relevance: 100, title: `${signal.name} дала Гав рядом`,
      whyNow: ['Сигнал активен недалеко от вашего района'],
      limitation: 'Место показано приблизительно. Условия встречи решают владельцы.',
      primaryAction: { intent: 'open_gav', view: 'live_signal', signalId: signal.id },
    })];
  });
}

function gavStartSignal(snapshot: RecommendationContextSnapshot, context: EvaluationContext) {
  const discovery = snapshot.socialDiscovery;
  if (!discovery?.hasCoarseLocation || discovery.ownSignalActive || !discovery.scenarios.includes('walk') || !socialContactAllowed(snapshot)) return [];
  const walkHabit = snapshot.habits.find((habit) => habit.status === 'active' && habit.kind === 'walk');
  if (!walkHabit) return [];
  return [candidate({
    snapshot, scenarioKey: 'gav_start_signal', policyVersion: 'gav_start_signal@1', category: 'social', risk: 'routine',
    subjectId: walkHabit.id, normalizedReason: `${walkHabit.id}:${discovery.city}`,
    freshUntil: future(context.now, 12 * HOUR), expiresAt: future(context.now, DAY),
    evidence: [walkHabit.evidence, discovery.evidence], tier: 4, urgency: 45, relevance: 85,
    title: 'Позвать компанию на прогулку',
    whyNow: [`У вас есть привычка «${walkHabit.title}»`],
    limitation: 'Гав показывает только примерный район и автоматически исчезает.',
    primaryAction: { intent: 'open_gav', view: 'give_signal' },
  })];
}

function freezePolicy(policy: RecommendationPolicy): RecommendationPolicy {
  Object.freeze(policy.requiredEvidence);
  Object.freeze(policy.allowedActionIntents);
  Object.freeze(policy.template);
  return Object.freeze(policy);
}

function evidenceAlternatives(...sources: RecommendationSourceType[]): readonly (readonly RecommendationSourceType[])[] {
  return Object.freeze(sources.map((source) => Object.freeze([source])));
}

export const PHASE_ZERO_POLICIES = Object.freeze([
  freezePolicy({
    key: 'care_due', version: 'care_due@1', category: 'care', tier: 2,
    requiredEvidence: evidenceAlternatives('reminder'), freshnessMs: DAY, expiryMs: 2 * DAY, defaultCooldownMs: DAY,
    allowedActionIntents: ['open_reminder'], template: Object.freeze({ title: 'Проверить дело ухода' }), generate: careDue,
  }),
  freezePolicy({
    key: 'wellbeing_change', version: 'wellbeing_change@1', category: 'wellbeing', tier: 2,
    requiredEvidence: evidenceAlternatives('observation'), freshnessMs: 12 * HOUR, expiryMs: DAY, defaultCooldownMs: null,
    allowedActionIntents: ['open_health'], template: Object.freeze({ title: 'Проверить изменение самочувствия' }), generate: wellbeingChange,
  }),
  freezePolicy({
    key: 'habit_explicit_goal', version: 'habit_explicit_goal@1', category: 'habit', tier: 4,
    requiredEvidence: evidenceAlternatives('explicit_request'), freshnessMs: 3 * DAY, expiryMs: 7 * DAY, defaultCooldownMs: 30 * DAY,
    allowedActionIntents: ['open_habits'], template: Object.freeze({ title: 'Начать короткую привычку' }), generate: habitExplicitGoal,
  }),
  freezePolicy({
    key: 'walk_with_constraints', version: 'walk_with_constraints@1', category: 'walk', tier: 4,
    requiredEvidence: evidenceAlternatives('explicit_request'), freshnessMs: 6 * HOUR, expiryMs: 12 * HOUR, defaultCooldownMs: 12 * HOUR,
    allowedActionIntents: ['plan_walk'], template: Object.freeze({ title: 'Спланировать прогулку' }), generate: walkWithConstraints,
  }),
  freezePolicy({
    key: 'thing_for_task', version: 'thing_for_task@1', category: 'thing', tier: 5,
    requiredEvidence: evidenceAlternatives('explicit_request', 'reminder'), freshnessMs: 3 * DAY, expiryMs: 7 * DAY, defaultCooldownMs: 30 * DAY,
    allowedActionIntents: ['add_wishlist'], template: Object.freeze({ title: 'Добавить вещь для задачи' }), generate: thingForTask,
  }),
  freezePolicy({
    key: 'gav_incoming_request', version: 'gav_incoming_request@1', category: 'social', tier: 1,
    requiredEvidence: evidenceAlternatives('social_request'), freshnessMs: 12 * HOUR, expiryMs: DAY, defaultCooldownMs: 12 * HOUR,
    allowedActionIntents: ['open_gav'], template: Object.freeze({ title: 'Ответить в Гав' }), generate: gavIncomingRequest,
  }),
  freezePolicy({
    key: 'gav_nearby_signal', version: 'gav_nearby_signal@1', category: 'social', tier: 3,
    requiredEvidence: evidenceAlternatives('social_signal'), freshnessMs: 2 * HOUR, expiryMs: 3 * HOUR, defaultCooldownMs: 2 * HOUR,
    allowedActionIntents: ['open_gav'], template: Object.freeze({ title: 'Открыть Гав рядом' }), generate: gavNearbySignal,
  }),
  freezePolicy({
    key: 'gav_start_signal', version: 'gav_start_signal@1', category: 'social', tier: 4,
    requiredEvidence: Object.freeze([Object.freeze(['habit', 'profile'] as const)]), freshnessMs: 12 * HOUR, expiryMs: DAY, defaultCooldownMs: DAY,
    allowedActionIntents: ['open_gav'], template: Object.freeze({ title: 'Дать Гав' }), generate: gavStartSignal,
  }),
] satisfies readonly RecommendationPolicy[]);
