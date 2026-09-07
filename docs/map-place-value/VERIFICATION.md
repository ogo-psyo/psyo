# MAP DoR/DoD — implementation evidence, 2026-09-07

## Outcome / blocker

**Locally implemented and checked; NOT ready for release.** Regional discovery contract and offline importer are implemented, but runtime `data/map-places/catalog.json` intentionally has no regions. The owner has not yet selected first geography (async question sent at task start). The Moscow control extract is not installed as product coverage. Do not deploy this branch as a completed geographic-discovery feature.

Public-source constraints were verified from original publisher documents: Nominatim does not permit area POI harvesting; public Overpass explicitly warns against treating its shared instance as an app backend. This implementation serves an owned regional snapshot instead; no new external per-user provider requests. Offline importer creates a candidate only. Before activation: agreed coverage, reviewed source/known places/timestamp, ODbL attribution and downloadable derived dataset, and update cadence. No paid services, Yandex, credentials or production data changes.

## Checks performed

- `qa:local`: PASS 140 tests / 12 files, types/build, all contracts. Existing ESLint warnings 220, unchanged. Logs in workspace `/tmp/pso-place-qa.log` (durable copy under reports).
- Final `npm run check`: PASS after last small copy/font/preservation changes. No code edits after this final build; subsequent edits concern scripts/docs only.
- `place-value-ui.mts`: six Chromium/WebKit cases at320/390/1280 PASS in local development; `evidence/ui-six-cases.json`. Synthetic owner/account API responses, real library reducer; no real user records or messages. Coverage: category->place, save503/retry, duplicate save, return focus, empty/filter/error, reload/library, selection->named route stops, stops-only draft reload.
- Compiled WebKit390 same complete flow PASS; `evidence/ui.json` is this final compiled pass, not the original six-case count.
- Prior route-value chain regression Chromium390 PASS: `evidence/route-regression/ui-verification.json`, full log in workspace reports. Includes dual entry, calculation/save failure, account-fixture reload, stale guard and GPX.
- Existing map-workspace smoke on compiled version PASS320/390: record/GPS recovery/manual/restore/privacy. It uses browser GPS simulation and is not physical Telegram certification.
- Existing Gav two-user fixture smoke on compiled version PASS. No live two-party actions.
- `place-source-smoke.mts`: one-off real OSM control extract; 1897 source elements,1883 normalized public POIs, no provider fetch in application lookup. `source-smoke.json` includes categories/known examples and explicit control-only bounds.
- Offline importer tested on the same real source, emits bounded candidate and does not install. Source/import outputs in workspace reports `pso-map-place-value`.
- New `check-release-entrypoints.mjs` read-only gate confirms both current production origins remain80e1025; `entrypoints-existing-release.json`. This is the OLD release, not this branch deployed.

## Issues found and corrected during verification

1. Safari mouse/touch clicks do not necessarily set document.activeElement to the trigger. Return now retains the actual clicked element from the event; Chromium/WebKit focus-return tests pass.
2. Initial filter layout pushed the first result below the viewport. Replaced redundant chips + secondary selector with one native category selector; first result visible at390, narrower views scroll normally.
3. Collection->route previously carried only coordinates. SavedPlace selection now preserves order, names and optional placeId; parser/storage roundtrip/GPX tests preserve names without exporting private notes/IDs.
4. Return from place previously zoomed to16 unconditionally. Camera callback now records zoom and restores it with center; normal selected-place focus still uses16.
5. Approximate areas cannot silently become exact collection stops. The collection action asks to open the area and select a real stop instead of dropping it or converting its center.
6. Risk/route/library entrances remain; new point context allows an actual coordinate to start a warning or a plan. Existing save/add actions on approximate records remain with explicit point selection.

Test environment incidents: first browser attempt used127.0.0.1 against Next dev origin protection; switched test URL tolocalhost without weakening server config. No product readiness inferred from that failed attempt. All final screenshot assertions wait for a loaded basemap, not just an empty map container.

## DoD ledger (no blanket Done)

| Card | Built / reused and evidence | Still open |
|---|---|---|
| MAP-01 | Removed false nearby saved-slice and duplicate focus-only action; actual query states and point actions; UI6 + legacy smoke | Connected regional dataset; complete real-owner first-entry acceptance |
| MAP-02 | Bounds/category query, strict no-coverage vs empty/area/error,80-result cap/disclosure, public-only import, stale request guards; domain tests + real control source | Geography selection, actual runtime dataset, completeness/refresh review, published ODbL source; not Ready |
| MAP-03 | Existing persistence reused; explicit account/browser status, dedup/error retry, source/unknown dog access, return trigger/scroll/zoom; UI6 + compiled pass | Real authenticated account roundtrip; screen-reader/device pass |
| MAP-04 | Names/IDs from collection now survive draft/persistence, same constructor; previous route chain regression and unit tests PASS | Designated authenticated production save/reopen, full mixed-origin chain on live data |
| MAP-05 | No recording mechanism rewrite. Compiled legacy smoke passed GPS/manual/pause/recovery | Physical Telegram background/lock/GPS and live account acceptance, not claimed |
| MAP-06 | Existing collections/reducer reused; independent membership preserved by existing unit tests; named selection and reload checked | Full live-account multi-collection/reuse chain with unavailable record |
| MAP-07 | Existing risk privacy retained; new selected-point entry wired, legacy private-default checks pass | Focused new point->warning live write test on designated account, publication only in approved test environment |
| MAP-08 | Final build/contracts, source policy/evidence, fixture-vs-live boundaries, dual-host release gate and runbook updated | No release of this branch; no actual BotFather URL inspection; no baseline conversion study or physical device gate |

The UI/data-adapter work does not close the real place-value chain without its regional catalog. This is a concrete reviewed implementation awaiting missing inputs/acceptance, not a production completion claim. Existing runtime production80e1025 and all user data remain untouched.

Additional compiled WebKit390 pass verifies delayed old category response cannot replace current category/empty state; `evidence/ui.json` includes staleResponseGuard. Five-axis self-review: bounded public-data/query contract, React-escaped labels, no owner notes/IDs in dataset or GPX, backward-compatible optional route metadata, unchanged auth/schema, preserved existing risk/place actions. No independent agent review was performed.
