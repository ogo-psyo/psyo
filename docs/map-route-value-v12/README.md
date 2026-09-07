# Approved route-value implementation

Local implementation based on owner-approved v11/v12. Production remains `ae26728` until a separately verified release. Yandex remains deferred.

## Preserved / changed
- Same Map/Gav destinations, profile, assistants, search, places, collections, layers, recording, signals, acquaintances and responses. Mobile geography above working area; desktop adjacent columns.
- A shared list of named stops can be assembled from a map candidate or real search; confirm, reorder, remove/undo, return to start, calculate/apply, save, reopen, edit, export GPX.
- Authenticated persistence stays in owned `map_routes`. Optional `planning` holds sparse stops; `path` remains full geometry. Existing route IDs, rights, geometry, GPS gaps and sources stay compatible. Old records do not acquire invented stops. Existing manual path mode remains available.
- Walking calculation uses a current OSM graph in a quantized area. It does not use the prototype's fixed Moscow snapshot. No straight-line fallback labelled walking; failure keeps stops and existing geometry, and stale geometry cannot be saved as a current calculated route.
- Snapping to graph vertices (max80m) is previewed and requires applying the result. Long unsplit edges may have no nearby vertex; the product does not claim complete commercial routing coverage. Steps are disclosed; dog access and current closures are not verified.

## Provider envelope (additional automatic feature only)
- Explicit request, authenticated, 2–100 stops, bounded area up to0.09° latitude /0.15° longitude including margin. Larger existing manual routes stay available.
- Overpass public endpoint; no paid keys/services. Only quantized bbox leaves the backend, not user identity, title, private notes or exact waypoint list.
- Shared database gate: maximum50 cache-miss requests/day, at least5s apart; per-process8-area cache, TTL24h. Max16MB response; provider25s deadline, query20s; max100k graph nodes/160k edges; bounded solver, max25k resulting vertices. Errors do not become successful routes.
- Response cache private/no-store. Metrics count start/result/status/duration; no raw private payload.

## Migration / release order
1. Check source and CI, inspect current schema version and rollback target.
2. Apply `20260907120000_route_planning.sql` additively, record version; do not rewrite existing routes. This local work has not applied it remotely.
3. Deploy tested application; verify release SHA and canonical URL, unauthenticated API boundary, real provider readiness and authenticated designated route save/reopen.
4. App rollback retains added JSON field, routes and budget table. Never delete new user data to roll back code.

## Evidence and limitations
- `ui-verification.json`: six browser/viewport combinations; authenticated network fixtures, not production-account writes. Two point entrances, stops-only draft restore, order/loop, calculation failure, save failure/retry, account-model reload, GPX and invalidation.
- `provider-smoke.json`: real public Overpass request and solver, separate from fixture UI.
- `migration-test.sql`: exact migration transaction, access/cap/concurrency/reset checks and rollback, run on local Supabase.
- Unit/API suite covers malformed/private inputs, owner boundary, old records, stop/path distinction, GPX gaps and server save/update roundtrip.
- Real Telegram background GPS / screen lock and real two-party production action acceptance remain unverified. Desktop fixture results do not close those outstanding checks.
