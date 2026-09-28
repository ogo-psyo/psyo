# Telegram reminder loop — local implementation report

Date: 2026-09-28

Status: implemented and verified locally; not deployed; real Telegram delivery is still unverified.

## User outcome

A planned care item can schedule one Telegram message for its current occurrence. The message offers:

- `Сделано` — records completion through the existing atomic care mutation and leaves the result in history;
- `Перенести` — offers one day or one week, updates the same item atomically and schedules its new occurrence;
- `Открыть` — deep-links to the exact item in `Забота`.

Cancelled, completed, superseded and replayed occurrences do not send a second message. A repeated action uses the same idempotency key.

## Implementation boundaries

- Telegram chat identifiers are encrypted with AES-256-GCM in a service-role-only table.
- Callback payloads are compact, signed and tied to the reminder and exact occurrence.
- Delivery is feature-gated by `TELEGRAM_NOTIFICATIONS_ENABLED` and additionally requires the bot token, public app URL and a separate delivery encryption key.
- The app reports whether delivery was actually scheduled instead of claiming that a saved calendar item will definitely produce a message.
- Existing reminder, recurrence, calendar and history mutations remain the source of truth.

## Verification evidence

- `npm run qa:local`: passed (lint budget 220/220, all tests, production build and contract gates).
- Reminder-specific Vitest suite: 8 tests passed, including encrypted storage, tamper rejection, delivery idempotency and atomic `Сделано`/`Перенести` routing.
- Browser deep-link smoke: `Telegram Open → exact care reminder` passed at 390×844.
- Migration applied to a clean temporary PostgreSQL instance after fixing a PL/pgSQL row-selection defect.
- Database behavior check passed for first claim, duplicate claim rejection, finish, post-finish rejection, one delivery row and one notification event.
- `npx tsc --noEmit` and `git diff --check`: passed.

## Not yet verified

- No production database, Vercel configuration or Telegram webhook was changed.
- No real message was sent.
- A physical iPhone/Telegram test has not been run.
- Delivery after a production worker restart and provider outage needs the real-environment smoke.

## Rollout checklist

1. Add `TELEGRAM_DELIVERY_ENCRYPTION_KEY` through protected environment configuration.
2. Apply `20260928180000_telegram_reminder_delivery.sql` with the normal backup and migration checks.
3. Deploy with `TELEGRAM_NOTIFICATIONS_ENABLED=false` and verify health/revision.
4. Enable the flag for the controlled test environment, reopen the Mini App to bind the encrypted delivery target, then create a test item due in several minutes.
5. Verify message arrival, `Сделано`, `Перенести`, `Открыть`, cancellation before send and repeated taps on a physical phone.
6. Keep the flag off or roll back if any of those checks fail.
