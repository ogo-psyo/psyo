# Псё P0 — Audit-Driven Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Выпустить закрытую Telegram Mini App Псё с ненавязчивым входом, безопасными личными данными и двумя реально работающими сценариями `рядом`.

**Architecture:** Сначала фиксируются identity, privacy и независимые доменные контракты, затем последовательно подключается UI. `app/page.tsx` меняет только один UI-интегратор; backend, миграции и behavioral QA идут в отдельных worktree и принимаются по runtime-доказательствам.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/Postgres/PostGIS, Telegram Mini Apps, Playwright, Node QA scripts.

## Global Constraints

- Свежий пользователь сразу видит `всё / псё / карта / рядом / вещи`; обязательного мастера и обязательного первого дела нет.
- Собаку можно создать только по имени; остальные данные собираются по контексту.
- `рядом` — P0: `знакомство / прогулка / социализация / случка`; случка не отдельный модуль.
- Поиск незнакомых: сначала до 15 км, затем весь город; без геодоступа — город/район.
- Знакомые связываются одноразовой ссылкой, не зависящей от радиуса и фильтров.
- Контакт открывается только после взаимного согласия; raw Telegram ID и вручную введённый username не используются.
- Точные координаты и маршруты никогда не публикуются; внешняя география только приблизительная.
- Пользовательский язык — русский, без технических тегов, внутренних состояний, дублей и неоправданных англицизмов.
- Для обычного удаления предпочтителен undo; удаление собаки/аккаунта требует явного подтверждения последствия.
- Ни миграции production, ни merge в `main`, ни deploy, ни создание Telegram-чатов не входят в выполнение без отдельного разрешения Руслана.

---

## File ownership

- UI integrator only: `app/page.tsx`, `app/globals.css`, `components/app/**`, `components/onboarding/**`.
- Identity/social backend: `app/api/social/**`, `lib/server/social*.ts`, `lib/socialCore.ts`, social migrations.
- Map backend: `app/api/map/**`, `app/api/zones/**`, map migrations and projections.
- Care CRUD backend: reminders, observations, wishlist, pets/account APIs and focused migrations.
- QA owner: `scripts/qa/**`, Playwright specs and evidence reports; production code only for a reproduced defect.
- No two workers edit `app/page.tsx` concurrently.

## Wave 0 — Preserve and reset

### Task 1: Canonical integration branch and rejected-slice quarantine

**Files:**
- Modify: `docs/superpowers/plans/2026-08-13-psyo-production-p0-roadmap.md`
- Create: `docs/reviews/2026-08-13-p0-candidate-slices.md`

**Interfaces:**
- Consumes: `main@5bdbbf7`, `feat/pso-p0-approved-roadmap@f01ffac`, all current worktrees.
- Produces: one clean integration base containing navigation and QA foundation only.

- [ ] **Step 1: Record the expected branch inventory**

```text
ACCEPT: navigation, QA foundation
REWORK: onboarding API, social core, reminders core
REJECT: mandatory onboarding UI
STOP-THE-LINE: current public route projection, manual telegram_username
```

- [ ] **Step 2: Verify inventory without changing branches**

Run: `git worktree list --porcelain && git log --oneline --decorate --all --simplify-by-decoration -30`

Expected: every candidate branch and commit is listed; no untracked candidate is silently discarded.

- [ ] **Step 3: Create the integration branch from the audited baseline**

Run: `git switch -c feat/pso-p0-audit-driven f01ffac`

Expected: branch points to `f01ffac`; working tree clean.

- [ ] **Step 4: Commit documentation only**

```bash
git add docs/reviews/2026-08-13-p0-candidate-slices.md docs/superpowers/plans/2026-08-13-psyo-production-p0-roadmap.md
git commit -m "docs: reset Pso P0 execution after product audit"
```

## Wave 1 — Safe shell and stop-the-line defects

### Task 2: Free shell and minimal dog creation

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/onboarding/CoreOnboarding.tsx`
- Modify: `app/api/v1/onboarding/activate/route.ts`
- Modify: `lib/server/onboardingService.ts`
- Modify: `packages/contracts/index.ts`
- Modify: `supabase/migrations/20260813170000_onboarding_activation.sql`
- Create: `scripts/qa/smoke-free-shell.mjs`

**Interfaces:**
- Consumes: verified `ownerId` from the signed Telegram app session.
- Produces: `createPet({ ownerId, name, idempotencyKey }) -> { petId, created }`; reminder is a separate optional action.

- [ ] **Step 1: Write the failing behavioral checks**

```js
assert.equal(freshOwner.visibleTabs, ['everything', 'dog', 'map', 'nearby', 'things'])
assert.equal(freshOwner.blockingOnboarding, false)
assert.equal(await createDog({ name: 'Луна' }).pets.length, 1)
assert.equal(await reload().pets[0].name, 'Луна')
assert.equal((await reload()).reminders.length, 0)
```

- [ ] **Step 2: Run the check and confirm the old flow fails**

Run: `node scripts/qa/smoke-free-shell.mjs`

Expected: FAIL because the shell is blocked and/or `firstReminder` is required.

- [ ] **Step 3: Split the contract**

```ts
export type CreatePetInput = {
  name: string
  idempotencyKey: string
}

export type CreatePetResult = {
  petId: string
  created: boolean
}
```

Remove `firstReminder` from the pet-creation requirement. Preserve the owner-scoped, service-role-only and idempotent database behavior.

- [ ] **Step 4: Replace blocking onboarding with contextual creation**

```text
Fresh owner -> real shell
Tap "Добавить собаку" -> sheet with visible label "Имя собаки"
Save -> selected dog page
Dismiss -> remain in shell; `рядом` communities remain reachable
```

- [ ] **Step 5: Run focused and full verification**

Run: `node scripts/qa/smoke-free-shell.mjs && npm run qa:local`

Expected: PASS; reload contains one dog and zero reminders.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/onboarding/CoreOnboarding.tsx app/api/v1/onboarding/activate/route.ts lib/server/onboardingService.ts packages/contracts/index.ts supabase/migrations/20260813170000_onboarding_activation.sql scripts/qa/smoke-free-shell.mjs
git commit -m "feat: open Pso shell before dog setup"
```

### Task 3: Private map persistence and safe projection

**Files:**
- Modify: `app/api/map/features/route.ts`
- Modify: `app/api/map/features/[id]/route.ts`
- Modify: `app/api/app/bootstrap/route.ts`
- Modify: `supabase/migrations/20260629020300_map_platform.sql`
- Create: `supabase/migrations/20260813xxxxxx_secure_map_projection.sql`
- Create: `scripts/qa/map-privacy.behavior.test.ts`

**Interfaces:**
- Consumes: verified `ownerId` from Telegram session.
- Produces: `listOwnerMapFeatures(ownerId)` and external `ApproximateMapProjection`; exact route geometry never crosses the public boundary.

- [ ] **Step 1: Write failing owner/privacy cases**

```ts
assert.deepEqual(await ownerA.listPrivate(), [pointA, routeA])
assert.equal((await ownerB.listPrivate()).includes(routeA), false)
assert.equal('path' in await publicView(routeA), false)
assert.equal(await revokedSharedRoute(routeA.shareId), 404)
```

- [ ] **Step 2: Reproduce the current defects**

Run: `npx tsx scripts/qa/map-privacy.behavior.test.ts`

Expected: FAIL on private Telegram-cookie read, exact public route projection, or missing revoke.

- [ ] **Step 3: Make owner identity explicit in server-side reads**

```ts
type OwnerMapQuery = { ownerId: string; includePrivate: true }
type ApproximateMapProjection = {
  id: string
  kind: 'point' | 'route'
  areaLabel: string
  approximateCenter?: { lat: number; lng: number }
}
```

Do not infer the Telegram owner with `auth.uid()` inside a service-role RPC.

- [ ] **Step 4: Replace public route geometry with an approximate projection**

```text
private route: exact geometry, owner only
shared/public route: area label + approximate center/bounds only
revoked share: 404
```

- [ ] **Step 5: Restore routes through bootstrap and add revoke**

Bootstrap must load both `map_zones` and owner `map_routes`; owner update/delete closes existing shared access.

- [ ] **Step 6: Verify and commit**

Run: `npx tsx scripts/qa/map-privacy.behavior.test.ts && npm run qa:local`

Expected: PASS for owner A/B, reload, public projection and revoke.

```bash
git add app/api/map app/api/app/bootstrap/route.ts supabase/migrations scripts/qa/map-privacy.behavior.test.ts
git commit -m "fix: protect and restore private map routes"
```

### Task 4: Verified Telegram contact contract

**Files:**
- Modify: `lib/server/telegram.ts`
- Modify: `lib/server/appSession.ts`
- Modify: `lib/socialCore.ts`
- Modify: `lib/server/socialService.ts`
- Create: `scripts/qa/verified-contact.behavior.test.ts`

**Interfaces:**
- Produces: `VerifiedTelegramContact = { username: string } | { username: null }` from signed `initData`; social forms cannot set it.
- Consumes: accepted mutual request.

- [ ] **Step 1: Write failing spoofing tests**

```ts
assert.equal(await saveSocialProfile({ telegramUsername: 'someone_else' }), 400)
assert.equal(await contactBeforeConsent(), null)
assert.equal(await contactAfterConsent({ verifiedUsername: 'luna_owner' }), 'https://t.me/luna_owner')
assert.equal(await contactAfterConsent({ verifiedUsername: null }), null)
```

- [ ] **Step 2: Run and reproduce**

Run: `npx tsx scripts/qa/verified-contact.behavior.test.ts`

Expected: FAIL because manually supplied username is currently accepted.

- [ ] **Step 3: Bind contact to verified Telegram identity**

```ts
export type VerifiedTelegramContact = {
  username: string | null
}
```

If Telegram provides no username, show the human action “Добавьте имя пользователя в настройках Telegram, чтобы открыть чат”; do not accept manual replacement and do not expose numeric Telegram ID.

- [ ] **Step 4: Verify and commit**

Run: `npx tsx scripts/qa/verified-contact.behavior.test.ts && npm run qa:identity:isolation`

Expected: PASS; spoofed username rejected, contact absent before consent.

```bash
git add lib/server/telegram.ts lib/server/appSession.ts lib/socialCore.ts lib/server/socialService.ts scripts/qa/verified-contact.behavior.test.ts
git commit -m "fix: bind social contact to Telegram identity"
```

## Wave 2 — `рядом` as a complete product slice

### Task 5: Social schema, opt-in and coarse location

**Files:**
- Create: `supabase/migrations/20260813xxxxxx_social_discovery_v2.sql`
- Modify: `app/api/social/profile/route.ts`
- Modify: `lib/server/socialService.ts`
- Modify: `lib/socialCore.ts`
- Create: `scripts/qa/social-profile.behavior.test.ts`

**Interfaces:**
- Produces:

```ts
type SocialScenario = 'meet' | 'walk' | 'socialize' | 'mating'
type SocialProfile = {
  petId: string
  discoverable: boolean
  city: 'moscow' | 'saint_petersburg'
  district: string | null
  coarseLocation: { lat: number; lng: number } | null
  scenarios: SocialScenario[]
}
```

- [ ] **Step 1: Write failing opt-in and isolation tests**

```ts
assert.equal((await hiddenPet.search()).visible, false)
assert.deepEqual(await ownerA.profile(petA), expectedProfile)
await assert.rejects(() => ownerA.profile(petB), /not found|forbidden/i)
assert.equal('exactLocation' in await publicCandidate(petA), false)
```

- [ ] **Step 2: Run and verify failure**

Run: `npx tsx scripts/qa/social-profile.behavior.test.ts`

Expected: FAIL because the canonical schema lacks explicit discoverability/scenarios/city contract.

- [ ] **Step 3: Implement minimal owner/pet-scoped profile**

Validation: at least one scenario when `discoverable=true`; city is required; district and coarse location are optional; mating is a scenario value only.

- [ ] **Step 4: Verify and commit**

Run: `npx tsx scripts/qa/social-profile.behavior.test.ts`

Expected: PASS for opt-in/off, revoke and cross-owner denial.

```bash
git add supabase/migrations app/api/social/profile/route.ts lib/server/socialService.ts lib/socialCore.ts scripts/qa/social-profile.behavior.test.ts
git commit -m "feat: add private social discovery profiles"
```

### Task 6: Organic discovery — 15 km, city fallback, no-geo path

**Files:**
- Modify: `app/api/social/candidates/route.ts`
- Modify: `lib/server/socialService.ts`
- Modify: `lib/socialCore.ts`
- Create: `scripts/qa/social-discovery.behavior.test.ts`

**Interfaces:**
- Consumes: `SocialProfile` from Task 5.
- Produces:

```ts
type CandidateGroup = {
  nearby: SocialCandidate[]
  city: SocialCandidate[]
}
```

- [ ] **Step 1: Write the two-user matrix**

```ts
assert.deepEqual(await search({ distanceKm: 12 }), { nearby: [candidate], city: [] })
assert.deepEqual(await search({ distanceKm: 20, sameCity: true }), { nearby: [], city: [candidate] })
assert.deepEqual(await search({ noGeo: true, sameCity: true }), { nearby: [], city: [candidate] })
assert.deepEqual(await search({ differentCity: true }), { nearby: [], city: [] })
assert.deepEqual(await search({ candidateHidden: true }), { nearby: [], city: [] })
```

- [ ] **Step 2: Run and reproduce the 10 km hard wall**

Run: `npx tsx scripts/qa/social-discovery.behavior.test.ts`

Expected: FAIL at 12 km and city fallback.

- [ ] **Step 3: Implement deterministic grouping**

```text
1. same city + shared scenario + discoverable
2. coarse distance <= 15 km -> nearby
3. remaining same-city candidates -> city
4. no geo -> city, same district first
5. never return exact coordinates or internal score
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsx scripts/qa/social-discovery.behavior.test.ts`

Expected: PASS for 0/1/2 users and all fallbacks.

```bash
git add app/api/social/candidates/route.ts lib/server/socialService.ts lib/socialCore.ts scripts/qa/social-discovery.behavior.test.ts
git commit -m "feat: add nearby and city discovery fallback"
```

### Task 7: Friend invite, requests, consent and safety

**Files:**
- Create: `app/api/social/invites/route.ts`
- Create: `app/api/social/invites/[token]/route.ts`
- Modify: `app/api/social/requests/route.ts`
- Modify: `app/api/social/requests/[id]/route.ts`
- Modify: `lib/server/socialService.ts`
- Create: `scripts/qa/social-connections.behavior.test.ts`

**Interfaces:**
- Produces request states: `pending | accepted | rejected | cancelled | blocked`.
- Produces one-use, expiring invite token; accepted connection may return only `VerifiedTelegramContact`.

- [ ] **Step 1: Write failing lifecycle cases**

```ts
assert.equal(await inviteAcrossCities().status, 'pending')
assert.equal(await contactBeforeAccept(), null)
assert.equal((await accept()).status, 'accepted')
assert.equal(await contactAfterAccept(), 'https://t.me/verified_owner')
assert.equal(await reuseInviteToken(), 410)
assert.equal(await blockedOwnerSearchVisibility(), false)
assert.equal(await reportOwner().queued, true)
```

- [ ] **Step 2: Run and verify missing invite/consent behavior**

Run: `npx tsx scripts/qa/social-connections.behavior.test.ts`

Expected: FAIL before invite endpoints and complete state machine exist.

- [ ] **Step 3: Implement retry-safe transitions**

```text
same sender/receiver/pet pair + idempotency key -> one request
accept accepted -> accepted (no duplicate side effect)
reject accepted -> conflict
block -> hides both directions and closes contact
report -> queue item without exposing reporter
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsx scripts/qa/social-connections.behavior.test.ts`

Expected: PASS including two known owners, two unknown owners, rejection and block.

```bash
git add app/api/social lib/server/socialService.ts scripts/qa/social-connections.behavior.test.ts
git commit -m "feat: add consent-based dog connections"
```

### Task 8: `рядом` mobile UI and city communities

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Create: `components/social/SocialProfileSheet.tsx`
- Create: `components/social/CandidateCard.tsx`
- Create: `components/social/RequestsPanel.tsx`
- Create: `components/social/CityCommunities.tsx`
- Create: `scripts/qa/smoke-nearby-ui.mjs`

**Interfaces:**
- Consumes Tasks 5–7 APIs.
- Produces human flows: opt-in/off, search, invite, request, accept/reject, open verified chat, block/report.

- [ ] **Step 1: Write the mobile journey**

```text
Open `рядом` without dog -> Moscow/SPb community section visible
Create dog -> enable visibility -> choose city/scenario -> save
Candidate within 15 km -> “Рядом” group
Candidate beyond 15 km -> “В вашем городе” group
Send request -> pending state
Accept as second owner -> “Открыть чат”
Hide profile -> candidate disappears
```

- [ ] **Step 2: Run and verify current UI fails**

Run: `node scripts/qa/smoke-nearby-ui.mjs`

Expected: FAIL because current candidate CTA opens the wrong screen and forms are absent.

- [ ] **Step 3: Implement with human copy**

No `score`, `matching`, `active`, `saved`, raw URL, raw ID or exact coordinates. Buttons name outcomes: `Показать собаку`, `Позвать друга`, `Отправить запрос`, `Открыть чат`, `Скрыть анкету`.

- [ ] **Step 4: Keep communities honest**

Before real approved URLs exist, render no fake links. The component accepts configured Moscow/SPb chat and folder URLs and shows only configured entries.

- [ ] **Step 5: Verify and commit**

Run: `node scripts/qa/smoke-nearby-ui.mjs && npm run qa:local`

Expected: PASS at 390×844; no horizontal overflow; long dog names remain operable.

```bash
git add app/page.tsx app/globals.css components/social scripts/qa/smoke-nearby-ui.mjs
git commit -m "feat: complete nearby dog journeys"
```

## Wave 3 — Human CRUD across the product

### Task 9: Care CRUD — reminders and observations

**Files:**
- Modify: `app/api/reminders/**`
- Modify: `app/api/observations/**`
- Modify: `app/page.tsx`
- Modify: `components/care/**`
- Create: `scripts/qa/care-crud.behavior.test.ts`

**Interfaces:**
- Reminder completion creates a history occurrence and computes the next occurrence; it does not erase history.
- All mutations accept an idempotency key and preserve drafts on recoverable failure.

- [ ] **Step 1: Encode the CRUD matrix**

```ts
await create(); await reload(); await edit(); await cancelEdit(); await editAndSave()
await complete(); assert.equal(history.length, 1); assert.equal(nextOccurrence.exists, true)
await retrySameMutation(); assert.equal(history.length, 1)
await deleteObservation(); await undoDeleteObservation();
```

- [ ] **Step 2: Run and verify gaps**

Run: `npx tsx scripts/qa/care-crud.behavior.test.ts`

Expected: FAIL on recurrence, double-submit, observation edit/delete or draft retention.

- [ ] **Step 3: Implement forms and lifecycle**

Visible labels, exact/flexible/approximate time, repeat, reschedule, snooze, completion history; observations support edit and recoverable delete. Close forms only after successful await.

- [ ] **Step 4: Verify and commit**

Run: `npx tsx scripts/qa/care-crud.behavior.test.ts && npm run qa:local`

Expected: PASS including owner/pet negative cases.

```bash
git add app/api/reminders app/api/observations app/page.tsx components/care scripts/qa/care-crud.behavior.test.ts
git commit -m "feat: complete care records lifecycle"
```

### Task 10: Profile, multi-dog, cards and deletion lifecycle

**Files:**
- Modify: `app/page.tsx`
- Modify: `lib/server/profileService.ts`
- Modify: `app/api/v1/pets/**`
- Create: `app/api/v1/account/route.ts`
- Modify: `app/api/dog-cards/route.ts`
- Create: `scripts/qa/profile-lifecycle.behavior.test.ts`

**Interfaces:**
- `saveProfile` never publishes a card.
- `publishCard` uses an explicit allowlist and creates exactly one active link per dog.
- Pet/account deletion endpoints require owner session and typed confirmation.

- [ ] **Step 1: Write lifecycle and privacy tests**

```ts
await addDog('Луна'); await addDog('Тиша'); await switchDog('Луна'); await reload()
await saveProfile(); assert.equal(card.isPublic, false)
await publishCard(['name', 'photo']); assert.equal(publicCard.hasHealthNotes, false)
await revokeCard(); assert.equal(await oldUrl(), 404)
await deleteDogWithoutConfirmation(); assert.equal(status, 400)
await ownerADeleteDog(); assert.equal(await ownerBPetStillExists(), true)
```

- [ ] **Step 2: Run and reproduce**

Run: `npx tsx scripts/qa/profile-lifecycle.behavior.test.ts`

Expected: FAIL because profile save and card publication are mixed and deletion is absent.

- [ ] **Step 3: Split intentions and add clear states**

```text
Profile: save -> “Изменения сохранены” only after server success
Card: preview -> choose fields -> publish -> close access
Dog: add/switch/delete
Account: explicit irreversible confirmation
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsx scripts/qa/profile-lifecycle.behavior.test.ts && npm run qa:local`

Expected: PASS for reload, A1/A2 separation, owner A/B denial and old link 404.

```bash
git add app/page.tsx lib/server/profileService.ts app/api/v1/pets app/api/v1/account app/api/dog-cards scripts/qa/profile-lifecycle.behavior.test.ts
git commit -m "feat: separate dog profile and sharing lifecycle"
```

### Task 11: Things and map human CRUD

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/api/wishlist/**`
- Modify: `app/api/zones/**`
- Modify: `app/api/map/**`
- Create: `scripts/qa/things-map-crud.behavior.test.ts`

**Interfaces:**
- All lists are active-pet scoped and survive reload.
- Delete is undoable for things, places and private routes.

- [ ] **Step 1: Write the shared CRUD matrix**

```ts
for (const entity of ['thing', 'place', 'route']) {
  await create(entity); await reload(); await edit(entity); await cancelEdit(entity)
  await editAndSave(entity); await reload(); await remove(entity); await undo(entity)
}
```

- [ ] **Step 2: Run and reproduce missing cycles**

Run: `npx tsx scripts/qa/things-map-crud.behavior.test.ts`

Expected: FAIL on thing edit, route reload/edit/delete or undo.

- [ ] **Step 3: Implement visible labels and one data path**

Remove user-facing `Wishlist`, `радиус около N м`, `Увеличить радиус` and duplicate map CRUD paths. Keep one primary action and retain input after network failure.

- [ ] **Step 4: Verify and commit**

Run: `npx tsx scripts/qa/things-map-crud.behavior.test.ts && npm run qa:local`

Expected: PASS at owner/pet boundaries and after reload.

```bash
git add app/page.tsx app/api/wishlist app/api/zones app/api/map scripts/qa/things-map-crud.behavior.test.ts
git commit -m "feat: complete things and places lifecycle"
```

## Wave 4 — Product composition and release evidence

### Task 12: `всё`, copy cleanliness and accessibility

**Files:**
- Modify: `lib/today.ts`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `lib/copy.ts`
- Modify: `scripts/qa/check-human-copy-contract.mjs`
- Create: `scripts/qa/smoke-product-shell.mjs`

**Interfaces:**
- Produces one primary action only when a real user-owned signal exists; empty state offers calm choices.

- [ ] **Step 1: Write priority and copy checks**

```ts
assert.equal(primaryAction({ overdueMedication: true }).kind, 'overdue-care')
assert.equal(primaryAction({ dueToday: true }).kind, 'due-today')
assert.equal(primaryAction({}).kind, 'none')
```

Forbidden visible strings include: `Wishlist`, `matching`, `score`, `readiness`, `saved`, `local`, `API`, `RLS`, raw paths and internal status codes.

- [ ] **Step 2: Run and verify current failures**

Run: `node scripts/qa/check-human-copy-contract.mjs && node scripts/qa/smoke-product-shell.mjs`

Expected: FAIL on technical copy, duplicate actions or mandatory empty-state prompts.

- [ ] **Step 3: Implement deterministic composition**

Priority: exact overdue medicine/procedure -> other overdue care -> due today -> no forced action. Observations never invent a medical priority; profile gaps remain optional contextual prompts.

- [ ] **Step 4: Verify mobile/accessibility states**

Run: `node scripts/qa/smoke-product-shell.mjs && npm run qa:visual`

Expected: PASS at 390×844, desktop and 200% text; keyboard order and visible labels remain coherent.

- [ ] **Step 5: Commit**

```bash
git add lib/today.ts app/page.tsx app/globals.css lib/copy.ts scripts/qa
git commit -m "fix: simplify Pso product language and priorities"
```

### Task 13: Live two-owner release gate

**Files:**
- Modify: `scripts/qa/smoke-owner-isolation-fixtures.mjs`
- Create: `scripts/qa/p0-two-owner-journey.mjs`
- Create: `docs/reviews/2026-08-13-p0-release-evidence.md`
- Modify: `package.json`

**Interfaces:**
- Consumes two isolated authorized Telegram fixtures and a non-production Supabase target.
- Produces a red/green evidence report; it performs isolated cleanup.

- [ ] **Step 1: Add the executable release command**

```json
{
  "qa:p0:behavior": "node scripts/qa/p0-two-owner-journey.mjs"
}
```

- [ ] **Step 2: Encode required journeys**

```text
fresh owner -> free shell -> dog by name -> reload
unknown owners <=15 km -> discover -> request -> accept -> verified chat
unknown owners >15 km same city -> city fallback
known owners different cities -> invite -> accept
reject/block/report -> no contact/no discovery
profile/card/things/place/route/reminder/observation -> full CRUD + reload
owner A cannot read/write owner B; dog A1 does not mix with A2
public/shared map never contains exact route; revoke -> 404
```

- [ ] **Step 3: Run in a safe environment**

Run: `npm run qa:p0:behavior`

Expected: PASS with explicit counts and cleanup; SKIP is release failure, not success.

- [ ] **Step 4: Run the full gate**

Run: `npm run qa:local && npm run qa:p0:behavior && npm run build`

Expected: all PASS; no source-only assertion is accepted as runtime evidence.

- [ ] **Step 5: Record evidence and commit**

```bash
git add scripts/qa package.json docs/reviews/2026-08-13-p0-release-evidence.md
git commit -m "test: add behavioral Pso P0 release gate"
```

## External operations — separate approval only

### Task 14: Official Moscow and Saint Petersburg communities

**Files:**
- Modify after approval: deployment configuration for city URLs.
- Create after approval: moderation rules and operational owner record.

**Interfaces:**
- Produces verified `moscow.chatUrl`, `saint_petersburg.chatUrl`, and one Telegram folder URL.

- [ ] **Step 1: Present rules, moderator assignment and exact public names to Руслан**

Expected: explicit approval before any Telegram chat/folder creation.

- [ ] **Step 2: Create communities only after approval**

Expected: real URLs, appointed moderator, pinned rules, complaint path.

- [ ] **Step 3: Configure URLs and verify city routing**

Run: `npm run qa:p0:behavior`

Expected: Moscow sees Moscow community, Saint Petersburg sees Saint Petersburg community, folder opens, no placeholder link exists.

## Final handoff gates

- Plan implementation does not authorize production migrations, merge or deploy.
- Before `на прод`: clean diff review, migration dry-run, behavioral gate, Telegram WebView iOS/Android check, privacy review and Руслан’s product walkthrough.
- After explicit `на прод`: apply approved migrations, merge approved commits, deploy, run strict production smoke, and report any rollback condition.
