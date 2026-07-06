# Psyo PRD Implementation Tracker

Source of truth: `docs/PSYO_FINAL_PRD.md`.

This tracker separates the target PRD from the current production state. It must be updated whenever a PRD slice is shipped.

## Current Production Baseline

- Production URL: `https://pso-mvp-uglanovrms-projects.vercel.app/`
- Current release: see `/api/internal/health`
- Current deploy: see Vercel production deployment for `https://pso-mvp-uglanovrms-projects.vercel.app/`
- Latest production slice: PRD navigation, `things` screen, tracking/observations on `всё` and `псё`, owner-scoped active dog switching, public-card field controls, explicit map privacy modes, privacy-safe map share page, persisted dog-specific public card links, owner revoke/regenerate controls for public-card links, PSYO product design context for UI gates, and the first Plus/Telegram Stars subscription readiness contour.

## P0 Product Shape

The production version must have these five primary tabs:

- `всё`
- `псё`
- `карта`
- `рядом`
- `вещи`

Support surfaces must stay reachable, but not dominate the main navigation:

- care plan / reminders;
- public dog card;
- assistant API stub / future assistant surface;
- legal/support;
- auth/session state.

## Implementation Status

| PRD Area | Status | Notes |
| --- | --- | --- |
| Telegram/web app shell | Partial | Mini App/session foundation exists; production session behavior still needs end-to-end Telegram verification. |
| Owner-only auth model | Partial | Supabase + Telegram owner bridge exist; bootstrap now returns owner-scoped pets and rejects non-owned active dog requests; privacy controls still need hardening. |
| `всё` screen | Partial | Main care summary exists; quick observations now feed the screen, but stronger "one next step" logic still needs work. |
| `псё` screen | Partial | Living profile, active dog switching and observation timeline are implemented; documents and deeper health/history views are still open. |
| Reminders/care history | Partial | Basic reminders, completion and calendar exist; notifications and recurrence UX need work. |
| Tracking/observations | Partial | `pet_observations` schema/API/bootstrap, quick UI on `всё`, and profile timeline on `псё` are implemented; charts and attachments are still open. |
| Public dog card | Partial | Card/share/PDF surfaces exist; owner can choose visible preview/share fields; authenticated/Telegram owners now publish stable slug-based dog-specific links backed by `dog_cards`; owner can revoke or regenerate the active link. Version history and richer card scenarios are still open. |
| Map/routes | Partial | Private places, route drawing and explicit save modes exist; shared links/public moderation backend exists, but public share pages and moderation ops are still incomplete. |
| `рядом` socialization | Partial | Static candidate surface exists; real matching, privacy and invitations are not production-ready. |
| `вещи` wishlist | Partial | Dedicated tab shipped; needs sharing, repeat purchases and partner labeling. |
| Partners/services/clinics | Gap | PRD target only; no production partner directory or booking flow yet. |
| Telemedicine/red button | Gap | PRD target only; needs explicit safety/legal design before implementation. |
| Assistant | Gap/Stub | Current `/api/assistant` is rules/templates only; no production LLM integration. |
| Monetization/Plus/Stars | Partial | Free/Plus package is defined in the final PRD and entitlements API; main UI shows the Plus package; Telegram Stars checkout intent and server-side payment reconciliation exist behind billing/new-invoice flags. Payment smoke/legal gates are still required before enabling invoices in production. |
| Privacy/legal controls | Partial | Legal pages exist; per-card/per-route/per-field controls need UI and backend enforcement. |
| QA/release gates | Partial | Build, contract, visual and prod smoke gates exist; PRD-specific gates need expansion. |

## Next P0 Slices

### Slice 1: Tracking And Observations

Goal: make PRD section 9 real.

Acceptance criteria:

- [x] Owner can add a quick observation from `всё`.
- [x] Observation has type, value, note and timestamp.
- [x] Recent observations appear on `всё`.
- [x] Observation history is connected deeply to `псё`.
- [x] Data persists for authenticated/Telegram owners.
- [x] Guest/demo mode still works locally.
- [x] QA covers the UI surface and API contract.

Shipped locally in the latest tracking slice:

- Added observation timeline to the living profile `псё`.
- Recent observations now show mood, appetite, stool, energy, note and local/saved state outside the main `всё` capture flow.
- Updated `scripts/qa/check-observations-contract.mjs` so tracking must remain connected to both `всё` and `псё`.

### Slice 2: Multi-Dog Foundation

Goal: support more than one dog without confusing ownership or active context.

Acceptance criteria:

- [x] Bootstrap can return multiple pets.
- [x] User can switch active dog.
- [x] Each dog has separate profile, reminders, wishlist, zones and observations in the active app context.
- Public card and share URLs stay dog-specific.
- [x] No cross-dog data leakage in bootstrap: requested `petId` must belong to the current owner.
- [x] QA covers the multi-dog contract.

Shipped locally in the current slice:

- `/api/app/bootstrap` returns `pets[]`, `activePetId`, and the selected dog's scoped reminders, zones, wishlist and observations.
- `petId` query param is owner-scoped; non-owned ids return `PET_NOT_FOUND_OR_NOT_OWNED`.
- App shell shows an active dog switcher when the owner has more than one dog.
- Switching active dog clears stale local lists before loading the selected dog's state.
- Added `scripts/qa/check-multidog-contract.mjs` to `npm run qa:local`.

Shipped locally in the current public-card persistence slice:

- Added `dog_cards` schema/migration for stable public-card rows scoped to a specific dog.
- Added `/api/dog-cards` to create/update the current owner's unlisted card link.
- Public card actions now publish a stable `/dog/[slug]` link before opening/sharing for authenticated or Telegram owners.
- `/dog/[slug]` can read persisted safe fields by slug, while still supporting the older query-param preview fallback.
- Unlisted cards are served by the app route; they are not broadly exposed through public Supabase RLS.

Shipped locally in the current revoke/regenerate slice:

- Added owner-facing controls to revoke or regenerate the active public-card link.
- `/api/dog-cards` now supports revoking active rows and regenerating a fresh slug while preserving owner checks.
- Revoked or missing persisted slugs now return 404 instead of falling back to a generic public-card page.
- Updated the public-card QA contract so revoked links cannot silently render as default cards.

Remaining:

- Need version history and richer card scenarios.

### Slice 3: Privacy Controls

Goal: make public sharing trustworthy.

Acceptance criteria:

- [x] Public card has explicit field visibility controls for breed, character, triggers and area.
- Exact address, sensitive health notes, documents and owner contact are private by default.
- [x] Sharing actions show a preview of what will be exposed before opening/sending.
- [x] Map/routes have clear private/shared/moderated states in the owner UI.
- [x] QA covers the public-card privacy contract.

Shipped locally in the current slice:

- Added owner controls for what appears in the public-card preview/share URL.
- Hidden fields are removed or replaced with safe placeholders in the generated card URL.
- The public-card screen states that exact address, owner contacts, medication and internal notes are not included.
- Added `scripts/qa/check-public-card-privacy-contract.mjs` to `npm run qa:local`.

Remaining:

- Field controls now persist into `dog_cards.fields` when the owner publishes a stable link; revoke/regenerate controls exist for the active link.
- Map/routes need separate private/shared/public UI states and moderation flow.
- Public map/share pages and moderation operations are still incomplete.

### Slice 4: Map Routes And Sharing

Goal: move the map from saved places to useful routes.

Acceptance criteria:

- [x] Owner can draw/save a route.
- [x] Owner can choose private, link-only or moderation-required save mode before saving a route/point.
- [x] Public layer is opt-in and separate from private map data.
- [x] Risk/safe places remain approximate by default.
- [x] QA covers the map privacy contract.

Shipped locally in the current slice:

- Added map save modes: `Только мне`, `По ссылке`, `На модерацию`.
- Route/point saves use explicit visibility: private, shared, or public-pending.
- Shared saves copy the generated share URL when backend returns it.
- Public/general map text stays gated behind moderation and separate consent.
- Added `scripts/qa/check-map-privacy-contract.mjs` to `npm run qa:local`.

Remaining:

- `/map/share/[id]` page now exists as a production-safe first shared point/route surface without exact coordinates and without internal "sandbox/not ready" copy; it still needs a richer public projection before calling map sharing complete.
- Public moderation queue/admin flow is not implemented yet.

### Slice 5: Real Assistant Layer

Goal: turn the current API stub into a future AI layer without pretending it already exists.

Acceptance criteria:

- LLM provider is explicit and feature-flagged.
- Prompt includes dog context only with owner consent.
- Assistant can propose actions, but user confirms writes.
- Medical safety rules are enforced.
- Production copy never claims veterinary diagnosis.

### Slice 6: Plus Subscription Readiness

Goal: make PRD section 18 sellable without enabling unsafe production billing.

Acceptance criteria:

- [x] Final PRD defines Free, Plus, limits, price source, Stars provider and non-paywalled safety basics.
- [x] Entitlements API returns Free/Plus plan package, upgrade readiness and invoice state.
- [x] Main `всё` screen exposes a concrete Plus package and price without claiming billing is enabled.
- [x] Checkout endpoint creates Telegram Stars invoice links only when billing and new-invoice flags are enabled.
- [x] Telegram webhook handles `pre_checkout_query` and `successful_payment`.
- [x] Plus entitlement activation is server-side only after signed payload verification and Telegram charge id receipt.
- [x] QA covers the subscription contract and keeps billing disabled by default.

Remaining:

- Legal/payment/refund/support texts still need owner approval.
- Real Telegram Stars payment smoke must pass before enabling `BILLING_ENABLED=true` and `NEW_INVOICES_ENABLED=true` in production.
- Refund/cancel reconciliation needs a follow-up operational slice.

## Release Rule

Do not call a PRD area "done" unless:

- UI exists;
- data model exists where persistence is required;
- owner/privacy boundaries are clear;
- local QA passes;
- production smoke passes after deploy;
- tracker status is updated.
