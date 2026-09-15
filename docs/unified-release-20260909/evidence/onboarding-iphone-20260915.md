# iPhone add-dog form · 2026-09-15

User16737 forwarded a47.6s Safari/iPhone recording: ADD DOG modal (not existing profile editor), jumping sheet during keyboard/scroll, duplicate unknown sex, focus outline touching labels. Private video/frames remain outside repository.

Fixes:
- Stop applying visualViewport.offsetTop on every scroll and stop delayed field.scrollIntoView(center). Backdrop anchored top16, bounded by visible height; one inner scroll pane. Body scrolling locked and previous overflow/inert restored on close.
- Name/age/sex/breed each use label+field grid with8px gap;2px focus outline +2px offset stays below label. Keep16px input text.
- One unknown option, keep saved unspecified value semantically empty. WebKit select appearance custom-sized50px, native selection remains.
- Form footer in normal flow, not sticky over text; focus returns to opener without scrolling, header/nav also inert while modal open.

Verification:
- qa:local232tests, lint/build/contracts PASS.
- Updated scripts/qa/onboarding-free-input-ui.smoke.mjs: WebKit+Chromium mobile/touch320/390,520px keyboard-sized viewport; visualViewport scroll cannot move sheet; manual scrolling not reset by delayed focus; field-label gap>=8px; select>=50px; footer reachable; Escape restores focus/inert; reopen retains input; guest profile creation completes.
- Production build at3298 passed both engines. APIbootstrap fixture; guest creation local. No production-owner writes, no physical iPhone keyboard certification.
- One initial Chromium submit timed out; rerun passed. Test now waits for visible session-loading indicator to settle before starting the flow (saveMinimalDog intentionally guards pending auth). No implementation/auth contract weakened.
- Mechanical detector: no errors; Arial and inherited design-token advisories are source-pinned, no palette change.
- No DB, API, provider, flags or notification changes. Previous production2706c5f is rollback.
