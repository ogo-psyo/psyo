# Verification — full functional interface transfer

## Current checks
- Full `npm run qa:local`: PASS,232tests/31files, lint196warnings0errors within220budget, build and all source/API contracts. Log: /tmp/pso-exact-parity-qa3.log.
- Latest final-build `npm run check`: PASS, including typecheck and redesign scenario contract. /tmp/pso-exact-parity-verdict-build.log.
- Source-contract expectations moved to actual new components; atomicity/privacy/idempotency checks retained. Previous two failures were resolved by restoring planned-purchase entry and updating moved-component assertions, not dropping functional coverage.
- Browser verify-parity: profile fields/failure/draft/retry; settings/multi-pet entry/habits; atomic planned purchase/edit/openplan; calendar/history; GPS tool access; memory create/error/retry. Post-fix recapture PASS; see evidence/verification.json.
- Browser extras: social forms/contact actions, public card, diary, document deletion confirmation/cancel, settings320/1280/support. Synthetic APIs, zero JavaScript errors and horizontal overflow in final post-review capture.
- Voice: denied microphone → editable draft → return with focus/noautosend PASS Chromium; earlier WebKit PASS. No live recording/STT claim.
- Existing record/map/place/care scenarios PASS: failure/same-key retry/canonical receipt/reopen/undo; place unsave preserves other collection membership.
- Earlier16 targeted API boundary tests and7 disposable SQL transaction/ROLLBACK cases PASS. No migrations applied to original/cloud database.

## Visual evidence and review
`output/exact-mockup-20260915/full-review/`: original source20views and app31states/sizes. Synthetic data differ, so these are not numerical pixel-equality proof.
`output/exact-mockup-20260915/parity-review/`: extended states and browser verification JSON.
Fresh Impeccable review identified5material fixes: public-card paper/type, duplicate diarychrome, social chip/labels, modal close/status overlap, mapaction spacing/icon. Corrections recaptured and independently rechecked: disposition **ship** for the reviewed findings, no visible regressions. See REVIEW.md.

## Limits
No production deployment, live model/search/cloud/storage/RLS or physical Telegram-device certification. Free OpenFreeMap geography was previously inspected; remaining API replies synthetic. Model/voice capability and second-owner meeting behavior are not proven by fixtures. There is no outstanding design-approval request for preserving functionality under user16719.

## Preservation
Original22dirtyfiles SHA verified0mismatches; backup workspace/output/pso-exact-interface-20260915/pre-existing/. Historical verification retained in history/before-functional-parity-VERIFICATION.md. PR30 remains unchanged remotely.

- Conversation browser verification PASS: recent conversation entry, no automatic send, original thread retained, suggested question uses same thread, close returns home. Synthetic API only. Initial harness locator matched hidden home textarea; scoped active composer, no product change.
- Final targeted lint9warnings0errors, existing effect warnings. Full QA warnings remain under budget. `git diff --check` PASS. Logs copied into evidence/; logfiles intentionally local/ignored.
