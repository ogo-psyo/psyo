# Service Logic Reset - Pso MVP

Date: 2026-06-06

## Why This Reset Exists

Pso has the same failure mode as merch leadgen, but in a pet-product shell:
the UI can look complete while parts of the product are demo/local/partial.
That creates raw results that feel like progress but do not survive real user
use, QA, auth, privacy, or return loops.

This reset imports the useful practices from OpenClaw skills research without
installing third-party skills.

Source:
`/Users/ogoruslan/.openclaw/workspace/reports/openclaw-skills-practices-for-leadgen-and-pso-2026-06-06.md`

## Current Risk

Existing docs already name the main risk: Pso has a mobile app shell with
Today, Passport, Assistant, Map, Wishlist, avatar, and public card, while several
pillars remain partial/demo.

The product must stop allowing UI presence to imply product readiness.

## Target Service Model

### 1. ProfileService

Owns dog profile/passport data.

Outputs:

- persisted profile fields;
- profile completeness;
- missing minimum inputs;
- local-vs-authenticated persistence state.

### 2. TodayService

Owns the daily care command center.

Outputs:

- prioritized today items;
- overdue/upcoming grouping;
- next useful action;
- blocked state if profile/reminders are insufficient.

### 3. ReminderService

Owns reminders and care events.

Outputs:

- reminder CRUD result;
- recurrence/snooze/complete state;
- durable persistence proof.

### 4. AssistantService

Owns assistant answers and actions.

Outputs:

- answer;
- safety level;
- confidence;
- source/profile context used;
- red-flag escalation;
- forbidden claims.

It must not present medical/veterinary certainty.

### 5. AvatarService

Owns upload, local compression, generation, and storage readiness.

Outputs:

- avatar source;
- storage mode;
- provider used;
- cost/rate state;
- blocked state for external provider.

### 6. MapZoneService

Owns privacy-safe map and zones.

Outputs:

- approximate location state;
- zone CRUD;
- privacy status;
- social/nearby visibility consent.

### 7. WishlistService

Owns wishlist/rebuy/commerce intent.

Outputs:

- owner-scoped wishlist state;
- recommendation basis;
- partner/ad consent state;
- purchase blocked state.

### 8. ReadinessService

Owns the view model for the app shell.

Proposed endpoint or local view model:

```text
GET /api/app/readiness
```

or:

```text
buildAppReadiness({ auth, profile, reminders, avatar, assistant, map, wishlist })
```

Returns:

- current user/product stage;
- what is persisted;
- what is demo/local only;
- next useful action;
- blocked promises;
- QA readiness;
- privacy/safety state.

The UI should render this readiness model instead of implying readiness from the
presence of tabs/cards.

## Practices Imported From OpenClaw Skills Research

- Treat community skills as pattern sources, not install targets.
- Use service contracts before new UI slices.
- Add source/confidence fields for assistant, health, recommendation, and map
  claims.
- Add fixtures for readiness states before broad UI polish.
- Add rate/cost state for avatar and assistant providers.
- Add hard security gates for auth, private data, map/location, photo/avatar,
  and commerce.
- Do not deploy or call production-ready without fresh QA evidence.

## Immediate Backlog

1. Add `ReadinessService` or local readiness builder.
2. Add readiness fixtures:
   - logged out;
   - guest/local profile;
   - authenticated pet saved;
   - Today ready;
   - assistant blocked by safety;
   - map blocked by privacy;
   - wishlist demo-only.
3. Add one focused smoke test that proves the app shell labels demo/local/blocked
   states honestly.
4. Update UI only after the readiness model exists.
5. Keep deployment gated by explicit approval and production smoke.

## Non-Negotiable Rules

- Do not let a visible screen imply the service is production-ready.
- Do not add health/assistant confidence without safety status.
- Do not broaden map/social/commerce without privacy and consent state.
- Do not use UI copy to hide missing backend.
- Do not install third-party skills for avatar, commerce, scraping, or browser
  automation without vetting and approval.
