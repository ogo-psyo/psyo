# A07 · Agent command → canonical private walk

Implemented and verified locally, no live/production claim.

## Result and boundaries

The owner has reviewed a real calculated walk in the conversation/Map and directly asks to save that walk. The agent must save the actual proposal into the existing private route library, return its real ID and reopen the same route later. Saving a textual answer is a different operation. No public/shared route, external owner message, provider change or paid inference.

Source of truth: owned completed `agent_runs.result.walk` after the privacy epoch; canonical result: existing `map_routes`. The model supplies only an exact server-known proposal reference, never geometry, owner, privacy or arbitrary SQL. A source remains tied to owner/pet/conversation. Unsupported or ambiguous save intent must not silently target an unrelated answer or older walk.

## State contract to implement

- Prepared: a completed, validated walking result exists and is visible for review.
- Saving: current owned acting run is running and explicitly requests saving; server resolves the same proposal.
- Saved: route and durable source→route receipt commit atomically; repeat reuses the route, including concurrent delivery.
- Removed: canonical route was deleted; its prior receipt must not recreate it on retry.
- Failed before commit: no route, proposal retained; retry uses the same key/reference.
- Cancelled before commit: no write. Cancelled/failed after commit: expose the already-saved reference rather than hide the side effect or falsely promise rollback.
- Wrong owner/pet/thread, privacy-erased source, nonexistent/uncompleted/invalid proposal: fail closed with no route.

Use a common route-domain service/normalization with the existing Map path. Isolate any additional atomic run/receipt guard; do not have the server call its own HTTP endpoint. Current ordinary route insert/replay has no deletion tombstone, so do not blindly inherit that behavior for the new agent operation. Decide the additive persistence change before wiring the tool/UI; no silent domain change to match a mockup.

## Acceptance

Actual local Postgres: save, retry, concurrent save, fault rollback, owner boundaries, cancellation order, deletion/replay, original geometry/stops/estimate preservation. API/tool tests: verified refs, explicit/negative/unrelated requests, no arbitrary payload and no false saved result. Browser: completed and interrupted run with committed route → same Map object, canonical reload, failed save/retry, existing unrelated draft preserved. Existing manual route save/read remains working. All mocked/live/SQL boundaries explicit; full free-provider/cloud/Telegram gates remain open.

## Chosen implementation

Add a shared canonical route-save service and additive transactional receipt for the existing Map API and agent adapter. Seed receipts for existing active routes with known request fingerprints. The agent wrapper adds same-owner/pet/thread/privacy-era and acting-run checks in the same transaction, then records the committed route in existing `agent_mutations`. A deleted route leaves a receipt tombstone; the agent cannot resurrect it by repeating a source proposal.

The source key is stable per completed walking proposal. This is retry deduplication, not a promise to merge arbitrary similar routes or a manually edited route with a different request identity. Missing historical receipts for routes deleted before the migration cannot be reconstructed; migration/rollback notes must state that boundary.

Expose committed route metadata separately from answer completion in the run API/UI. Running/failed/cancelled tasks may contain an already committed action; do not require a successful final model answer to reveal it. Model parameters are server-known source IDs only; title/path/planning/privacy are resolved from the saved proposal. Start with explicit save imperatives compatible with the existing agent write guard, reject negated/unrelated commands and clarify ambiguity. This is not evidence of live language-model accuracy.

## Evidence · 2026-09-09

- 220 final Vitest tests pass (`/tmp/pso-a07-final-tests.log`). Build passed in `/tmp/pso-a07-full-qa3.log`; remaining contracts rerun successfully in `/tmp/pso-a07-contracts.log` after updating the source-location check for the extracted shared service. Lint215/220; additional changed-file lint no errors. No live isolation test counted: that job explicitly skipped.
- Real Postgres: `evidence/agent-walk-save.sql` injects a failure after route insertion, proves whole rollback; same/new run replay, strict source geometry/stops, owner, cancellation, deletion, privacy epoch, service-only grants and mutation-kind isolation. `scripts/qa/agent-walk-save-concurrency.py`: eight concurrent requests, one route/action receipt, seven replays.
- `scripts/qa/agent-route-domain-sql.ts` executes the production shared domain service through a test RPC transport against real SQL: GPS gaps/stops/recorded date/note preserved, edited canonical title reused, changed-payload conflict and deleted-route tombstone. This is **not** hosted Supabase HTTP proof.
- Fresh migration: schema-only pre-A07 backup restored to separate `pso_a07_migration_test`; synthetic legacy route inserted; full migration applied once (not piecemeal); atomic fixture and `evidence/agent-walk-legacy-save.sql` pass. No real user rows copied. Test DBs retained for inspection, not connected to the app.
- 20 browser combinations: Chromium/WebKit ×320/390, five suites: new `agent-save-walk.cjs`, canonical read `agent-saved-walk.cjs`, calculation/Map save `agent-walk.cjs`, inner assistant `assistant-surface.cjs`, memory/results/cancel `scripts/qa/agent-ui.smoke.mjs`. New action: precommit failure → retry → committed result despite failed answer → canonical Map → return/reload → cancellation receipt → removed state. Existing unrelated Map draft remains unchanged. All browser API responses synthetic. 320/390 final PNGs visually inspected.
- Initial failures preserved in local logs: unqualified PostGIS trigger under restricted search path (fixed in migration); lint test callback type (fixed); legacy bearer-priority Map expectation (explicitly changed to reject conflicting principals); privacy source scanner still inspecting old handler (updated to shared service); obsolete assistant entry label (updated to current Profile entry). No failed/intermediate artifact is counted as final acceptance.

## Review and rollout boundary

Correctness: route+receipt+mutation one transaction, deterministic source key, tombstone, actual fresh canonical read. Readability/architecture: common Map-domain adapter, agent-specific guard wraps the common function; model receives IDs, not SQL/geometry fields. Privacy: owner/pet/thread checks, source privacy epoch, private-only agent creation, service-only RPC/table grants, conflict between bearer and app session rejected before Map reads/writes. Performance: bounded four-result context and tool loop; receipt PK lookup plus one small canonical metadata read per active run poll; no extra inference or network provider. UI: committed action survives final-answer failure/cancellation, unavailable/deleted state not called a save failure, no duplicate saved-route button.

Apply additive migration **before** this server version, with backup and migration verification. Keep the receipt table/functions on code rollback; never drop receipts to retry a failed deployment. Existing clients calling the new API remain compatible; old source-based ID/fingerprint formula is unchanged. Drain old server writers when enabling the new guarantee: rolling back to an old insert-only server loses tombstone and agent-action protection. Old routes deleted before migration have no reconstructable receipt. The new server can recover active legacy routes committed after initial seed. No production migration or rollout performed here.

Language boundary: only direct supported save imperatives are admitted. Bare «сохрани» must refer to the immediately preceding completed walk; other/ambiguous requests are clarified rather than saved as unrelated answer text. Previously calculated source must appear in the bounded owned conversation context. No claim that a live model selects these tools correctly yet. A new calculation in the same unreviewed run is not auto-saved.

Remaining full-release gates: live free provider/search entitlement and quality/latency/usage, hosted API/RLS/Storage/jobs/two owners, physical Telegram iOS/Android, remaining forms/actions, fresh backup and limited both-alias production checks. This A07 completion does not close the overall release.
