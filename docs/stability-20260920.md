# Stabilization 2026-09-20

Scope: existing interface only. No new features/design, API/auth changes, migrations, dependencies or configuration.

## Reproduced and fixed

- Browser Back from profile edit skipped its profile parent. Profile subviews now use browser history with a pet identity guard, without persisting private draft contents in history.
- Telegram native Back had no shared binding. It now invokes the same current callback as the screen header, with one listener and cleanup.
- Only chat composers adapted to the software keyboard. Other text forms now fit the visible viewport, hide bottom navigation while typing and retain scrolling to the save action. Hardware keyboard focus alone does not change layout.

## Verification

`BASE_URL=http://127.0.0.1:3293 node scripts/qa/stability-ui.smoke.mjs` checks Chromium390/WebKit320: browser back/forward, native Back bridge fixture, drafts after back/error, successful profile retry, documents return, both viewport-resize modes, observation response-loss retry and reopen. Default receipt transport is simulated; this is not authenticated production persistence evidence.

The opt-in `STABILITY_POSTGRES=1` variant uses only the dedicated local `pso_stability_20260920` database in `supabase_db_pso-mvp` (Docker CLI at `/opt/homebrew/opt/docker/bin/docker`). It must already contain the current schema. It creates synthetic ownership, invokes the actual `care_observation_atomic` RPC from the controlled browser adapter, drops the first response after commit, checks one row on retry, reloads the browser from the actual table, then cleans only its synthetic owner. Authentication and HTTP transport are still fixtures.

Existing `supabase/tests/observation_atomicity.sql` also passed on that isolated DB, including transaction failure/rollback, replay, conflict and ownership/grants. The existing persistence protocol needed no modification.

`composer-keyboard-ui.smoke.mjs` passed Chromium/WebKit320/390 after the common viewport change: draft retention, visual/layout shrink, stable blur-to-send, single send and follow-up.

No physical iPhone/Telegram keyboard or real-account mutation check was performed. Do not infer whole-product stability or native-device certification from this slice. Workspace release report holds command logs, screenshots, source/CI/deployment identities and post-release checks.
