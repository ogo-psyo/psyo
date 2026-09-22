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

## Shared calendar correction
- Full unit suite: 252 tests passed. Added coverage for ISO range validation, inclusive-start/exclusive-end observation-window filters, continuation under the same owner/pet constraint, and 400 before reads for partial/invalid ranges.
- Browser: Chromium 390 and WebKit 320 passed shared-care-calendar.smoke.mjs with mocked APIs: 35 older records spanning two pages; care and observations on same selected day; edit/back to the same day/month; observation filter; month search; delete and restore from the calendar; failure/retry without a false empty day; stale month response cannot overwrite a new selection.
- Original unified-care smoke also passed Chromium 390/1100 and WebKit 320 after history navigation updated to shared calendar.
- Evidence: artifacts/shared-care-calendar/results.json, *-calendar.png and *-day.png. No live user data writes.
- Prior documentation limitation (care-only calendar) is superseded by the owner's explicit correction; the active observation history now redirects to the shared calendar instead of mounting its old separate date filter.
- Final build/TypeScript/redesign contract passed after undo wiring. All source contracts passed after updating the calendar handler checks to the shared-date navigation. Final changed-file lint: 0 errors; full lint budget 219/220. Design scan: 21 advisory findings in incumbent components, no severe findings.

## Search / filter presentation · 18:32 owner correction
Replaced collapsed search with an always-visible, labelled search input above category chips. Fixed the shell's important transparent-button reset overriding chip backgrounds/borders. Matte outlined chips and selected lavender state; no data/logic changes. Build/typecheck/redesign contract passed, existing shared-calendar smoke passed Chromium390/WebKit320 including computed fill/border/radius/44px target checks and search/filter results. Screenshot: artifacts/shared-care-calendar/search-chips-390.png. Production unchanged.
