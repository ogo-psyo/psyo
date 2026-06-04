# Implementation Backlog — Псё Top App Prep

## P0 — Prep infrastructure

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
