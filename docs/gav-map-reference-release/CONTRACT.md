# Gav / Map reference release — 2026-09-07

Owner approval: visual reference v14 liked; requested responsive uploaded-photo handling, separate Places redesign, then explicit «И кати в прод». Source production 80e102598e3cbfe6e8d8880cce60a41e122099d6. Branch feat/gav-photo-map-reference-release incorporates prior unreleased map fixes from 208df1b/5a9ed90; every affected scenario is rechecked.

## DoR / state contract
- Real SocialCandidate and existing social service remain source of truth. Only currently public/allowed avatarUrl is rendered; no private photo asset projection or new fields.
- Candidate browsing ID is per-pet view state. Swipe/arrow transitions browse only; explicit CTA calls existing onRequest/scenario/busy/error lifecycle. Pending/accepted partners remain excluded; all existing scenario filters and both Gav modes retained.
- Photo fit is contain in a stable aspect-ratio frame. Missing/broken images are explicit, no fake dog, no content crop or custom upload requirement. Portrait/landscape/square/extreme aspect ratios and 320/390/desktop/reduced motion verified before release.
- Map library and current feature/search APIs remain authoritative. Places panel displays saved/product points in visible bounds, or explicit actual search results. The empty regional catalog is NOT a prerequisite or a working nearby service; no auto calls to offline discovery API.
- Map selection/list agree; details are inline. Save uses existing command/idempotency/account vs guest rules. Adding points appends/deduplicates in the same draft; collections/history/manual recording retained.
- No migrations, auth, payment, upload-provider, Yandex or new paid-service changes in this slice.

## DoD / release gate
- Photo fitting and fallback, swipe direction/threshold/vertical/short/cancel, button and keyboard paths, browsing persistence and explicit-response failure/retry checked on working components.
- Saved points -> map selection -> append nonempty plan -> preserve source titles/IDs -> save/reopen route; existing collection, search, GPS recording and two-user Gav fixture passes.
- No horizontal overflow; no actions hidden by app navigation; focus/reduced motion verified. Screenshots use labeled fixture context, not production proof.
- qa:local + build + CI. PR source reviewed; source version/deployment READY and both entry URLs checked after publication. No fake live write coverage/physical Telegram claims.
- Rollback existing deployment on BOTH aliases if release verification fails. No data rewriting.

## Scope limits
The screenshots/prototype are not a new backend. Universal browse-all-parks/clinics source remains deferred; working textual search and user's points are kept. Current private-avatar restrictions, coarse geolocation and existing walking-provider limitations are preserved.
