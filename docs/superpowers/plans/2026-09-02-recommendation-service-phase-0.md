# Recommendation Service Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Построить выключенный по умолчанию deterministic foundation сервиса рекомендаций: owner-scoped хранилище, контракты, allowlisted context snapshot, versioned policies, eligibility/safety/ranking, lifecycle API и проверяемые события результата — без пользовательской карточки и без клинических порогов.

**Architecture:** Recommendation Engine остаётся отдельным server-only модулем и не зависит от LLM/AssistantService. Он получает минимальный allowlisted snapshot, запускает зарегистрированные policy-функции, применяет жёсткие gates, стабильный tiered ranking и сохраняет результат через owner-scoped repository. Phase 0 работает только через закрытый API/feature flag; экран «Всё» подключается в Phase 1.

**Tech Stack:** Next.js 16 App Router, TypeScript 5.4, React 19, Supabase/PostgreSQL с RLS, Vitest 3, Node test fixtures, существующие `getRequestAuth` + `getAppSessionFromRequest`.

## Global Constraints

- Источник истины: `docs/recommendation-service-logic-v1.md`.
- Никакая рекомендация не создаётся из свободного текста LLM.
- Главная поверхность будущего показа — «Всё»; ассистент не делает проактивных показов.
- В Phase 0 нет UI-карточки, production rollout и конкретных clinical thresholds.
- До утверждения veterinary safety pack health-кандидат имеет максимум `caution` и нейтральный маршрут `open_health`.
- Один recommendation object содержит одно `primaryAction`; snooze/dismiss — lifecycle controls.
- `safety_override` не подчиняется общей настройке routine-категории, но в Phase 0 не генерируется.
- API никогда не принимает `ownerId` как доверенный клиентский факт.
- Evidence не хранит точные координаты, контакты, микрочип, фото, полный текст документов или сырые строки БД.
- Любая мутация lifecycle требует `Idempotency-Key` длиной 8–128 символов.
- Feature flag: `RECOMMENDATIONS_FOUNDATION_ENABLED=false` по умолчанию; при `false` публичный API возвращает `404 RECOMMENDATIONS_DISABLED`.

---

## Locked file map

Создаются:

- `supabase/migrations/20260902150000_recommendation_foundation.sql` — таблицы, constraints, индексы, RLS и atomic lifecycle RPC.
- `packages/recommendations/contracts.ts` — канонические DTO/type unions и runtime validators.
- `lib/server/recommendations/contextSnapshot.ts` — owner-scoped загрузка и allowlist/provenance.
- `lib/server/recommendations/policyRegistry.ts` — immutable registry версий и параметры пяти сценариев.
- `lib/server/recommendations/policies.ts` — чистые deterministic candidate builders.
- `lib/server/recommendations/engine.ts` — gates, fingerprint, cooldown, ranking, orchestration.
- `lib/server/recommendations/repository.ts` — единственное место SQL/Supabase persistence.
- `lib/server/recommendations/lifecycle.ts` — валидные state transitions и action-outcome mapping.
- `app/api/recommendations/route.ts` — `GET` списка/главного слота и `POST` recalculation.
- `app/api/recommendations/[id]/route.ts` — snooze/dismiss/accept lifecycle endpoint.
- `app/api/recommendations/[id]/outcome/route.ts` — idempotent domain outcome endpoint.
- `scripts/qa/recommendation-contracts.behavior.test.ts` — DTO/validation/fingerprint tests.
- `scripts/qa/recommendation-storage.behavior.test.ts` — статический schema/RLS/RPC contract, выполняемый без локального Postgres.
- `scripts/qa/recommendation-engine.behavior.test.ts` — fixtures пяти сценариев и 12 PRD acceptance criteria.
- `scripts/qa/recommendation-routes.behavior.test.ts` — auth, ownership, flag и idempotency characterization.
- `scripts/qa/check-recommendation-foundation-contract.mjs` — статический production contract gate.
- `supabase/tests/recommendation_foundation.sql` — pgTAP/RLS/atomic transition tests.

Изменяются:

- `packages/contracts/index.ts` — только re-export recommendation contracts; существующие assistant contracts не объединять с engine.
- `app/api/reminders/[id]/complete/route.ts` — после успешного domain result передавать outcome-link, если пришёл `recommendationId`.
- `app/api/habits/[id]/checkins/route.ts` — тот же outcome-link для check-in.
- `app/api/wishlist/route.ts` — тот же outcome-link после созданной вещи.
- `app/api/map/features/route.ts` — outcome-link только после реального старта/сохранения маршрута, не после открытия карты.
- `package.json` — добавить recommendation contract gate в `qa:contracts`.
- `.env.example` — документировать выключенный flag.

Не изменяются в Phase 0:

- `components/home/AllFunctionsHub.tsx`, `components/today/NextCareCard.tsx`, `app/page.tsx`;
- `app/api/assistant/route.ts`, `lib/server/assistantAnswerService.ts`;
- текущий hardcoded red-flag scaffold ассистента.

---

### Task 1: Канонические контракты и runtime validation

**Files:**
- Create: `packages/recommendations/contracts.ts`
- Modify: `packages/contracts/index.ts`
- Test: `scripts/qa/recommendation-contracts.behavior.test.ts`

**Interfaces:**
- Produces: `Recommendation`, `RecommendationEvidence`, `RecommendationAction`, `RecommendationCandidate`, `RecommendationContextSnapshot`, `RecommendationDecision`, `RecommendationLifecycleCommand`, `parseLifecycleCommand`.
- Consumes: только primitive TypeScript types; никаких imports из server/UI.

- [x] **Step 1: Write failing contract tests**

Проверить точные unions:

```ts
assert.deepEqual(parseLifecycleCommand({ action: 'snooze', until: '2026-09-03T12:00:00Z' }), {
  ok: true,
  value: { action: 'snooze', until: '2026-09-03T12:00:00.000Z' },
});
assert.equal(parseLifecycleCommand({ action: 'snooze', until: 'bad' }).ok, false);
assert.equal(parseLifecycleCommand({ action: 'dismiss', reason: 'unknown' }).ok, false);
assert.equal(parseLifecycleCommand({ action: 'complete' }).ok, false);
```

- [x] **Step 2: Run the test and verify RED**

Run: `npx tsx scripts/qa/recommendation-contracts.behavior.test.ts`
Expected: FAIL because `packages/recommendations/contracts.ts` does not exist.

- [x] **Step 3: Define exact public types**

Implement these stable unions:

```ts
export type RecommendationCategory = 'care' | 'wellbeing' | 'habit' | 'walk' | 'thing';
export type RecommendationRisk = 'routine' | 'caution' | 'safety_override';
export type RecommendationStatus =
  | 'candidate' | 'eligible' | 'suppressed' | 'shown' | 'accepted'
  | 'snoozed' | 'dismissed' | 'completed' | 'expired' | 'superseded' | 'failed';
export type SuppressionReason =
  | 'missing_evidence' | 'stale_evidence' | 'owner_unconfirmed'
  | 'category_disabled' | 'duplicate' | 'cooldown' | 'conflict'
  | 'action_unavailable' | 'safety_pack_unavailable';
export type DismissReason = 'not_relevant' | 'already_done' | 'wrong_data' | 'never_suggest';
export type RecommendationAction =
  | { intent: 'open_reminder'; reminderId: string }
  | { intent: 'open_health'; observationId?: string }
  | { intent: 'open_habits'; draft?: { kind: string; title: string; cadence: 'daily' | 'weekly'; targetPerPeriod: number } }
  | { intent: 'plan_walk'; zoneIds: string[]; limitation: 'route_not_verified_safe' }
  | { intent: 'add_wishlist'; draft: { title: string; category: string; reason: string } };
```

`RecommendationEvidence.excerpt` ограничить 160 символами; `whyNow` — 1–2 строками по 160 символов; DTO не содержит `ownerId` в mutation body.

- [x] **Step 4: Re-export without merging Assistant types**

В `packages/contracts/index.ts` добавить:

```ts
export type {
  Recommendation,
  RecommendationAction,
  RecommendationDecision,
  RecommendationLifecycleCommand,
} from '../recommendations/contracts';
```

- [x] **Step 5: Verify GREEN and commit**

Run: `npx tsx scripts/qa/recommendation-contracts.behavior.test.ts`
Expected: PASS.
Commit: `git commit -m "feat(recommendations): define phase zero contracts"`

---

### Task 2: PostgreSQL storage, RLS and atomic lifecycle ledger

**Files:**
- Create: `supabase/migrations/20260902150000_recommendation_foundation.sql`
- Create: `supabase/tests/recommendation_foundation.sql`
- Create: `scripts/qa/recommendation-storage.behavior.test.ts`

**Interfaces:**
- Produces tables: `recommendations`, `recommendation_evidence`, `recommendation_events`, `recommendation_preferences`, `recommendation_mutations`.
- Produces RPC: `recommendation_transition_atomic(owner, key, fingerprint, recommendation, action, payload)`.

- [x] **Step 1: Write failing database assertions**

Test owner A can read and atomically transition only recommendations for owner A's pet; owner B sees zero rows. Test duplicate `(pet_id, fingerprint, active)` cannot create two active records. Test replay of the same idempotency key returns the same response; changed fingerprint raises `IDEMPOTENCY_KEY_REUSED`.

- [x] **Step 2: Run static storage contract and verify RED**

Run: `npx tsx scripts/qa/recommendation-storage.behavior.test.ts`
Expected: FAIL because the recommendation migration does not exist. The executable SQL suite remains the final database gate.

- [x] **Step 3: Create constrained tables**

Required columns:

```sql
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  scenario_key text not null,
  policy_version text not null,
  category text not null check (category in ('care','wellbeing','habit','walk','thing')),
  risk text not null check (risk in ('routine','caution','safety_override')),
  status text not null check (status in (
    'candidate','eligible','suppressed','shown','accepted','snoozed',
    'dismissed','completed','expired','superseded','failed'
  )),
  fingerprint text not null check (length(fingerprint) = 64),
  title text not null check (length(title) between 1 and 120),
  why_now jsonb not null default '[]'::jsonb,
  limitation text,
  primary_action jsonb not null,
  confidence jsonb not null,
  rank jsonb not null,
  suppression_reasons text[] not null default '{}',
  fresh_until timestamptz not null,
  expires_at timestamptz not null,
  snoozed_until timestamptz,
  shown_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at >= fresh_until),
  check (owner_id = public.pet_owner_id(pet_id))
);
```

Связь `owner_id ↔ pet_id` проверять server-side trigger-функцией `recommendation_enforce_pet_owner()` с `security definer` и пустым `search_path`; не дублировать owner lookup в клиенте. Evidence хранит `source_type`, `source_id`, времена, `owner_confirmed`, `input_confidence`, `excerpt`; events — `from_status`, `to_status`, `event_type`, sanitized `payload`.

- [x] **Step 4: Add indexes and partial uniqueness**

```sql
create unique index recommendations_active_fingerprint_uidx
  on public.recommendations(pet_id, fingerprint)
  where status in ('candidate','eligible','shown','accepted','snoozed');
create index recommendations_main_slot_idx
  on public.recommendations(owner_id, pet_id, status, risk, expires_at);
create index recommendation_events_audit_idx
  on public.recommendation_events(recommendation_id, created_at);
```

- [x] **Step 5: Add RLS and grants**

Enable RLS on all five tables. Policies derive ownership through `auth.uid()` and pet ownership. Revoke direct client insert/update/delete on recommendation/events/mutations; mutations go through the atomic RPC. Preferences may be changed owner-scoped.

- [x] **Step 6: Implement legal atomic transitions**

Allowed transitions:

```text
eligible -> shown | suppressed | expired | superseded
shown -> accepted | snoozed | dismissed | expired | superseded
accepted -> completed | failed | superseded
snoozed -> eligible | dismissed | expired | superseded
```

Reject every other transition with `INVALID_RECOMMENDATION_TRANSITION`. Lock by `(owner_id,idempotency_key)`, verify pet ownership inside the transaction, update row and append exactly one event.

- [x] **Step 7: Verify GREEN and commit**

Локальный статус 2026-09-02: миграция успешно применена с нуля через `supabase db reset`; динамический pgTAP suite прошёл 4/4 на локальном Supabase/Postgres. Storage foundation сохранён в `a5093a4`, исправление исполнимого SQL test harness — в следующем verification commit.

Run: `supabase db reset && supabase test db supabase/tests/recommendation_foundation.sql`
Expected: migration applies; all assertions PASS.
Commit: `git commit -m "feat(recommendations): add owner scoped lifecycle storage"`

---

### Task 3: Allowlisted context snapshot

**Files:**
- Create: `lib/server/recommendations/contextSnapshot.ts`
- Test: `scripts/qa/recommendation-engine.behavior.test.ts`

**Interfaces:**
- Produces: `loadRecommendationContext(input: { supabase; ownerId: string; petId: string; now: Date }): Promise<RecommendationContextSnapshot>`.
- Consumes existing tables: pets, pet_passports, social_profiles, reminders, pet_observations, pet_habits, map_zones, wishlist_items.

- [x] **Step 1: Write failing privacy/ownership tests**

Fixture must contain contacts, microchip, exact coordinates, photos and document content. Assert serialized snapshot does not contain those values and an unowned `petId` throws `PET_NOT_FOUND`.

- [x] **Step 2: Run and verify RED**

Run: `node_modules/.bin/tsx scripts/qa/recommendation-engine.behavior.test.ts`
Expected: FAIL because loader does not exist.

- [x] **Step 3: Implement one owner check and bounded parallel reads**

First query: `pets.select('id,owner_id,life_stage,weight_kg,breed_id,breed_group_id').eq('id',petId).eq('owner_id',ownerId).maybeSingle()`. Only after success run domain reads. Observations: active only, newest 20; reminders: non-done; habits: active; zones: owner-authored risk/place metadata without geometry; wishlist: active plus `bought/not_suitable` identities needed for suppression.

- [x] **Step 4: Map every fact to provenance**

Each fact returns `{ sourceType, sourceId, capturedAt, observedAt?, dueAt?, updatedAt?, ownerConfirmed, inputConfidence?, excerpt? }`. For voice observations, accept only `metadata.ownerConfirmed === true`, numeric `metadata.inputConfidence >= 0.8` and an excerpt; otherwise mark insufficient and never copy raw note.

- [x] **Step 5: Verify GREEN and commit**

Run: `node_modules/.bin/tsx scripts/qa/recommendation-engine.behavior.test.ts && npm test`
Expected: focused snapshot tests and full suite PASS, including privacy denylist.
Commit: `git commit -m "feat(recommendations): build privacy scoped context snapshot"`

---

### Task 4: Versioned policy registry and five candidate builders

**Files:**
- Create: `lib/server/recommendations/policyRegistry.ts`
- Create: `lib/server/recommendations/policies.ts`
- Test: `scripts/qa/recommendation-engine.behavior.test.ts`

**Interfaces:**
- Produces: `getPolicy(key, version?)`, `listActivePolicies()`, `buildCandidates(snapshot, requestContext)`.
- Policy signature: `(snapshot: RecommendationContextSnapshot, context: EvaluationContext) => RecommendationCandidate[]`.

- [x] **Step 1: Add failing registry immutability/version tests**

Assert exact active keys and versions:

```ts
assert.deepEqual(listActivePolicies().map(({ key, version }) => [key, version]), [
  ['care_due', 'care_due@1'],
  ['wellbeing_change', 'wellbeing_change@1'],
  ['habit_explicit_goal', 'habit_explicit_goal@1'],
  ['walk_with_constraints', 'walk_with_constraints@1'],
  ['thing_for_task', 'thing_for_task@1'],
]);
```

- [x] **Step 2: Implement readonly registry**

Each entry defines `category`, `tier`, required evidence, freshness, expiry, default cooldown, allowed action intents, template copy and generator. `Object.freeze` registry and entries. Do not add a red-flag policy.

- [x] **Step 3: Implement candidate rules**

- `care_due@1`: overdue/upcoming active reminder; primary action `open_reminder`.
- `wellbeing_change@1`: owner-confirmed comparable observation; never diagnoses; `risk='caution'`; expiry 24h; action `open_health`.
- `habit_explicit_goal@1`: only `requestContext.explicitGoal`; suppress if equivalent active habit or fresh wellbeing caution.
- `walk_with_constraints@1`: only explicit request/open walk flow; risk-zone IDs without coordinates; limitation is mandatory.
- `thing_for_task@1`: explicit reason/reminder; category-level draft only; suppress matching `bought/not_suitable`.

- [x] **Step 4: Verify all scenario fixtures**

Run: `node_modules/.bin/tsx scripts/qa/recommendation-engine.behavior.test.ts`
Expected: each positive fixture creates one candidate; breed-only habit, unconfirmed health, no-reason thing and passive walk create none.
Commit: `git commit -m "feat(recommendations): add versioned phase zero policies"`

---

### Task 5: Deterministic gates, SHA-256 fingerprint, cooldown and ranking

**Files:**
- Create: `lib/server/recommendations/engine.ts`
- Test: `scripts/qa/recommendation-engine.behavior.test.ts`

**Interfaces:**
- Produces: `evaluateRecommendations(input): RecommendationDecision[]`, `selectMainRecommendation(decisions)`, `recommendationFingerprint(candidate)`.
- Consumes registry candidates and persisted state/preferences supplied as values; pure core performs no database calls.

- [x] **Step 1: Write failing PRD acceptance tests 1–5, 7–12**

Name tests by criterion, e.g. `AC01 keeps one active fingerprint`, `AC03 safety override occupies main slot`, `AC11 ignores LLM availability`. Inject `now`; never call real clock in pure functions.

- [x] **Step 2: Implement hard gates in fixed order**

```ts
const GATE_ORDER = [
  'ownership', 'required_evidence', 'freshness', 'owner_confirmation',
  'conflict', 'action_available', 'preference', 'dedup', 'cooldown',
] as const;
```

First failure yields a structured suppression reason. Persist all evaluated candidates for audit, but only `eligible` may rank.

- [x] **Step 3: Implement canonical SHA-256 fingerprint**

Hash stable JSON of `{ petId, scenarioKey, subjectId, normalizedReason, policyVersion }`; trim/lowercase reason, collapse whitespace, sort object keys. Never use `JSON.stringify` on unordered raw DB objects.

- [x] **Step 4: Implement cooldown precedence**

Explicit `snoozedUntil` wins. Then preference disable for routine. Then scenario defaults: care 24h, wellbeing until changed/superseded, habit 30d after dismiss, walk 12h/session, thing 30d dismiss/7d snooze/permanent same-reason suppression after bought/not_suitable.

- [x] **Step 5: Implement tiered stable ranking**

Sort by: `risk=safety_override` first; then policy tier asc; urgency desc; actionability desc; relevance desc; annoyance penalty asc; due time asc; signal time desc; id asc. A numeric component cannot cross tier.

- [x] **Step 6: Verify deterministic replay**

Run the same fixture 100 times with shuffled input order. Expected: identical decisions, fingerprints and main recommendation.
Commit: `git commit -m "feat(recommendations): add deterministic gates and ranking"`

---

### Task 6: Repository and orchestration service

**Files:**
- Create: `lib/server/recommendations/repository.ts`
- Create: `lib/server/recommendations/lifecycle.ts`
- Test: `scripts/qa/recommendation-engine.behavior.test.ts`

**Interfaces:**
- Produces: `recalculateForPet`, `listForPet`, `transitionForOwner`, `recordOutcomeForOwner`.
- Consumes: context loader, engine, Supabase client, injected clock.

- [x] **Step 1: Write failing repository tests with an in-memory adapter**

Cover upsert-by-active-fingerprint, supersede on changed subject fact/policy version, no completion on failed outcome, domain completion outside the card and deletion of recommendation history without deleting domain sources.

- [x] **Step 2: Implement repository boundary**

Repository accepts `ownerId` from server auth only. `recalculateForPet` loads preferences and active history, evaluates, upserts recommendation/evidence in one server transaction/RPC and returns `{ main, secondary: secondary.slice(0,2), evaluatedAt }`.

- [x] **Step 3: Implement lifecycle state machine**

`snooze` requires future `until`; `dismiss` requires a reason; `accept` does not imply completed. `already_done` records feedback and asks the domain adapter to verify/synchronize. `wrong_data` returns the source ref needed for correction. `never_suggest` writes routine preference; reject for safety override.

- [x] **Step 4: Implement domain outcome mapping**

```ts
export type RecommendationOutcome = {
  recommendationId: string;
  domainType: 'reminder' | 'habit' | 'route' | 'wishlist';
  domainId: string;
  result: 'completed' | 'failed';
  occurredAt: string;
};
```

Validate that action intent matches domain type and target belongs to the same owner/pet. `failed` transitions accepted/shown to `failed`, never `completed`.

- [x] **Step 5: Verify and commit**

Run: `npx tsx --test scripts/qa/recommendation-engine.behavior.test.ts`
Expected: all 12 PRD criteria PASS.
Commit: `git commit -m "feat(recommendations): persist evaluation and lifecycle outcomes"`

Implementation note: the repository transaction is backed by
`20260902163000_recommendation_repository.sql`; its clean-reset pgTAP coverage lives in
`supabase/tests/recommendation_repository.sql`.

---

### Task 7: Authenticated hidden API and feature flag

**Files:**
- Create: `app/api/recommendations/route.ts`
- Create: `app/api/recommendations/[id]/route.ts`
- Create: `app/api/recommendations/[id]/outcome/route.ts`
- Create: `scripts/qa/recommendation-routes.behavior.test.ts`
- Modify: `.env.example`

**Interfaces:**
- `GET /api/recommendations?petId=` returns persisted active recommendations; no recalculation side effect.
- `POST /api/recommendations` body `{ petId, explicitRequest? }` recalculates.
- `PATCH /api/recommendations/:id` accepts validated lifecycle command.
- `POST /api/recommendations/:id/outcome` accepts validated domain outcome.

- [x] **Step 1: Write route characterization tests**

Test missing auth = 401; disabled flag = 404; missing/foreign pet = 404; malformed body = 400; missing/reused idempotency key = 400/409; storage unavailable = 503; success never exposes `owner_id`, raw evidence payload or coordinates.

- [x] **Step 2: Add the disabled-by-default flag**

`.env.example`:

```dotenv
RECOMMENDATIONS_FOUNDATION_ENABLED=false
```

Every route checks exact string `'true'` before auth/storage work and returns RFC7807 `problem('RECOMMENDATIONS_DISABLED', 404, ...)`.

- [x] **Step 3: Use the established auth boundary**

Resolve `ownerId = auth.user?.id ?? session?.ownerId`; obtain Supabase server client; do not read `ownerId` from query/body/header. Use `problem()` for every error.

- [x] **Step 4: Verify and commit**

Run: `npx vitest run scripts/qa/vitest/recommendation-routes.test.ts`
Expected: PASS.
Commit: `git commit -m "feat(recommendations): expose flagged owner scoped api"`

---

### Task 8: Link real domain outcomes without coupling domains to ranking

**Files:**
- Modify: `app/api/reminders/[id]/complete/route.ts`
- Modify: `app/api/habits/[id]/checkins/route.ts`
- Modify: `app/api/wishlist/route.ts`
- Modify: `app/api/map/features/route.ts`
- Test: `scripts/qa/recommendation-routes.behavior.test.ts`

**Interfaces:**
- Consumes optional `recommendationId` plus existing idempotency key.
- Produces an outcome event only after the existing domain mutation succeeds.

- [x] **Step 1: Add failing coupling tests**

Assert: domain success then outcome event; domain failure creates none; foreign recommendation cannot be linked; replay creates one outcome; opening map is not completion; route start/save is completion.

- [x] **Step 2: Add optional post-success hook**

Extract `linkRecommendationOutcome({ supabase, ownerId, recommendationId, domainType, domainId, result, idempotencyKey })`. Domain mutation remains source of truth. If linking fails after domain success, return domain success with `recommendationOutcome: 'pending'` and record retryable failure; never roll back or lie about the domain result.

- [x] **Step 3: Verify integration behavior**

Run: `npx vitest run scripts/qa/vitest/recommendation-routes.test.ts -t "domain outcome"`
Expected: PASS.
Commit: `git commit -m "feat(recommendations): connect verified domain outcomes"`

---

### Task 9: Quality gate, privacy contract and Phase 0 handoff

**Files:**
- Create: `scripts/qa/check-recommendation-foundation-contract.mjs`
- Modify: `package.json`
- Modify: `docs/recommendation-service-logic-v1.md` only if implementation reveals a contradicted assumption.

**Interfaces:**
- Produces: repeatable local gate included in `qa:contracts`.

- [ ] **Step 1: Create failing static contract gate**

Check required files, RLS tokens, active fingerprint unique index, server-only repository, feature flag default, five registered versions, absence of imports from assistant generation, absence of banned fields (`microchip`, `vet_contact`, geometry coordinates, document body) in snapshot/analytics.

- [ ] **Step 2: Add gate to package.json**

Append `node scripts/qa/check-recommendation-foundation-contract.mjs` to `qa:contracts`.

- [ ] **Step 3: Run focused verification**

```bash
npx vitest run scripts/qa/recommendation-contracts.behavior.test.ts \
  scripts/qa/recommendation-engine.behavior.test.ts \
  scripts/qa/recommendation-routes.behavior.test.ts
node scripts/qa/check-recommendation-foundation-contract.mjs
supabase test db supabase/tests/recommendation_foundation.sql
```

Expected: all PASS.

- [ ] **Step 4: Run full repository gate**

Run: `npm run qa:local`
Expected: lint within warning budget, all Vitest tests PASS, Next production build PASS, all contracts PASS.

- [ ] **Step 5: Perform manual security review**

Verify with two owners and two pets: cross-owner GET/PATCH/outcome returns 404; serialized API response contains no excluded privacy fields; disabled flag exposes no endpoint behavior; safety pack absence cannot produce `safety_override`; assistant output cannot mutate a policy decision.

- [ ] **Step 6: Record Phase 0 terminal state**

Phase 0 is complete only when:

1. migration and RLS tests pass;
2. all 12 PRD acceptance criteria pass deterministically;
3. API is owner-scoped and disabled by default;
4. five policy versions are registered, but no UI or production rollout is enabled;
5. real domain outcomes can close recommendations idempotently;
6. full `qa:local` passes.

Commit: `git commit -m "test(recommendations): gate phase zero foundation"`

---

## Vertical slice order

1. Contracts + storage: recommendation can exist safely, but nothing computes it.
2. Context + care policy: one overdue reminder evaluates deterministically end-to-end.
3. Lifecycle + outcome: care recommendation can be snoozed/dismissed/completed truthfully.
4. Remaining four candidate builders: fixtures only, still behind flag.
5. Hidden API + domain hooks: integration ready, UI still absent.
6. Full gate: Phase 0 foundation is shippable as dark infrastructure.

## Explicit Phase 1 boundary

Phase 1 begins only after this plan passes. It adds the actual main card to `AllFunctionsHub`, starts with `care_due@1` and neutral `wellbeing_change@1`, includes «Почему сейчас», «Позже», dismiss reasons and truthful action states, then performs a separate UI/accessibility/production rollout review. Veterinary `safety_override` remains blocked until the approved safety pack has an accountable owner and version.
