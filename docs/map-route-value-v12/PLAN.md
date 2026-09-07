# Approved v11/v12 → working product

Owner Sep7 11:06: «Давай, мне так нравится» in reply to completed route-value prototype. Implement selected composition and chain in working application; preserve Map/Gav logic, all existing manual/recorded routes, privacy and assistants. Yandex deferred. No demo-Moscow graph in production.

## MapZoneService change contract / explicit implementation backlog
- RV-01: Add optional planning JSON metadata to owned route records: v1, mode manual/walking, named/coordinate stops. Existing geometry remains canonical displayed/exported line. Existing records defaultnull; no conversion/deletion. Auth/RLS/link behavior unchanged. Keep coarse shared meeting data unchanged; do not add stops to public meeting payload.
- RV-02: Pedestrian graph adapter based on OSM public ways in requested area. Quantized area requests, no user identity/title/note or exact endpoints egress; bounded request/time/response/CPU limits, rate gate and cache. No fallback to straight lines labelled walking. Existing unlimited manual planning retained when automatic calculation is unsupported/unavailable. New route auto-calculation on explicit action (not typing); stale results never save as current. Local-only graph fixture only in tests.
- RV-03: Map/constructor candidate confirmation, shared stops, reorder/remove/undo/loop, computed result, account save/reopen and GPX. Old routes use existing manual geometry editor, no pretending saved GPS vertices are sparse walking stops. Draft metadata persists per dog. Save pending or failed path disallowed; edit after calculation invalidates readiness.
- RV-04: Approved adjacent composition for Map/Gav, matte tokens and motion preserved. Existing controls reorganized, not removed. Mobile scrolling, desktop split, full modal states and five main destinations preserved.

## State and acceptance
Owner routes table canonical for authenticated user, guest localstore existing fallback. Draft local per dog, plannerstops distinct from path. Stops edit→dirty→explicit calculate→ready/error. Save ready→server confirmed→library; metadata roundtrip preserves stops and path. Existing record/pause/recover/gaps unaffected. Maxauto area/points budget applies only to additional calculation, never removes manual route points. No paid services/dependencies/env changes.

Required: meaningful domain tests; qa:local; UI Chromium/WebKit320/390/1280 with account route fixtures+failure/reload; authenticated integration and appropriate release smoke. Code Ready for release until verified deployment. Migration additive and rollback-compatible. Physical Telegram/GPS acceptance remains separately unverified, not waved through.
