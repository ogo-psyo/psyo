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
The same care calendar now shows dated care events and observation records by their actual observed date. Observation dates are not converted into reminder dates; entities remain separate. Month search covers care text and observations. The existing owner-scoped health timeline API has an additive validated from/to window; its original cursor-based callers retain their contract. Guest observations use existing local data, and guest habit persistence is not introduced. No schema/auth/privacy/dependency changes.

## Verification
See verification.md for final results. Browser fixture checks never write real user data. No claim of physical iPhone or live authenticated persistence verification.

## Calendar correction · owner 17:37
Observation history must share Care's calendar. Add read-only from/to window to the existing owner-scoped health timeline endpoint (no schema changes); paginate inside that window so older months are complete. Same calendar marks observations and dated care events; one selected day, detail/edit/back retains it. Loading/failure never implies an empty day. Replace active standalone history/date filtering with shared-calendar navigation.
