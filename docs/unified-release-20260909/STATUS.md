# Unified release — active implementation, not a release certificate

User decision 2026-09-09: the entire product, including the live agent and its application actions, must be verified before production. Earlier R3 exclusion does not apply to the final acceptance. Production remains c15d067 (both aliases read-only verified at start). Base: docs commit 7340770 on that product revision.

## Implemented locally

- B01: `care_observation_atomic` wraps create/update/delete/restore and receipt in one transaction. Current owner check also applies to replay. Stable absent-date fingerprints; database time assigned once; row-locked metadata merge; legacy pending receipts are not discarded.
- B02: full profile updates use one RPC for pet/passport/social plus receipt; integer profile version prevents a stale device silently overwriting data. Frontend retains draft and compares conflicting fields before retry. New-pet creation slug/fingerprint now stable for retry.
- Additive migrations are in git only; **not applied to cloud**. Legacy profile clients without version/key must refresh before saving with the new server. Old server rollback remains possible against the additive schema, but loses new protections.

## Evidence so far

- Disposable `pso_release_atomic_test` database in local Supabase Postgres; restored schema only, synthetic fixtures, no copied user rows. First restore attempt lacked PostGIS; second isolated database restored with the required extensions. The partial first test database was not reused.
- `supabase/tests/observation_atomicity.sql`: injected receipt failure rolls back each of four domain operations; exact replay; altered-payload conflict; foreign-owner rejection; metadata preservation; legacy pending receipt retained; RPC grants verified. Transaction rolls back all fixtures.
- `supabase/tests/profile_atomicity.sql`: injected social/receipt failure rolls back all tables and version; exact replay; stale-version conflict; foreign-owner rejection; unrelated avatar/contact/public state preserved.
- `scripts/qa/observation-concurrency.py`: 8 concurrent identical creates -> one observation and identical receipts; 8 disjoint metadata patches retained; two simultaneous profile saves of version 0 -> one commit, one conflict. Synthetic fixture removed afterwards.
- HTTP/service/merge tests: 14 new targeted cases. Full qa:local after initial UI merge: 157 tests, build and contracts passed (owner live fixture job explicitly skipped, not counted as live evidence).
- Initial Turbopack build failed on external node_modules symlink; replaced with local copy of existing dependencies. No dependency versions added or changed.
- Conflict browser test: Chromium and WebKit passed at 390px: conflicting values, focus inside modal, Escape retains draft, explicit choice sends new version, successful save returns to original trigger. WebKit exposed a nested-dialog focus race; corrected close-before-restore order and verified again. Browser API responses are mocked, separate from the real SQL tests.

## Still open (not exhaustive replacement for existing audit)

B03 Storage/document lifecycle; 11 audited interaction defects and complete chosen-design transfer; entity-aware navigation/drafts; real owner/RLS/cloud integration; live agent/provider/search/tools/memory and background tasks; physical Telegram iOS/Android; fresh release backup/restore, migration and both-alias rollout.

Groq Free/search entitlement unknown. User asked for plan metadata this turn; no response yet. No paid calls, no new secret requests. Agent PR29 remains separate source pending integration, not live verified. No new production deployment.

## B03 local candidate

- `20260909012000_document_lifecycle.sql`: reservation before Storage, stable owner/key/fingerprint/content hash and UUID path; pending/ready/deleting/deleted states. Existing rows default ready. Upload replay after deletion is rejected, not silently recreated.
- `documentLifecycle.ts`: exact-content retry verification, ready only after successful file upload; recoverable delete with scrubbed tombstone/path; bounded reconciliation (20 entries) in the existing protected avatar-retention cron. Pending uploaded files can recover after process termination; transient read errors never justify deletion. Old tombstones remain for idempotency but stop rescanning after a week.
- `supabase/tests/document_reservations.sql`: actual local Postgres stable ID/path, mismatched fingerprint, foreign owner, no resurrection, RPC grants passed. Real Storage bytes/cron delivery are **not** verified by this test.
- Six stateful service tests: failures after upload/before ready, same-key retry, failed deletion, recovery, late-object cleanup, retained old tombstone. Storage/DB client are mocked here.
- Form keeps text and the File object across close/back within the mounted app, clears on pet switch/explicit reset; domain-scoped error; specific size/type errors; same key for exact file+form retry; correct success text; deduplicated UI result. Refresh still requires choosing the local file again (browser security), not claimed persistent file storage.
- Full qa:local passed with 162 tests/build/contracts, then one additional tombstone-retention test passed after hardening reconciliation. Browser `evidence/document-flow.cjs` passed Chromium/WebKit × 320/390: draft+file retention, scoped 503, retry key, success text, overflow; synthetic APIs only.
- Remaining: live isolated Storage/API/cron integration and process termination tests, production migration/rollback compatibility with old code (old server does not filter lifecycle states; do not roll back to old document handlers while unfinished operations exist).

## Agent integrated into the candidate (still disabled by default)

- Merged PR29 source `98785bf` into the unified branch, with new save/document changes retained. Added integration fixes: agent document search only reads ready documents; observation search includes original note text, not only metric values.
- Unified `qa:local`: 178 tests/build/contracts passed. Two additional private-search behavior tests passed after the integration fixes.
- Actual local Postgres `agent_foundation.sql` passed: owner admission, same-request replay, mismatch rejection, correction/forgetting/privacy epoch, saved-result idempotency, cancellation write refusal and authenticated two-owner RLS. Initial RLS run failed because the schema-only fixture omitted base table grants; copied the base ACL definitions and repeated successfully. This was test setup, not a product RLS defect.
- Agent browser smoke passed Chromium/WebKit × 320/390: reopen/reload, save failure/retry, saved result, memory correction/forgetting, cancellation. Fixture required `connected:true` to represent a connected owner; first run correctly stayed on onboarding without it. All model/API responses mocked.
- Groq account Free/search entitlement remains unanswered; Secret Store metadata is empty. Existing key remains in Vercel. No secret export, paid provider call, cloud Workflow/source check or production change.
- Missing tools (e.g. observation draft/write, map route calculation), complete design transfer and live quality must not be inferred from this foundation merge.
