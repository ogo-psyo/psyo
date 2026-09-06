# Псё · iOS watercolor v5 · 2026-09-06

## Goal and authority
User asked to redo yesterday's full-app design update after the rejected v4 rollback. Stable source: 239a96b. Visual authority: owner-approved pso-mvp/app/design-v3/styles.module.css atmosphere variant, not the legacy production DESIGN.md's Unbounded/lime rules.

## Surface and state contract
Mode: Operate. Owners use Telegram on a phone, often outdoors with one hand. Readable light surfaces, familiar system typography, compact dog identity, full-width touch-safe five-route navigation.
ProfileService, TodayService, ReminderService, AssistantService, MapZoneService, WishlistService and ReadinessService keep existing records and API ownership. Authenticated APIs remain authoritative; guest local storage remains existing fallback. View selection is ephemeral. No lifecycle transitions, consent boundaries or mutation payloads changed. Existing loading/error/empty/disabled states remain actual state, not decorative claims.

## Scope
All five top-level sections plus profile editors, calendar, observations/voice, assistant, map workflow, social requests and things forms share the new visual system. Home composition uses neutral Pso masthead, real dog facts, current care action linked to calendar, existing guided scenarios and observation history. Gav goes directly to the existing live-map workspace; discovery, request lifecycle, contact privacy and consent remain unchanged. Breed search filters canonical Russian names/English aliases without changing stored IDs.

## Boundaries
No production or preview deployment, provider calls, new dependencies, secrets, DB/auth/API changes or paid image generation. Existing reference is approved, so no random concept selection or synthetic design replacement. Local reviewer-authorized subagents only at the Impeccable finish/document handoffs.

## Verification / terminal condition
qa:local, 320/390/1280 screenshots and geometry, actual care/observation/map/social/profile/assistant flows, fresh independent finish review, recorded DESIGN.md and source revision. Deliver local preview with screenshots; production stays on rollback revision pending owner decision.

## Evidence notes
Initial webpack build exposed a pre-existing non-pure CSS module global selector hiding Next dev tools; removed it from the module. Turbopack refused a shared node_modules symlink; replaced the local dependency tree with hard-linked existing package files (no install or dependency changes). Dev server stopped before final build to avoid shared .next manifest races.
