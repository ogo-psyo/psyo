# Unified care · 2026-09-22

## Owner decision and scope
Integrate observation and habit scenarios around the existing Уход/Забота section; remove standalone entries. Preserve approved Naris/Liquid/domain cards and existing private records. No production deployment authorized for this particular change yet (AGENTS.md:108).

## Authoritative state
- Observations remain observation records with the existing capture/edit/delete/history APIs and guest storage. No migration or recategorization.
- Habits remain active daily/weekly targets with checkins, not recurring Reminder records. Counts use the existing period calculation. Checkin retries retain the existing idempotency key.
- Dated care events remain Reminder records. No scheduler/configuration changes. Bot notifications remain disabled.
- Data stays selected-pet scoped. UI summaries consume existing loaded data, not copies or new storage.

## User paths / acceptance
- Main, Все разделы and Profile link to care; no independent observations/habits rows.
- Care overview -> add observation -> save -> history -> return -> latest observation. Existing history and editor remain accessible.
- Care overview -> regular checkin -> confirmed count; errors retain retry, no invented success.
- Regular actions are also visible in their matching domain: walk/activity, feeding/food, medication/health, grooming/care, training/upbringing. Custom actions remain in the overview/management list.
- Domain -> manage regular actions -> Back returns to that domain; fresh entry starts overview.
- All regular actions including edit/archive remain accessible beyond the three-row overview preview.
- A failure to load reminders does not hide observations/regular actions. Each independent source reports its own loading/error state.
- Old #health/#habits links remain compatible; their fallback Back goes to care. Assistant destination contracts remain intact.

## Boundaries
This is UI integration, not a new unified event schema. The care calendar still shows dated care events, not a fabricated merged timeline of observations/habit checkins. Existing observation dates/search stay in the observation history reached from care. Guest habit persistence is not introduced; its current Telegram requirement is retained. No backend/auth/privacy/dependency changes.

## Verification
See verification.md for final results. Browser fixture checks never write real user data. No claim of physical iPhone or live authenticated persistence verification.
