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
