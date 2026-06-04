# Tools Setup Checklist

Подготовка инструментов перед реализацией top-app сценария. Внешние аккаунты/платные действия требуют отдельного подтверждения.

## Priority 1 — сразу перед кодом

### PostHog or Amplitude

Recommendation: **PostHog** for product analytics + feature flags.

Setup needed:
- project key;
- EU/US region decision;
- env vars:
  - `NEXT_PUBLIC_POSTHOG_KEY`;
  - `NEXT_PUBLIC_POSTHOG_HOST`;
- `lib/analytics.ts` wrapper;
- event taxonomy from `02-event-taxonomy.md`.

Acceptance:
- app works if key absent;
- events visible in dev/prod;
- no PII/medical notes/exact GPS.

### Sentry

Setup needed:
- Sentry project for Next.js;
- env vars:
  - `NEXT_PUBLIC_SENTRY_DSN`;
  - `SENTRY_AUTH_TOKEN` only for source maps if needed;
- error boundaries around avatar/assistant/map.

Acceptance:
- frontend errors captured;
- API errors captured;
- no raw user photos/medical text in breadcrumbs.

### Supabase Storage / R2

Need for avatar assets.

Decision:
- short-term: Supabase Storage;
- later: R2 if cost/egress matters.

Buckets:
- `dog-reference-photos` private;
- `dog-avatars` private by default;
- `dog-card-share` public or signed-link controlled.

## Priority 2 — avatar pipeline

### Background jobs

Options:
- Inngest;
- Trigger.dev;
- Upstash QStash;
- Vercel background functions later.

Need:
- avatar job creation;
- status polling;
- retry/fallback;
- cost limits.

### Image provider

Options:
- OpenAI image edit/generation;
- Replicate models;
- Stability/Leonardo later.

Need:
- moderation;
- timeout handling;
- style presets;
- monthly cost cap.

## Priority 3 — maps/world

### Map tiles/geocoding

Options:
- MapTiler;
- Mapbox;
- OSM via proper tile provider.

Need:
- tile provider terms;
- geocoding;
- attribution;
- rate limits.

### Places data

Start manual curation, not fully automated.

Need:
- curation table/admin CSV;
- trust levels;
- source/date fields;
- clinic emergency checklist.

## Priority 4 — App Store path

### Capacitor

Need:
- iOS shell;
- camera/photo plugin;
- push plugin;
- share sheet;
- deep links;
- secure storage;
- haptics.

### App Store Connect

Need:
- bundle id;
- privacy labels;
- screenshots;
- app icon;
- preview video;
- TestFlight internal testers.

## Priority 5 — design/brand

### Figma

Need:
- design system page;
- hero card components;
- avatar style cards;
- unlock cards;
- Today quest card;
- World/Place cards;
- App Store screenshots.

### Motion

Options:
- Rive for hero/reveal/unlocks;
- Lottie for simpler animations;
- CSS first for MVP.

## Priority 6 — QA/release

- Playwright browser smoke.
- Mobile Safari checklist.
- Android Chrome checklist.
- App Store review checklist.
- Medical safety test prompts.
- Privacy/location test prompts.
