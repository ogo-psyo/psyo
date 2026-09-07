# Verification — approved working-app transfer

- `npm run qa:local`: PASS; 135 tests in11files, build/typecheck, all required static contracts; existing ESLint warning budget unchanged220. Full log archived in workspace reports (not committed).
- `route-value-ui.mjs`: compiled app Chromium/WebKit ×320/390/1280 PASS. Auth/data mutations are designated network fixtures, not real accounts. An initial compiled desktop pass waited on a loading basemap and timed out; the subsequent loaded-map pass succeeded. No force click or fabricated map replacement.
- `map-workspace-smoke.mjs`: guest recording, GPS-loss/resume, pause/finish, discard-cancel/focus, save/delete-cancel, manual construction, private risk reset, reload and deniedGPS PASS320/390. A simulated location update emitted position-unavailable; the test verifies the real pause/recovery response. Real Telegrambackground behavior is not certified.
- `woof-two-user-smoke.mjs`: Chromium and WebKit PASS with two synthetic owners; publication/response/state-refresh network fixtures, no messages sent to real users. Resized320/390/1280 without overflow. Captures may show provider loading independently of verified social state.
- Real Overpass source smoke PASS:981m,56path vertices,14estimatedminutes,steps; waypoint offsets0/23m. Not fixed prototype graph.
- Exact local SQL migration transaction and privilege/budget/concurrency/day-reset assertions PASS; rollback verified. Remote schema unchanged.

## Self-review findings corrected
Sparse stops and geometry remain separate across save/reload. Old recorded route review retains GPS gaps/duration/source; empty-geometry stop draft cannot be overwritten or silently discarded. New calculation invalidates old readiness. New risk resets private while folded route privacy persists. Last saved actions have bottom navigation scroll allowance. New controls/route preview use matte existing tokens; provider attribution remains visible.

## Release boundary
Built/checked locally; no production deployment or remote migration in this change yet. A release requires the additive SQL first, then tested app, source-SHA/health/smoke and designated authenticated write acceptance. Current source baselineae26728; Yandex still deferred. No claim that all original backlog/physical-device criteria are complete.
