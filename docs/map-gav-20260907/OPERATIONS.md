# Delivery operational contract — 2026-09-07

Scope: current OpenFreeMap/Leaflet/Nominatim stack, no Yandex configuration, no paid provider calls. This is a zero-new-paid-API-budget release. Existing account subscriptions are untouched.

## Events and report

`lib/server/mapMetrics.ts` records a random operation ID and start plus one terminal event. No owner/pet IDs, exact coordinates, search queries, notes, chats, credentials or IPs. Successful replay is separate from a new confirmed success. Existing product recommendation events remain in place.

Covered server operations: search, route save, library mutation, meeting preview/send, Gav publication/request response. Map rendering and GPS client lifecycle remain covered by existing state/functional checks; a click alone is not an activation or completed walk.

`node scripts/qa/map-gav-operations-report.mjs < function-log-export.jsonl` aggregates terminal events by operation ID. `operations-example.json` is a real output from synthetic API tests, **not a production baseline**.

## Release stop thresholds

Evaluate every 5-minute export after deployment. Minimum 20 terminal requests per operation: stop rollout / revert application revision if server errors exceed 5% or p95 exceeds 5 s for search / 2 s for mutations. Any confirmed data/permission regression stops immediately regardless of volume. With fewer than 20 events, inspect smoke outcomes and exceptions; do not invent a statistical baseline.

Provider gate: database serializes Nominatim permits to at most one each 1100 ms across server instances. Rate limiting is reported distinctly as HTTP 429. It never invokes a paid fallback. Database-gate errors deny the external request. No autocomplete provider calls on each keypress.

No production baseline or traffic threshold is claimed measured before release. Automated paging integration is not configured in this repository; the release operator monitors the exported report. Yandex quota/cost warning setup is deferred with GEO-02.

## Additive release and rollback

Apply only the four `20260907` migrations after transaction tests. No existing place/route/profile row is rewritten. Save schema-version and aggregate entity counts before and after. Deploy the exact verified commit. Run production smoke against the deployment and alias. Roll back the application alias to prior verified deployment on threshold breach; **retain the additive tables and columns**, so newer collections, meeting proposals and GPS gaps are not dropped. Forward redeploy must read those records unchanged. Never run `db reset`, drop tables, or reverse additive migrations as routine rollback.

Physical Telegram WebView, lock-screen GPS and background delivery require device verification; browser mocks do not establish those capabilities. Current UI explicitly asks to keep the app open while recording, and marks resumed GPS as a discontinuity.
