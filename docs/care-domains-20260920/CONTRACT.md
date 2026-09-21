# Care domains production transfer
Owner17066 authorizes transfer/deploy of approved v3. Preserve Naris, Liquid, transparent header, ReUI image/content cards and shadcn DayPicker. Domain optional (null), five categories including Воспитание. No redesign of other screens.

## State-first / explicit implementation backlog
ReminderService remains source of truth: reminders + reminder_events, owner via pet. Active/snoozed -> complete (history occurrence, next date for same series ID); conditional undo returns previous state; update date reschedules; delete uses existing explicit confirmation and hard-delete RPC. Guest fallback remains per-pet local storage, never used for authenticated writes.
- Extend validated reminder metadata with careDomain|null, note, recurrenceBasis planned/completed, reminderPreference off/day/before. Existing rows infer domain ONLY from existing type, not titles. Undefined and explicit null differ.
- Atomic RPC v3 creates plan or past fact in one transaction; no create-then-complete client gap. Metadata updates share existing update receipt/transaction. Replays do not rewrite rows. Existing clients keep old signatures.
- Repeated event history displayed as occurrences, not copied reminders. Preserve latest occurrence undo and old completed dates. Next date basis persisted; guest/server use same rule.
- Domain context is actual profile diet/notes with link to edit profile; do not seed prototype examples or create parallel profile storage.
- Telegram dispatcher is absent, notifications flag false. No simulated bot screen or promised delivery. Preference may be stored, shown unavailable; delivery remains a named existing infrastructure blocker. No external sends/flag changes.

## Acceptance
Five artwork cards, overview/calendar/date/category filters, free events, open/edit/past fact/reschedule/complete/undo/history; both account/guest source behavior; field values survive retry; no duplicate on lost response; owner isolation. Errors distinct from empty. Small-screen keyboard and overflow; image loading and reduced motion. Existing reminders unchanged by migration.

## Release
qa:local, SQL rehearsal + atomic retry/privacy test, targeted Chromium/WebKit. Additive migration backed up and applied; candidate source/settings/API/browser checks; PR base production/telegram-miniapp (main is stage0), both CI; production promotion + two-alias exact revision/smoke. Do not claim actual iPhone or Telegram delivery verification.
