# Gav complete journey verification

## Delivered scope
Both Gav modes retain browse-only swipes/contained photos. A response opens a context-bearing relationship; grouped incoming/accepted/outgoing list and optional closed history. Accepted relationships contain received proposals first, search/map/saved choice, private library save, safe server preview and explicit send. No saved-library prerequisite. Back returns from detail to list, close returns to source; profile publication returns to browsing. Native dialog top layer isolates all intermediate forms from map controls. Draft place selection survives leaving the connection in this browser session; no automatic send. Meeting proposal is not mutual meeting confirmation.

## Source and services
Baseline production7ec6976. Existing authenticated social service, source-owner checks, privacy projection, avatar allowlist, library command/CAS, preview fingerprint and proposal idempotency retained. No migration/auth/provider/payment/upload flags changed. Opt-in `history=1` adds up to30 closed rows separately from100 active; excluded-owner/blocked relationships remain hidden; contact gating is unchanged and closed contacts are null. Exact place draft is user-selected meeting intent, scoped to pet/request in sessionStorage, never implicit GPS storage. Resuming rechecks server preview.

## Evidence
- `qa:local`:143 tests, build, lint218/220 budget, all existing contracts PASS. Existing owner-isolation live-fixture job explicitly skipped without dedicated QA database; no live-RLS acceptance claim.
- API-focused tests:11 PASS (new3 owned-history/contact tests plus existing8 private library/meeting boundary tests). No credentials or production writes in fixtures.
- `gav-complete-journey.mjs`:Chromium/WebKit×320/390/1280 PASS. Both actors: own signal/error/retry; response/error/retry; incoming accept/error/retry; new place search/error; library save/error/retry; preview/send/error/retry/no duplicate; other participant receives; Back/list/reopen; no contact; reload; report/block cancel; explicit close/history; profile publish/error/retry and return; organic response converges on same chain.
- `gav-journey-edges.mjs`:WebKit PASS on compiled build: meeting load failure/retry, actual map click, named draft survives close/reopen, saved-place preview, cancel sends nothing, keyboard close/list/detail/focus stays within dialog, invite acceptance continuation, expired invite.
- Compiled build:main journey PASS in Chromium390 and WebKit390; edge suite above PASS after draft persistence/CSS corrections.
- Final lint218/220, final typecheck/build/scenario contract PASS.
- Code and visual review:all three sizes; native Safari select adjusted to48px; portrait fallback bounded; sticky relationship identity during preview, old action result removed from profile, contextual rather than generic no-contact/closed states.

## Transparent limitations
The two actors use intercepted API state; service tests exercise handlers with storage fixtures. Actual live Telegram owner accounts, external chat opening/messages, physical software keyboard and background GPS not verified here. Chat QA intercepts existing Telegram bridge; no messages sent. Map tiles may show loading in early-state screenshots; no placeholder is claimed as loaded map. User usability acceptance is not substituted by test count. Existing public Nominatim search/open map availability remains a dependency; no new geographic database or Yandex.

## Initial failures and corrections
Direct test locator for `Ждём ответа` briefly matched list heading and row before relationship transition; scoped to relationship heading. Lint rejected newly introduced warnings; reused photo component, derived selected relationship, removed unused directives/vars and updated time filtering; budget not weakened. Draft resumption changed action label; edge fixture now checks resume label. No production switch occurred during these failures. Initial visual review found sticky-header shadow and Safari native select sizing; corrected across the shared surface.

## Release acceptance
CI and both production aliases must verify exact merged source and existing flag values; run read-only production smoke, private-endpoint401 and guest browser first-entry/manual-area transition. This file alone is not a deployment receipt.
Rollback baseline7ec697612de55d8845ebe6c9f3a83c73b6a732fa, deploymentdpl_HotYS6jQYvifbmAeBu79rjo2PLHi / pso-76lnq00v3-uglanovrms-projects.vercel.app. Restore BOTH aliases without database changes.
