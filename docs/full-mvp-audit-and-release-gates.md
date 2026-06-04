# Псё MVP — Full Product / Data / QA Audit

Дата: 2026-05-07
Прод: `https://pso-mvp-uglanovrms-projects.vercel.app`

## 0. Почему этот документ появился

Первичная проработка ошибочно сузилась до auth/magic-link инцидента. Это было недостаточно: Псё уже обещает целый продукт, а не один экран входа.

Этот документ фиксирует полную рамку MVP:

- все видимые экраны и состояния;
- все функции, которые UI обещает;
- data/API inventory;
- agent gates;
- P0/P1/P2 QA матрицу;
- gaps между UI, backend, safety, commerce и release readiness.

## 1. Executive diagnosis

Проблема не только в magic link. Архитектурно продукт сейчас находится между тремя состояниями:

1. **App shell уже есть** — mobile/PWA интерфейс с Today, Passport, Assistant, Map, Wishlist.
2. **Backend частично есть** — Supabase schema, pets/passport/social/reminders, часть reminder CRUD.
3. **Большая часть pillars всё ещё demo/promises** — Assistant, Map, Wishlist/Commerce, Public card, Avatar storage, full Today engine.

Главный риск: UI выглядит как готовое приложение, но часть функций не имеет backend, owner-scope, safety gates, QA gates или recovery UX.

## 2. Agent model: все роли и где они gate

Роли больше не advisory. Каждая роль получает veto на свой слой.

- **Product Lead / IA**
  - владеет screen inventory, journeys, activation path;
  - veto если UI обещает функцию, которой нет или она не даёт user value.

- **Backend/Data/Auth Architect**
  - Supabase, RLS, owner scope, migrations, API contracts;
  - veto если есть service-role leak, auth gap, enum mismatch, data loss risk.

- **QA/Release Engineer**
  - release checklist, env, smoke, staging/prod gates, rollback;
  - veto если нет reproducible tests или prod smoke.

- **Frontend/UX Lead**
  - state machine, PWA/iPhone flow, empty/error states, mobile layout;
  - veto если happy-path-only UX или пользователь может сжечь лимиты/застрять.

- **Retention/Care Lifecycle**
  - activation loop: login → pet saved → reminder created → Today useful → return works;
  - veto если durable loop не проверен.

- **Safety/Vet-Behavior Reviewer**
  - health/behavior assistant, medication/vaccine/vet reminder safety, disclaimers;
  - veto для Assistant/health/behavior flows.

- **Commerce/Partnerships Lead**
  - wishlist/rebuy/clinics/vetshops trust, recommendations provenance, consent;
  - veto для commerce layers.

- **Ops Incident Commander**
  - incident response, runbook, comms, postmortem;
  - activated on production breakage.

## 3. Screen inventory

### 3.1 Auth loading

- Purpose: session/bootstrap initialization.
- Current UI: “Загружаю приложение…”.
- Data: Supabase session.
- Status: **implemented**.
- Gaps: no timeout/recovery if session/bootstrap hangs.

### 3.2 Login / Magic link

- Purpose: sign in so data persists across devices.
- Current UI: email input, button, raw errors, short toast.
- Data: Supabase user/session.
- Status: **implemented but not release-safe**.
- P0 gaps:
  - no sending disabled state;
  - no cooldown/resend timer;
  - no persistent “email sent” screen;
  - raw Supabase errors;
  - no 429 UX;
  - no callback/recovery screen;
  - real email tests can burn quota.

### 3.3 Main app shell

- Purpose: mobile app frame after login.
- Current UI: header with email, logout, dog hero, tab nav.
- Data: AuthSession, DogProfile.
- Status: **implemented**.
- Gaps: no multi-pet switcher, no profile completion indicator.

### 3.4 Dog hero card

- Purpose: persistent dog context.
- Current UI: avatar, name, breed, bio, edit button.
- Data: DogProfile, generated avatar URL.
- Status: **implemented/demo**.
- Gap: avatar is effectively demo-ready; image/photo persistence not real.

### 3.5 Today tab

- Purpose: command center / care loop.
- Current UI: “Что важно сегодня?”, metrics, quick reminder add, reminder list, care/social/training cards.
- Data: Reminder, DogProfile, passport/social snippets.
- Status: **partial**.
- Implemented: quick add, list, complete, snooze.
- Missing:
  - real Today prioritization engine;
  - overdue/upcoming filters;
  - templates by care type;
  - recurrence/reschedule;
  - notifications;
  - edit/delete in UI;
  - D1 return validation.

### 3.6 Passport tab

- Purpose: create/save dog profile.
- Current UI: photo, avatar, name, breed group/breed, age, size, sex, weight, coat, microchip, vet clinic, save.
- Data: DogProfile, Pet, PetPassport, SocialProfile.
- Status: **partial**.
- Missing UI despite model/import support:
  - diet;
  - allergies;
  - medication;
  - health notes;
  - vaccine/parasite status;
  - temperament/energy/play/trainability;
  - friendly-with children/dogs/cats;
  - triggers;
  - alone time;
  - public/social settings;
  - avatar/photo storage.
- P0 risk: UI/domain values can mismatch DB enum constraints.

### 3.7 Avatar upload/generation

- Purpose: visual hook.
- Current: file validation, `/api/avatar/generate`, demo fallback.
- Status: **partial/demo**.
- Missing:
  - storage bucket;
  - async job/status;
  - save generated `avatar_url`/`photo_urls`;
  - auth/ownership on generation;
  - privacy copy.

### 3.8 Assistant tab

- Purpose: context-aware dog ownership assistant.
- Current UI: fake chat + cards for training, health triage, daily routine.
- API: `/api/assistant` exists but demo/context only.
- Status: **demo/risky before real release**.
- P0 blockers:
  - no chat input;
  - no thread/message persistence;
  - no frontend call;
  - no owner check on API;
  - no safety contract enforcement;
  - no action engine for reminders/wishlist;
  - no red-flag escalation tests.

### 3.9 Map tab

- Purpose: privacy-first zones/nearby dogs/care places.
- Current UI: fake map, safe zone, risk zone, nearby dog cards.
- Data: MapZone exists in domain/schema; `nearbyDogs` mock.
- Status: **demo**.
- Missing:
  - zones CRUD API/UI;
  - real map;
  - approximate location model;
  - consent/privacy controls;
  - moderation for social discovery;
  - clinics/shops catalog integration.

### 3.10 Wishlist / Shop tab

- Purpose: wishlist, rebuy, clinics/vetshops, commerce layer.
- Current UI: cards only.
- API: `/api/wishlist` exists but not connected to UI and currently unsafe without auth/owner checks.
- Status: **demo/risky**.
- Missing:
  - wishlist CRUD UI;
  - owner-scoped API;
  - rebuy flow;
  - partner catalog;
  - recommendation explanations;
  - consent/ads separation;
  - recovery if auth breaks during purchase intent.

### 3.11 Public dog card `/dog/[slug]`

- Purpose: shareable dog/public/social card.
- Current: route exists, query-param/demo style.
- Data: `public_slug`/`is_public` partly exist.
- Status: **demo/missing backend**.
- P0 blockers before release:
  - public read policy/endpoint;
  - private field allowlist;
  - no exact location/health-sensitive leak;
  - owner-controlled publish/unpublish.

### 3.12 Global states

- Toast/notice: implemented but too generic; `sent/copied` can show wrong copy in app shell.
- Errors: implemented as one string; no field-level recovery.
- Empty states: partial; Today/Passport/Assistant/Map/Wishlist need intentional empty states.
- Modals: none.
- PWA: manifest route exists, but iPhone/Home Screen behavior needs smoke.

## 4. API inventory

### `GET /api/app/bootstrap`

- Entity: user, pet, passport, social, reminders, zones, wishlist.
- Auth: bearer optional.
- Owner scope: if authenticated, filters pets by `owner_id`; if unauthenticated with Supabase, service role can return first pet.
- Status: **partial/risky**.
- P0 fix: unauthenticated Supabase mode must not read first real pet.

### `POST /api/pets`

- Entity: pets + pet_passports + social_profiles.
- Auth: requires user when Supabase configured.
- Owner scope: writes `owner_id = auth.user.id`.
- Status: **partial/risky**.
- P0 fix: enum/value mapping and validation; avoid partial broken writes.

### `GET /api/reminders`

- Entity: reminders.
- Auth: requires user.
- Owner scope: join through pet owner.
- Status: **ready/partial**.

### `POST /api/reminders`

- Entity: reminders + reminder_events.
- Auth: requires user.
- Owner scope: checks pet ownership.
- Status: **ready/partial**.
- Missing: recurrence scheduling, notifications, template types.

### `PATCH /api/reminders/[id]`

- Entity: reminders + event.
- Auth/owner: checks ownership.
- Status: **ready/partial**.
- Missing UI connection.

### `DELETE /api/reminders/[id]`

- Entity: reminders + event.
- Auth/owner: checks ownership.
- Status: **ready/partial**.
- Missing UI connection.

### `POST /api/reminders/[id]/complete`

- Entity: reminder status + completed_at + event.
- Auth/owner: checks ownership.
- Status: **ready for MVP action**.

### `POST /api/reminders/[id]/snooze`

- Entity: reminder status + snoozed_until + event.
- Auth/owner: checks ownership.
- Status: **ready/partial**.
- Missing: reactivation/next_due logic.

### `POST /api/assistant`

- Entity: assistant context only.
- Auth: missing.
- Owner scope: missing; service role can read by `petId`.
- Status: **risky/demo**.
- P0 blocker before real Assistant.

### `GET /api/wishlist`

- Entity: wishlist_items.
- Auth: missing.
- Owner scope: missing/optional petId only.
- Status: **risky/partial**.
- P0 blocker before UI use.

### `POST /api/wishlist`

- Entity: wishlist_items.
- Auth: missing.
- Owner scope: missing; inserts for arbitrary petId.
- Status: **risky/partial**.
- P0 blocker.

### `POST /api/avatar/generate`

- Entity: external image generation.
- Auth: missing.
- Persistence: none.
- Status: **partial/demo**.

## 5. Data object inventory

- **profiles** — partial; RLS by `auth.uid()`; schema docs may lag migrations.
- **pets** — partial; `owner_id`, public fields; public read not ready.
- **pet_passports** — partial; owner via pet; UI coverage incomplete.
- **social_profiles** — partial; owner via pet; UI coverage incomplete and enum mapping risk.
- **reminders** — partial/ready for CRUD/actions; no scheduler/push.
- **reminder_events** — ready for audit log; only action events now.
- **map_zones** — schema only + bootstrap read; no CRUD.
- **wishlist_items** — schema + risky API; no safe UI integration.
- **assistant_threads / assistant_messages** — schema only; no real Assistant persistence.
- **photos/avatar storage** — missing or not connected.
- **partner catalog / clinics / vetshops** — missing.
- **public dog card** — partial fields, missing safe public read.

## 6. Pillar readiness

### Auth / onboarding

- Status: **partial**.
- Ready: Supabase magic-link session can work after config.
- Blockers: email quota strategy, cooldown UX, callback/recovery, env/staging gates.

### Passport

- Status: **partial**.
- Ready: basic pet save.
- Blockers: field coverage, enum mapping, photo/avatar storage, validation.

### Today

- Status: **partial**.
- Ready: reminder quick-add/list/done/snooze.
- Blockers: real today logic, templates, recurrence, empty states, D1 return.

### Reminders

- Status: **partial/closest to real**.
- Ready: owner-scoped CRUD/actions mostly present.
- Blockers: notifications, recurrence engine, edit/delete UI, medical reliability copy.

### Assistant

- Status: **demo/risky**.
- Blockers: auth/owner check, UI input, LLM safety, thread persistence, red-team tests.

### Map / zones / socialization

- Status: **demo/schema-only**.
- Blockers: zones CRUD, approximate location, consent, privacy gates, social moderation.

### Wishlist / commerce / clinics

- Status: **demo/risky**.
- Blockers: owner-scoped wishlist API, UI CRUD, partner catalog, trust/explanation/consent.

### Public dog card

- Status: **demo**.
- Blockers: DB-backed slug route, public-safe field allowlist, publish controls.

### Avatar

- Status: **demo/partial**.
- Blockers: storage, auth, persistence, cost/rate limits, generation status.

## 7. P0 release matrix for Sprint 1

Sprint 1 should not claim the whole MVP. Sprint 1 releasable scope should be:

```text
Auth + Passport basic save + Reminders basic CRUD/actions + Today basic loop
```

P0 acceptance:

- Magic-link no-send smoke passes with prod/staging URL, no localhost.
- Real email smoke is controlled, max 1, not default CI.
- Login UX has sending/sent/cooldown/rate-limited states.
- `/api/app/bootstrap` never leaks first real pet to unauthenticated user.
- User can save pet/passport basics.
- Logout/login/refresh returns same user-owned pet.
- Create reminder for owned pet.
- Complete reminder and event saved.
- Snooze reminder and event saved.
- Today shows user-owned reminder after refresh.
- User A cannot read/write User B pet/reminders/wishlist.
- Raw provider errors not shown as primary UX.
- Build passes.
- Mobile/iPhone viewport smoke passes.

## 8. P0 blockers before broader MVP claim

- Close service-role leaks in bootstrap/assistant/wishlist.
- Fix enum mapping UI/domain → DB.
- Add auth UI state machine and cooldown.
- Add no-send auth smoke script.
- Update env/docs/scripts for anon key/app URL.
- Add public card safe backend before exposing social share.
- Add owner-scoped wishlist API before enabling wishlist UI.
- Add Assistant owner check and safety contract before real LLM.
- Add map/zones CRUD + privacy model before real map/social discovery.
- Add avatar/photo storage before claiming persistent avatar.

## 9. P1/P2 backlog

### P1

- Profile completion/onboarding steps.
- Full passport/social/care fields in UI.
- Reminder edit/delete UI.
- Reminder templates by care type.
- Today prioritization: overdue/today/upcoming.
- Dedicated `/auth/callback` recovery screen.
- PWA/iPhone Home Screen smoke.
- Public card from DB with safe allowlist.
- Wishlist CRUD with owner check.

### P2

- Recurrence engine + notifications.
- Multi-pet support.
- Assistant threads/messages + action suggestions.
- Clinics/vetshops/partner catalog.
- Rebuy flow.
- Nearby dogs/socialization discovery.
- QR/deep links.
- Analytics funnel: requested link → session → pet saved → reminder created → D1 return.

## 10. Safety gates

Before health/behavior Assistant:

- no diagnosis;
- no medication dosage instructions;
- red flags escalate to vet/urgent care;
- behavior advice avoids coercive/dangerous methods;
- if profile is missing/not saved, Assistant says personalization is limited;
- medication/vaccine reminders are not presented as guaranteed medical alert system;
- auth/persistence failures show “data not confirmed saved” copy.

## 11. Commerce/trust gates

Before wishlist/clinics/rebuy:

- auth and persistence stable;
- wishlist owner scope proven;
- no cross-user leakage;
- purchase intent survives relogin;
- recommendations explain why they appear;
- paid/partner placements marked;
- no commerce before care context;
- recovery path for auth interruption.

## 12. Frontend/PWA gates

- Login button disabled during sending.
- Sent state persistent, not 2-second toast.
- Resend cooldown.
- Rate-limit state with human copy.
- Change email.
- Open mail CTA.
- Expired/invalid link recovery.
- iPhone Safari viewport 390x844 smoke.
- Home Screen PWA smoke.
- Touch targets ≥ 44px.
- No horizontal scroll.

## 13. Definition of Done

### Sprint 1 DoD

Sprint 1 is done only if:

- Auth/Data Architect pass.
- QA/Release pass.
- Frontend/UX pass.
- Retention/Care pass.
- Build passes.
- P0 auth/passport/reminders/today tests pass.
- No known service-role leaks in exposed P0 APIs.
- Runbook exists for auth/email quota.

### MVP DoD

MVP is done only if each pillar is either:

- truly implemented and gated; or
- explicitly marked demo/coming soon in UI and docs.

No screen should silently imply a function is real if it is only a mock.

## 14. Immediate next actions

1. Freeze broad product claims; define Sprint 1 scope narrowly.
2. Fix P0 data leaks:
   - unauth bootstrap first-pet read;
   - assistant owner check;
   - wishlist owner check.
3. Fix auth UX state machine and cooldown.
4. Fix enum mapping/validation for pet/passport/social save.
5. Add no-send auth smoke and env contract scripts.
6. Add Sprint 1 release checklist.
7. Mark Assistant/Map/Wishlist/Public card as demo/disabled until gates pass.
8. Run build + API smoke + mobile smoke.
