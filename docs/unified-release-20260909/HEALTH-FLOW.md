# U03 · Records and health, complete inner flow

LOCAL SLICE VERIFIED. Read the actual saved text first; optional creation/edit details, not an obligatory metrics questionnaire. No production changes.

Confirmed source breaks to fix with this flow:
- `healthTimelineService.mapHealthEntry` drops multi-metric metadata. The module reload can replace a complete bootstrap record with only its primary metric.
- The feed returns only the latest30 entries and has no continuation; a calendar can look empty for older dates without querying them.
- Manual create/edit errors are global; create resets selected day even on failed `onSave:void` and accepts invalid receipts before clearing input. A subsequent module read failure can obscure committed write status.

Acceptance: owner-scoped complete metric/text/date projection; bounded keyset continuation (stable observed_at/id tie order); actual selected record and full source text; free text first with optional metrics; explicit new/edit states, truthful save result, preserved failure/close/back/month draft; scoped load/write/facts errors; repeated/foreign/demo receipts rejected. Existing profile/agent record viewers remain canonical. Preserve health facts as a separate profile draft with conflict review. Test cold/reload, older equal-time pages, read errors, create/edit/remove/restore/retry and helpers, narrow/short/desktop layouts.

No inference about missing timestamp or empty metric. No search across files or unimplemented server search claimed. Time precision and reversible restoration of removed purchase plans stay separate. Live Groq/cloud/device gates remain open.

## Implemented

- `HealthTimelineScreen`: original text in the feed; new record opens explicitly, text first and optional metrics; calendar is a day filter rather than the compulsory first interaction. Constant facts sit after the history, keep a separate draft and scoped errors. Closing a record editor retains its draft. Create selects the saved record's day only after a verified receipt. The deleted-record notice is local, not duplicated in a global toast.
- The record projection preserves all four metric fields; an explicitly empty value never falls back to the old primary metric. A complete edit can clear a metric or become a plain note. An incomplete clear is rejected, not silently ignored. Other primary facts (weight, sleep, activity etc.) retain and expose their own editable value/type.
- Manual writes have a synchronous per-pet lock, stable retry key, strict expected pet/record/date validation, no demo success and no dependent post-commit reload. Late reads/writes cannot update another active pet. Delete checks its actual receipt; restore uses the canonical returned row. Arbitrary12-record client truncation removed.
- `/api/health`: owner/deleted filters, two-key bounded pagination, exact cursor timestamps (including microseconds), original note/metrics, private/no-store. Invalid continuation/auth mismatch fail before reads. A read failure retains already open rows and differs from an empty history.

## Verification and boundaries

- Full `qa:local`:213 tests, build/contracts, warning budget215/220. Subsequent primary-fact preservation has focused endpoint/atomic/projection/auth tests (19 passed), a new immutable build, and expanded UI checks. Final manifests record exact completion below.
- `evidence/health-keyset.sql`: temporary synthetic equal-microsecond rows, owner/deleted filter, transaction rollback. `health-metric-clear.sql`: actual existing `care_observation_atomic` RPC in isolated `pso_release_atomic_test`, clear/replay/plain-note conversion and unrelated metadata preservation; generated rows rolled back.
- `health-flow.cjs`: Chromium/WebKit ×320/390/1280; older page/reload, visible original text/metrics, failed read with retained rows, save/edit/delete/restore failures+retry, one POST for repeated submission, same key for retry, empty/foreign/demo receipt rejection, close/back draft, secondary-fact edit and health-profile error isolation. Browser endpoints are intercepted synthetic fixtures; SQL and HTTP tests are separate evidence, not a live end-to-end claim.
- Existing interaction and assistant regressions passed8 cases after text/calendar changes; they retain month-edit/back/focus/profile conflict boundaries and assistant context, not only the new happy path.
- Review found and fixed legacy CSS specificity and incorrectly module-scoped CSS class selectors. Intermediate harness failures involved bootstrap's already-loaded older row, a text locator matching the composer before commit, and a selector tied to text while editing that text. The fixture/locators were corrected; the unverified screenshots are not release evidence.
- Still NOT a whole release certificate. No live provider/API/cloud/physical Telegram proof, no new migration, deployment or paid call. Existing guest storage remains local, not cloud sync. Archive loading is explicit and bounded per page; a calendar cannot claim an unloaded date is empty.

A final cache review separated the paged health feed from bootstrap's limited profile snapshot. Saving constant facts does not truncate already loaded pages; an explicit fresh feed read starts a new cursor chain and only retains an active edit draft. Cold reload does not merge deleted local-cache rows into fresh server history. `health-boundary.cjs` covers27 records with the same timestamp, a profile save/bootstrap and subsequent cold reload after a server-side deletion.

Final immutable build: `/tmp/pso-u03-pagination-build.log`.15 browser cases passed:6 expanded records paths,1 equal-time/cache boundary,4 interaction and4 assistant regressions. Final targeted19 tests pass; latest lint215/220 and contracts pass. The full QA baseline before final primary-fact/cache refinements was213 tests, not a claim that a new full suite ran after every refinement. No unresolved failure in these checks.

Visual-only follow-up after85bd09c: actual metric rows still inherited a legacy beige box/heavy weight. Scoped overrides remove that box and set readable normal-weight values. Rebuild and dedicated Chromium/WebKit390 computed-style+viewport checks passed; no functional code changed after the15-case functional run. Both CI checks on85bd09c passed.

Final visual verification also checks the parent metric grid, not just its cells: the inherited box came from both levels. Latest grid build and both-engine390 visual checks passed; fresh viewport image inspected and sent with an explicit synthetic/local caption.
