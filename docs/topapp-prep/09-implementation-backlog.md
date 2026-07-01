# Implementation Backlog — Псё Top App Prep

## P0 — Prep infrastructure

### 0. UI/UX kit intake

Source:
- `docs/psyo-uiux-kit-intake-2026-06-24.md`

Tasks:
- use the kit as design/reference input, not as a dependency migration plan;
- keep current DB/entity/service contracts authoritative;
- adapt cream/mint, soft glass, tactile controls, haptics, and screen-state discipline into the current app;
- route scenario/entity mismatches into explicit backlog items.

Acceptance:
- intake doc exists;
- implementation work references which kit items are adopted vs backlogged;
- no broad dependency install or DB/domain changes happen silently.

### 1. Analytics wrapper

Files:
- `lib/analytics.ts`
- optionally `lib/session.ts`

Tasks:
- create no-op `track()` wrapper;
- generate local `session_id`;
- generate local `guest_profile_id`;
- wire first events only after wrapper exists.

Acceptance:
- app builds without provider keys;
- events can be logged to console in dev;
- no PII/exact GPS.

### 2. Avatar-first state model

Files:
- `lib/avatar/*`
- `lib/profileStorage.ts`

Tasks:
- define avatar styles;
- define job states;
- persist onboarding/hero state locally;
- prepare provider abstraction.

Acceptance:
- UI can use local state before backend job exists.

### 3. Draft schema migration

Files:
- `supabase/migrations/20260508100000_topapp_preparation_schema.sql`

Tasks:
- add draft tables for avatar assets/jobs, dog cards, places, partners, devices.
- do not apply until reviewed.

Acceptance:
- SQL file syntax is plausible and documented;
- no destructive changes.

## P1 — Product implementation slice

### 4. Avatar-first entry

Tasks:
- add first-run route/state before app shell;
- photo/skip;
- style picker;
- generation waiting copy;
- reveal hero card;
- save locally;
- CTA to world unlocks.

### 5. World unlocks

Tasks:
- show unlock cards: Забота / Карта / Друзья / Вещи;
- first quest selection;
- connect quest to Today/Profile/World.

### 6. Hero card sharing MVP

Tasks:
- render card as UI;
- download PNG if feasible;
- share sheet later in Capacitor.

## P2 — World/places prep

### 7. Seeded places

Tasks:
- create `data/places.ru.json` or Supabase seed;
- trust level labels;
- new area summary.

### 8. Place cards

Tasks:
- show clinics/shops/parks/risk zones;
- no fake verified badge;
- source/date/trust visible.

### 8a. Map marker model review

Source:
- UI/UX kit proposes `MapMarker` types: safe, danger, place, dog_area.
- Current DB uses `MapZone` types: home_area, walk_route, safe_place, risk_zone, clinic, shop, grooming.

Tasks:
- decide whether kit marker types are only UI labels or require enum changes;
- define mapping from `MapZone.type` to UI marker style;
- backlog public/community marker moderation separately if needed.

Acceptance:
- no enum/schema change without migration review;
- map UI can visually distinguish safe/risk/service places using current data.

## P2.5 — History / notes / assistant model

### 8b. Notes as first-class scenario

Source:
- UI/UX kit includes a Notes screen and `Note` model.
- Current app only has health notes and completed reminders.

Tasks:
- decide whether notes become `Note`, `PetHistory`, or an extension of `ReminderEvent`;
- define CRUD/API/privacy;
- decide whether Notes deserves a tab or lives inside Profile/Calendar.

Acceptance:
- entity decision documented before UI implementation.

### 8c. Daily metrics / mood history

Source:
- UI/UX kit mentions mood, water, food, walk minutes.

Tasks:
- define `PetHistory` or daily metrics entity;
- decide retention and privacy;
- decide if Today can show metrics without fake data.

Acceptance:
- Today does not imply persisted metrics until the entity exists.

### 8d. Q&A / assistant catalog

Source:
- UI/UX kit includes Q&A categories and popular questions.
- Current app has assistant route and future assistant thread/message schema.

Tasks:
- decide whether this is persisted assistant, FAQ content, or both;
- define safety copy for health/behavior answers;
- map to existing `AssistantThread`/`AssistantMessage` target entities if persistence is needed.

Acceptance:
- no medical-sounding answer surface without uncertainty/red-flag copy.

## P3 — App Store readiness

### 9. Sentry

Tasks:
- setup wrapper/config;
- no-op if DSN absent;
- error boundary.

### 10. Capacitor spike

Tasks:
- create branch/spike only;
- test iOS shell;
- camera/share/push feasibility.

## P4 — Social/commerce later

### 11. Compatibility model

Tasks:
- explainable compatibility rules;
- no exact GPS;
- invite card.

### 12. Partner trust model

Tasks:
- partner profile;
- disclosure;
- affiliate event.

### 13. Telegram Stars / Plus entitlement model

Source:
- monetization direction: Mini App + Telegram payments + subscription/Plus.

Tasks:
- define paid packages: one-off premium passport, Plus subscription, digital themes/avatars/cards;
- define entitlement entity/state;
- define Telegram Stars invoice/subscription flow;
- decide free vs paid public-card limits;
- define refund/expiration behavior.

Acceptance:
- no payment implementation before package, entitlement, and UX copy are approved.

### 14. Public nearby / presence privacy model

Source:
- current UI has a placeholder `Рядом`; UI/UX kit mentions local community.

Tasks:
- define presence lifetime and approximate location policy;
- define opt-in mode and visibility radius;
- define matching/invite workflow;
- define abuse/report controls before public launch.

Acceptance:
- no exact GPS or public location exposure;
- presence can be fully disabled.
