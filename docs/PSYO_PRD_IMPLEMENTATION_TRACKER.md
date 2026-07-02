# Psyo PRD Implementation Tracker

Source of truth: `docs/PSYO_FINAL_PRD.md`.

This tracker separates the target PRD from the current production state. It must be updated whenever a PRD slice is shipped.

## Current Production Baseline

- Production URL: `https://pso-mvp-uglanovrms-projects.vercel.app/`
- Current release: `c5054e16c4d2a7a5df0f1cf011cbc385abf28a70`
- Current deploy: `dpl_8qwHAc6WQ8nbbpaos8mDTZn6PXRU`
- Latest local slice: PRD navigation, `things` screen, basic tracking/observations, and owner-scoped active dog switching.

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
| `псё` screen | Partial | Living profile exists; active dog switching is implemented; needs richer history, documents and privacy controls. |
| Reminders/care history | Partial | Basic reminders, completion and calendar exist; notifications and recurrence UX need work. |
| Tracking/observations | Partial | `pet_observations` schema/API/bootstrap and quick UI on `всё` are implemented; deeper history on `псё`, charts and attachments are still open. |
| Public dog card | Partial | Card/share/PDF surfaces exist; user-controlled fields and privacy review need stronger productization. |
| Map/routes | Partial | Private places and map features exist; route sharing/public layer moderation are not production-ready. |
| `рядом` socialization | Partial | Static candidate surface exists; real matching, privacy and invitations are not production-ready. |
| `вещи` wishlist | Partial | Dedicated tab shipped; needs sharing, repeat purchases and partner labeling. |
| Partners/services/clinics | Gap | PRD target only; no production partner directory or booking flow yet. |
| Telemedicine/red button | Gap | PRD target only; needs explicit safety/legal design before implementation. |
| Assistant | Gap/Stub | Current `/api/assistant` is rules/templates only; no production LLM integration. |
| Monetization/Plus/Stars | Stub | Flags and entitlements exist; product/paywall flow is off. |
| Privacy/legal controls | Partial | Legal pages exist; per-card/per-route/per-field controls need UI and backend enforcement. |
| QA/release gates | Partial | Build, contract, visual and prod smoke gates exist; PRD-specific gates need expansion. |

## Next P0 Slices

### Slice 1: Tracking And Observations

Goal: make PRD section 9 real.

Acceptance criteria:

- [x] Owner can add a quick observation from `всё`.
- [x] Observation has type, value, note and timestamp.
- [x] Recent observations appear on `всё`.
- [ ] Observation history is connected deeply to `псё`.
- [x] Data persists for authenticated/Telegram owners.
- [x] Guest/demo mode still works locally.
- [x] QA covers the UI surface and API contract.

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

Remaining:

- Public card URLs need a persisted slug-based dog-specific share flow, not only the current generated preview URL.

### Slice 3: Privacy Controls

Goal: make public sharing trustworthy.

Acceptance criteria:

- Public card has explicit field visibility controls.
- Exact address, sensitive health notes, documents and owner contact are private by default.
- Sharing actions show what will be exposed before opening/sending.
- Map/routes have clear private/shared/public states.

### Slice 4: Map Routes And Sharing

Goal: move the map from saved places to useful routes.

Acceptance criteria:

- Owner can draw/save a route.
- Owner can share a selected route by link.
- Public layer is opt-in and separate from private map data.
- Risk/safe places remain approximate by default.

### Slice 5: Real Assistant Layer

Goal: turn the current API stub into a future AI layer without pretending it already exists.

Acceptance criteria:

- LLM provider is explicit and feature-flagged.
- Prompt includes dog context only with owner consent.
- Assistant can propose actions, but user confirms writes.
- Medical safety rules are enforced.
- Production copy never claims veterinary diagnosis.

## Release Rule

Do not call a PRD area "done" unless:

- UI exists;
- data model exists where persistence is required;
- owner/privacy boundaries are clear;
- local QA passes;
- production smoke passes after deploy;
- tracker status is updated.
