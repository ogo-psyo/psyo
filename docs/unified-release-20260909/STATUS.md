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

Remaining gates are tracked in the table below. Local B03 and targeted interaction fixes are implemented; live Storage, broad inner-state acceptance and complete chosen-design transfer are not finished.

Groq Free/search entitlement unknown. Groq console navigation was blocked by the managed browser policy; no bypass attempted. No paid calls, no new secret requests. Agent PR29 source is now merged locally, not live verified. No new production deployment.

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

## Interaction slice (local verification passed; release gates remain)

- Real categorical editing for temperament, contact rule, energy and trainability; no fake numeric scale. The contact rule is not renamed “sociability”. Inline save keeps the choice after failure; general portrait editor retains its per-domain draft across closing within the mounted profile.
- Exact observation/completed-care detail from profile history uses the original entity ID/text/date; not a new observation form or active calendar.
- Health facts are a draft, not canonical profile/localStorage before successful save. Observation editing retains per-ID values when switching month; a return action restores the selected entry.
- Things uses one real list/edit/create surface. Removed the unsupported favorites shortcut, hid optional classification/planning inside disclosure, default planning off; all bought items in the loaded list remain reachable. No notification-delivery promise.
- In-app Back from health/habits/calendar preserves entry tab/profile sub-surface and restores scroll/focus. Browser/Telegram history gestures and every secondary branch still require explicit acceptance.
- Errors and success notices are scoped to their originating tab; document upload has its own error state. A successful purchase retry clears the earlier error. New care title has a visible persistent label.
- Browser found a real integration regression: profile and always-mounted document dialog had the same sibling React key. Old profile DOM accumulated after transitions. Namespaced keys; regression now asserts exactly one profile root. No production version was changed.
- Browser QA uses synthetic, intercepted API responses and blocks external requests. SQL evidence is separate. During test refinement, a stale Things item text selector, a hidden checkbox locator and a fixture missing social fields were corrected; these are harness problems, not product failures. A dev-server run never reached navigation due dev resource/origin behavior; acceptance uses `next build` + `next start` instead.

## Remaining release gates — cannot declare “all checked”

| Gate | Current evidence | Still required |
| --- | --- | --- |
| Atomic data | Real local Postgres faults, owner boundaries, retries/concurrency; HTTP/service tests | Isolated deployment + actual authenticated API, second device |
| Documents | Local SQL reservations, mocked Storage lifecycle and UI | Actual isolated Storage bytes/cron/process termination; compatible rollback |
| Interaction audit Q1–Q11 | Targeted fixes and browser regression subset | Q8 full chosen-design transfer; broader Q2/Q5/Q9 branches, physical controls |
| Agent foundation | Merged, local RLS and mocked runner/tools/UI | Live free Groq and Compound source shape, actual latency/usage/quality |
| Agent product actions | Read/search, remember, save answer | Observation draft/write is locally verified (A-01); map/action integrations and live execution remain open |
| Background work/knowledge | Source/permissions tests | Cloud Workflow resumption/cancel, real source ingestion/refresh |
| Complete UI | Existing product functions retained and repaired | Selected NarisovanniySANS connected design across all inner states is not transferred |
| Release | Stable production unchanged | Physical Telegram iPhone/Android, fresh backup and compatible migration/rollback, both-alias limited rollout |

Do not turn this document into a release certificate based on aggregate test counts. Groq free entitlement remains a real external dependency, but it does not make the unfinished UI/tools complete.

### Final evidence for the interaction slice

- `npm run qa:local` passed: 180 behavior tests, build/TypeScript and contracts; ESLint 216 warnings vs existing budget220 (no budget increase).
- Immutable local build (`next build` + `next start`, port3285): `interaction-regressions.cjs` passed Chromium/WebKit ×320/390, including visible care label after typing, successful persisted trait reflection, no cross-tab success toast, failed purchase retry/error clearing, singular profile DOM, exact entity and draft/back checks.
- Final profile-conflict retest passed both engines390. Final document-flow and agent-ui smoke passed both engines ×320/390. API replies mocked in every browser run; the agent test makes no inference call.
- Reviewed source for field/owner scoping, draft/reset semantics, focus, error branches, retained functions and incremental render cost. Visually inspected320px trait and Things screenshots; existing theme remains, not approval of the new design.
- Product code and additive migrations are local candidate only; no deployment, cloud migration, real message or paid provider call.

## A-01: agent → canonical observation

See [AGENT-OBSERVATION.md](AGENT-OBSERVATION.md) for state, access, migration and evidence. Model prepares exact-source draft; owner reviews text/date/metrics; confirmation shares the atomic observation service. Eight concurrent saves create one record, post-write fault rolls everything back, foreign/cancelled/deleted cases reject. Saved record opens directly and after reload in history; discard creates nothing. HTTP200 completed-run replay now restores its real action reference.

`qa:local`:186 tests and build/contracts, lint216/220. New complete browser path and existing agent UI passed Chromium/WebKit ×320/390; profile conflict passed both engines. Real local SQL tests are distinct from mocked browser/API/provider evidence. Additive migration applied only to disposable local DB, not cloud. Groq/live search still unverified; complete selected design and overall release gates remain open.

## A-02: conversation and secondary assistant surfaces

See [ASSISTANT-INTERFACE.md](ASSISTANT-INTERFACE.md). Scoped near-white/handwritten interface, plain responses, grouped question/input, native memory/saved-result dialogs. Read failures are not false empty states; memory editing opens explicitly and retains failed input; source/date metadata is shown when available. Old global typography no longer overrides marked headings. Assistant errors are scoped; failed suggested question stays in input. Things has a direct entry with the original form retained.

Local build/186tests/contracts/lint216 passed. Chromium/WebKit320/390 passed new surface (also480px height), memory read/write failures/correction/forgetting, exact observation results and legacy reminder/map actions. Both engines passed motion and reduced-motion/keyboard checks. WebKit focus bug corrected by explicit trigger capture. Final entry grouping visually inspected. Every browser response is synthetic; no claim of actual keyboard/provider/cloud acceptance. Broader product UI, remaining tools and global gates stay open.

## A-03: actual place references from agent to map

See [AGENT-MAP.md](AGENT-MAP.md). Shared map search/API/tool, real typed provider points persisted in completed run, exact map selection and existing save/append actions. Real provider/library ID-collapse defect fixed; load/save failures preserve the selected result. Current two-stop plan, title and note survive adding the chosen third point and reload.

191 tests/build/contracts and lint216 passed. Chromium/WebKit320/390 complete agent-map path passed with synthetic API/source and actual client library reducer. Observation and legacy action regressions passed. No new map provider, paid call, cloud migration or deployment. Route calculation follows in A05 below; autonomous save/read, remaining full-product design and live gates stay open.

## A-04: truthful private context reads

[AGENT-CONTEXT.md](AGENT-CONTEXT.md): canonical route_source instead of nonexistent activity_type; context/history failures stop before generation; original notes and ready-only document metadata. 23 source-derived SQL projections compile in local fixture (not REST/cloud); 20 route behavior tests and 193 full QA pass. Committed b7cea13.

## A-05: calculated route proposal → Map → saved canonical route

[AGENT-WALK.md](AGENT-WALK.md): actual ID-only route tool shares bounded Map routing; proposal survives reopening; original stops/snaps and constraints shown before existing private save. Unrelated active draft cannot be overwritten. 199 QA tests/build/contracts; four browser combinations with failed-save/retry, same canonical ID/path/stops after reload and source draft preservation. Source/provider/HTTP fixtures, not cloud or live model proof. No paid calls/deployment. Autonomous saving/recall of canonical routes remains next work, not silently substituted by saved answer text.

## A-06: agent recall → fresh canonical saved-route view

[AGENT-SAVED-WALK.md](AGENT-SAVED-WALK.md): read_walk collects an owned ID; opening re-reads the canonical record through shared service/API. Missing/failed reads are distinct. Map shows path, note, stops, date/GPS gaps and exports correct GPX without creating a clone or replacing an active route. Viewing hides unrelated browsing controls until close.

204 full QA tests/build/contracts; lint217/220. Final build and 8 browser combinations (saved read + calculated walk regression) pass. 25 read-only SQL projections compile after applying the two existing route migrations only to the isolated local fixture. Still no live inference/cloud/device acceptance or production changes.

## U-01: connected main and direct navigation

[APP-SHELL.md](APP-SHELL.md): grouped real text→assistant; actual recent run; five primary tabs with direct All destinations; original day/voice/care flow preserved as diary. Day rows open exact canonical records. Main/All no longer display the competing desktop care sidebar. All→passport and secondary return restore original entry/focus, including WebKit.

204 tests, build/contracts/lint217; 6 main/direct-entry browser paths plus8 assistant/map regression paths pass. Final screenshots compared with the grouped Naris direction. Synthetic API evidence only; full inner UI and all live release gates remain open.
