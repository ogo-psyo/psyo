# Non-Yandex delivery ledger

Base: ab13977ef75f29303073d051525ffa20b9c9320c. Branch: feat/map-gav-complete-20260907.

All checkboxes in the supplied backlog are acceptance requirements, not evidence of missing production features. No card is Done before its applicable verification.

| ID | Disposition / next evidence | Status |
|---|---|---|
| GEO-01 | Source preservation matrix and baseline inventory: SCENARIOS.md; existing vs new storage distinguished | Verified locally; release pending |
| GEO-02 | Yandex-specific work deferred by message 16274 | Deferred |
| GEO-03 | Provider-neutral saved-place identity, source references, geometry decoder, validation and API state separation; Yandex-specific adapters deferred | Verified locally; release pending |
| GEO-04 | Yandex-specific work deferred by message 16274 | Deferred |
| GEO-05 | Existing search retained: explicit submit, frozen bounds, stable OSM refs, stale response cancellation, quota/error state; Yandex service deferred | Verified locally; release pending |
| GEO-06 | Yandex walking calculation deferred. Current production has manual/GPS LineString only; no incumbent walking calculation found. | Deferred |
| GEO-07 | No provider migration; additive private collections, unchanged old route/zone/share IDs; preflight and reversible schema plan | Verified locally; release pending |
| GEO-08 | Optional folded recovery, metadata/target ID preserved, explicit discard vs fold, active recording survives navigation | Verified locally; release pending |
| GEO-09 | Place/search return, map/list selection, collapsible collections and keyboard-safe panels on current renderer | Verified locally; release pending |
| GEO-10 | Per-dog layer settings/presets, legend, cluster selection and coarse privacy areas retained | Verified locally; release pending |
| GEO-11 | Manual click/center points, accessible reorder/delete/undo, loop closure, planned route edit and recorded route reuse; network pedestrian routing deferred | Verified locally; release pending |
| GEO-12 | Persistent GPS watch, pause/return, explicit gap geometry and measured distance, old PostGIS decoding; physical device caveat in SCENARIOS.md | Verified locally; release pending |
| GEO-13 | Place source/unknown conditions, selection, chosen-collection save and undo, add to walk; no invented dog suitability | Verified locally; release pending |
| GEO-14 | Ordered multi-membership collections, notes, non-destructive removal, map selection and copied route construction | Verified locally; release pending |
| GAV-01 | Explicit search area/radius, manual center selection, separate missing-location/loading/empty/error and stale pet protection | Verified locally; release pending |
| GAV-02 | Both modes and mating retained; compact filter summary, persisted per-dog values/feed position, modal Back/focus | Verified locally; release pending |
| GAV-03 | Hidden save/publication/close explicit, draft preserved, confirmed results and mutation lock | Verified locally; release pending |
| GAV-04 | Own active signal/expiry/management, retained failed draft, stable retry identity, no premature success | Verified locally; release pending |
| GAV-05 | Real candidate fields and reasons, long-name/no-photo handling, matte scoped detail system | Verified locally; release pending |
| GAV-06 | Labelled count/source/status; confirmed accept/reject/cancel/close/block; retained failed confirmation; two-user browser fixtures | Verified locally; release pending |
| VIS-01 | Two same-state detail alternatives in comparison PDF; A carries forward current matte forest direction; typography/main composition retained | Verified locally; release pending |
| VIS-02 | Exported authored empty-state SVG, rounded category/cluster marker system, selected/focus states; no fake participant portrait | Verified locally; release pending |
| VIS-03 | Scoped matte surface/button/panel CSS; all interaction/error states and same-content comparisons | Verified locally; release pending |
| VIS-04 | Existing motion retained, bounded entry/press, reduced motion, server-confirmed state feedback | Verified locally; release pending |
| LINK-01 | Accepted-connection server preview and explicit confirmed place/route proposal; private notes and endpoint boundary, changed-source suppression | Verified locally; release pending |
| UX-01 | Chromium/WebKit, 320/390/1280, keyboard/focus/labels/reduced motion; physical Telegram not claimed tested | Verified locally; release pending |
| OPS-01 | Safe terminal event logs/replay distinction, report and stop thresholds, shared free-provider budget gate; Yandex cost controls deferred | Verified locally; release pending |
| REL-01 | Additive transactional release SQL, local rollback tests, source review, production preflight; deployment and production smoke pending | Prepared; release pending |
| GEO-15 | Implemented bounded selection from recorded local loops: start within 150 m, closure within 40 m, time tolerance min(20%, 5 min), no GPS gaps, no provider requests. Arbitrary new-area network routing remains Yandex-deferred. | In progress |

## Verified source inventory

- Display: Leaflet + OpenFreeMap, `components/LiveMapClient.tsx` and `OpenFreeMapLayer.tsx`. Location privacy circles are distinct from exact user-only GPS.
- Search: existing Nominatim proxy `app/api/map/search/route.ts`; name/address/category text. No walking routing provider/API in source.
- Routes: map route API, PostgreSQL/PostGIS LineString, owner/pet scope, existing shared-token links. UI manual center/click points and GPS watch, review/history/private/shared/rename/revoke/delete.
- Places: existing pet-scoped zones; no separate saved provider-place/collection membership model found in production. New collections require additive storage, not deletion or duplicate zone migration.
- Social: organic/invite/signal request sources, pending/accepted/rejected/cancelled/blocked lifecycle; server guards ownership and blocked owner pairs; verified Telegram contacts only after accepted mutual permission.
- Both Gav live signals and persistent discovery, mating goal, all profile and assistant entrances retained. Detailed tests recorded per slice.

## Slice verification

- `npx tsx scripts/qa/map-session.behavior.test.ts`: PASS (empty/named/recorded/invalid/dog isolation/reorder/loop).
- TypeScript: first social slice passed; subsequent map slice pending.
- No production edits or Yandex calls.

## Verification checkpoint 01:15 MSK

- Domain tests: 8 PASS (collection identity and membership, geometry validation/GPS gaps, meeting redaction, PostGIS EWKB/EWKT, time-budget selection, selected marker clustering).
- Local PostgreSQL transaction: 8/8 PASS (schema, owner isolation, revision compare-and-swap, denied direct client writes, accepted/closed meeting connections). Test transaction rolled back.
- TypeScript passed after implementation slices. Full lint: 0 errors, 219 warnings against baseline 220.
- Build passed; a legacy source-location contract needed updating after map session extraction. Full contracts and browser traversal still being verified; no release claim yet.

## Verification checkpoint 01:35 MSK

- `npm test`: 114 tests in 7 files PASS; latest full lint 0 errors, 220 warnings (within baseline). Build PASS. Full chain stopped on an obsolete direct-state prop source assertion after adding selected-pet gating; that assertion was updated to require the explicit gated state and separate `qa:contracts` passed.
- Added 8 endpoint boundary tests: no principal/foreign pet, CAS collision preserves another edit, command replay, unrelated/closed/blocked connection, removed route snapshot suppression, forged preview rejection. PASS.
- Map browser delivery suite: Chromium + WebKit at 320/390/1280 PASS for GPS fold/navigation/resume/gaps/save, optional draft recovery, explicit search/return, same place in two collections + membership removal.
- Gav browser reliability: Chromium PASS. WebKit exposed no-location composer race and click-trigger focus restoration; fixes added, repeat pending. No real signals or messages sent; two-user fixtures only.
- Supabase cached CLI 2.116.0 works without install. `projects list` and read-only `db query --linked --project-ref cnqcwchseefwqgjgnmyn` succeeded through existing login. No secret was retrieved or printed. Production schema untouched. QA remote project inactive; local Docker transaction tests remain primary SQL evidence.
- Local compiled server http://127.0.0.1:3232; restart after ongoing rebuild before next browser run. Worktree changes remain uncommitted. No production deployment yet.
