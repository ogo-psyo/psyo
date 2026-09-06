# Псё — B across working surfaces

## Scope

Ruslan selected B «Дневник», then requested «Обнови все». Local app-wide continuation on design/journal-v6-20260906, wt-pso-journal-v6; first-slice checkpoint193d15f. No production deployment, remote writes, new dependencies, paid providers, API/auth/DB/storage changes.

Updated calendar/care, health/habits, profile domains/editor/capture, map controls/Gav sheets, wishlist form/list, settings/account/pet switcher, public-card editor/page, onboarding/dialogs, support/legal shared presentation. Existing owner state and handlers retained. Back actions moved before h1; headings/tokens/forms unified; old duplicate owner header removed, its account exit and dog management retained in settings. Public avatar gets an honest monogram without an image.

## Evidence

-98/98 unit tests: qa-local.log. Lint0errors/214warnings within220budget; final lint-final.log. No behavior implementation changes after unit suite.
- Production build/TypeScript + redesign source contract passed after final fix: check-review.log. Full source contracts passed: contracts-final.log. Final document name check passed. Initial combined qa:local failed on documenter frontmatter name; actual name restored to Псё, contracts rerun successfully. No weakened privacy gates.
-42 secondary mobile cases320/390: geometry.json, capture.mjs; no horizontal overflow.15 primary route/width cases320/390/1280, no overflow, nav visible, JSerrors0: primary-capture.log, ../design-v6/geometry.json.
- Final reviewer fixes recaptured12 cases320/390/1280, review-fix-metrics.json. Requests exit verified by hit-testing and real click, not just DOM existence. Fresh review fix→ship, REVIEW.md.
- Journal guest note saved/reloaded and all4 scenarios reachable: journal-flow.log. Profile English/Russian alias search + custom breed persistence320/390: profile-flow.log.
- Calendar selected-day filtering, empty state, date inheritance, month roundtrip and selected visual state320/390/1280: calendar-flow.log. Test fixture seeded before hydration; updated forest expectation and waits for transition completion.
- Map two route scenarios320/390: map-flow.log. Actual map tile load not asserted by this smoke.
- Gav synthetic two-user signal/response/refresh: gav-flow.log. Corrected obsolete positional test selector to explicitly select Сейчас рядом; social privacy/action assertions retained.
- Onboarding320/390 incl keyboard-sized viewport: onboarding.log. Existing rAF focus behavior unchanged, test waits for focus transition before assertion.
- Synthetic audio main capture320/390/1280: voice-flow.log. After standalone capture styling, same recording/cancel/review/edit/error fallback checks through profile320/390/1280: profile-voice.log. Input16px/touch targets44px and navigation suppression verified.
- Wishlist create/edit/complete/reload/restore and care create/complete/reload into daily journal320/390: forms-flow.log. Explicit browser guest fixture waits for persisted state; navigation returns to Today after hash-preserving reload. Earlier exploratory harness failures were missing waits/obsolete selectors, resolved without changing app persistence.
- git diff --check passed. DESIGN.md and .impeccable/design.json extended by skill documenter, brand name preserved.

## Preview and limits

http://localhost:3214/?demo=1 — only on this Mac, not a public/production URL. Screenshot fixture data is synthetic. Three paired boards delivered Telegram16166/16167/16168. Raw screenshots/logs retained locally in artifacts/design-v6-all and artifacts/design-v6.

Live Telegram WebView, real microphone, authenticated backend round-trips and actual paid transcription were not verified. Synthetic Gav fixtures do not message real people. Technical review ship is not user acceptance. Production remains unchanged.
