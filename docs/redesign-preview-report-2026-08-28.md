# Pso redesign preview report — 2026-08-28

Preview: https://pso-frjz1229e-uglanovrms-projects.vercel.app

Vercel deployment: `dpl_CxTYHLuMpAfkSeQZsYe2cTrpA6sy` (`target=preview`, `status=Ready`). Production was not changed.

## Structural design correction

- Replaced the narrow phone-like desktop shell with a connected editorial care desk: persistent contents rail, full-width working spread and contextual margin.
- Moved navigation into the page architecture instead of treating it as a floating mobile dock on wide screens.
- Rebuilt Today as a two-column care spread and moved Assistant into the active workspace instead of a detached floating widget.
- Added a stable pet monogram/mark fallback and removed leftover uppercase editorial kickers from Profile.
- Kept mobile as a true compact layout with safe-area-aware navigation rather than a scaled-down desktop canvas.
- Recorded the implemented system in `DESIGN.md` and `.impeccable/design.json` so future screens inherit the same direction.

## Closed product gaps

- Removed the conflicting `editorial.css` import and consolidated the active mint/lime/emerald direction.
- Removed dead duplicate Today, Gav, Profile editor and Assistant route implementations.
- Kept one Assistant sheet with in-context failures and honest mutation success.
- Kept one Health flow with create, edit, delete/restore and permanent owner-entered health facts.
- Restored and verified the complete Care Plan route.
- Added Habit update/archive API and UI lifecycle.
- Made Profile tools, documents, card, settings, legal/support and delete flows reachable on mobile.
- Made incoming social invitations reachable in the active Gav workspace.
- Scoped observations and active map routes by pet; reset drafts on pet switch.
- Restored the persisted active pet from `profiles.active_pet_id` on bootstrap.
- Added browser Back semantics for Assistant and detail flows.
- Removed unpersisted fields from active editors and public-card readiness.
- Filtered recoverably deleted observations from bootstrap.
- Restricted health status inputs to canonical enums and added a strict server fallback for unknown values.

## Verification evidence

- `npm run qa:local`: passed end to end.
- `redesign-reachability-smoke.mjs`: passed on 320×700, 390×844 and 1280×900.
- `qa:assistant:visual`: passed on 320×568 and 390×844.
- `qa:map-workspace:smoke`: passed both route scenarios on 320 and 390.
- `qa:journey:visual`: passed all primary routes and detail flows on 390.
- Final local production journey: passed Today, Profile, Map, Gav and Things on 390 with no horizontal overflow.
- Independent interface finish review: `READY` after Profile and Things fixes.
- Vercel preview inspection: `Ready`.

Artifacts: `artifacts/redesign-fix-batch`, `artifacts/redesign-fix-batch-reach`, `artifacts/redesign-final-verdict`.

## Remaining non-blocking debt

- Historical `globals.css` / `refinement.css` / `pouf.css` layering and legacy `!important` rules remain. The conflicting fourth layer is no longer imported; later mechanical CSS consolidation is still worthwhile.
- Live owner-isolation fixtures remain opt-in and were not run against a dedicated QA database; the synthetic owner-isolation gate passed.
