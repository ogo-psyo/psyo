# Verification · unified care

- Existing suite: 249 tests / 35 files passed (qa:local unit stage).
- Full ESLint budget: 0 errors, 218 warnings vs allowed 220; changed-file final scan also checked separately. Existing warnings are not introduced by this feature.
- qa:contracts and recommendation rollout contract passed after replacing obsolete assertions requiring standalone observations/habits menu rows with integrated reachability checks.
- Browser: Chromium 390/1100 px and WebKit 320 px, mocked API, all passed. Observation create/reload/old-record access; habit failure/retry with retained idempotency key; error does not hide habit actions; care/domain/management Back; independent reminders/habit read failures; direct menu/profile/home entry consolidation; no horizontal overflow.
- Browser evidence: artifacts/unified-care/results.json and screenshots. Data fixtures, no live authenticated-user writes.
- Design detector: 18 advisory findings, no severe findings; existing accepted palette/radii/type context preserved. Approved source takes precedence over stale design-ramp advisories.
- Final `npm run check`: production build, TypeScript and redesign scenario contract passed. No deployment, migration, scheduler or feature-flag changes.
- Physical iPhone and live Telegram integration not tested in this pass. Guest persistence paths and backend contracts unchanged.

Review: no dependency additions, data conversions or deletes. A parent-return marker preserves the selected care domain. The only mutation change is scoped checkin-error presentation; existing endpoint/idempotency behavior retained.
