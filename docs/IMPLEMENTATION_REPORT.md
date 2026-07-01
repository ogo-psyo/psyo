# RC1 Foundation Implementation Report

Date: 2026-06-25

## Delivered

- Added `IMPLEMENTATION.md` as the local RC1 implementation contract.
- Updated `AGENTS.md` with required RC1 reading and release-gate rules.
- Added RC1 feature flag and entitlement config in `lib/rc1.ts`.
- Added `GET /api/internal/health`.
- Added `GET /api/billing/entitlements` with billing intentionally disabled unless flags are enabled.
- Added `/legal/privacy`, `/legal/terms`, and `/support` placeholder pages.
- Updated the first screen copy toward the RC1 product formula: reminders and recurring care, not only a passport.
- Replaced the Today-screen utility block with action-first quick actions.
- Added `scripts/qa/check-rc1-foundation.mjs` and wired it into `npm run qa:local`.

## Not Delivered Yet

- Supabase RC1 domain migrations.
- Real reminder dispatcher/cron.
- Telegram callback completion tokens.
- Telegram Stars invoice and webhook processing.
- Final legal texts.
- RLS/IDOR tests for the target RC1 schema.

These remain blocked by the staged implementation plan and production release gates in `IMPLEMENTATION.md`.
