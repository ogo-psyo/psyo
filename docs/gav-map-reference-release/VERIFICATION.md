# Verification — Gav/Map reference release, 2026-09-07

## Code / working-interface checks
- `npm run qa:local`: PASS — 140 tests, build/typecheck, ESLint warning budget unchanged (220), existing application/privacy/identity contracts. Final subsequent display-dedup refinement rebuilt successfully.
- `BASE_URL=http://localhost:3253 npx tsx scripts/qa/gav-map-reference.mts`: PASS in Chromium/WebKit × 320/390/1280. Five image aspect ratios, full-image contain, missing/broken images, horizontal browse vs short/vertical movement, cancel handler, buttons/keyboard, per-pet selection restoration, explicit response error/retry, place save error/retry/reopen and same-source display dedup. Test APIs are intercepted; not live account acceptance.
- Collection to nonempty plan, arbitrary map point, reorder, calculation failure/retry, save failure/retry and reload/GPX: Chromium390 PASS (`collection/`).
- Existing route-value chain: Chromium390 PASS (`route/`).
- GPS recording pause/resume/review, manual route, persistence: Chromium320/390 PASS (`recording/`). Synthetic geolocation, not physical Telegram/background GPS proof.
- Two-user Gav fixture: PASS. No real public signals or user messages were sent.
- Compiled `next start` build: new Gav/places chain Chromium390 PASS (`compiled/`); existing route chain WebKit390 PASS (`compiled-route/`).

## Review / corrected failures
- Navigation covered deck arrows at mobile bottom: workspace scroll boundary now ends above navigation.
- Search within focused route editor incorrectly used the inline Places origin (whose home panel is absent during editing): origin now respects route focus.
- Old collection test expected a second point confirmation: changed to assert direct append then resume editor; three existing points must survive.
- Recording-fit check depended on old green stroke: tests now select a semantic active-route path class and retain geometry-fit assertion.
- Saved place duplicated its same-source remote result: display dedup now uses saved/source identity, selected identity follows saved record. No new persistence command/provider behavior.

## Scope / release
- Real components use existing authenticated services. Fixture dogs, photos and coordinates exist only in QA responses; not application data.
- Universal category/nearby discovery NOT enabled. Empty regional catalog is not queried by the screen; existing search and saved/product places work.
- Existing coarse location/public-avatar policy, authorisation, payment/upload flags and walking provider constraints unchanged. No DB migration.
- Production/CI release evidence will be recorded separately after verification. Physical Telegram and real dual-account write acceptance not claimed.
