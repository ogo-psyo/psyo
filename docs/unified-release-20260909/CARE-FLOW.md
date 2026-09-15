# U04 · Know what is due, change it, finish it and return

State-first work item, IN PROGRESS. No provider/cloud/production changes.

## Confirmed current gaps

- Clock value is used as a hidden time-mode enum:12:00 becomes all-day,10:00 becomes approximate. Exact noon/10am cannot roundtrip correctly. Create API omits time precision entirely.
- Calendar precedes the useful item list and entry form; composer always exposes type/time/recurrence and offers immediate medical-care presets at arbitrary default offsets. Existing capabilities stay, but preset selection should prepare a reviewable form, not silently persist a date.
- Create/update/snooze use global errors and post-write bootstrap, several accept any HTTP200 without a canonical row. Typed input can be cleared even when the saved object is not confirmed; same-click locks incomplete.
- Edit is uncontrolled DOM and disappears on month/view changes, losing its draft. Existing selected ID/detail and return behavior must remain.

## Scope and data decision

Use the existing reminder metadata for explicit `timeMode` (`exact`, `flexible`, `approximate`), not numeric clock sentinels. Missing legacy metadata remains unknown; do not infer all-day or exact intent from12:00. Display one shared formatter across reachable care summaries/details/export. Approximate time is explicitly chosen with a time value; flexible stays date-only in copy. The date stored by current scheduler is not evidence of delivered Telegram reminders.

Add an atomic v2 create wrapper to the existing domain transaction, including precision in fingerprint/receipt. Old create signature remains for compatibility. Existing update JSON patch gains a validated mode and metadata merge, without erasing other fields. Completion/snooze already return canonical row metadata and preserve it. Do not silently change recurrence/DST scheduler semantics in this UI task; cross-timezone recurring wall-clock behavior remains an explicit release gate.

Create → actual row → edit → failure/retry → completion/next term/history → reopen, with per-pet synchronous mutation locks, canonical identity validation, local operation errors and retained drafts. No postcommit bootstrap required for showing success. A preset/assistant-prepared task must not inherit unrelated manual date/type/recurrence or clear a different draft.

UI: list-first plan with optional calendar navigation, compact title/date input, optional time/repeat/type, same-system row editor. Keep history, recurrence choices, export, delete semantics, direct navigation and guest-local behavior. This slice includes care/calendar; habits and other inner forms remain subsequent work.

## Acceptance

- Real local SQL: exact noon vs all-day metadata, create/update/replay/conflict, failure rollback, completion/next term and owner boundaries. Old data remains unknown, old callers remain valid.
- API/domain: strict time-mode/date/title validation, conflicting principals denied, own receipt required, no successful demo write when storage unavailable.
- Built UI:320/390/1280 in Chromium/WebKit; immediate capture, optional choices, exact12:00 and10:00, legacy-unknown copy, errors/repeat/doubleclick, edit draft across month/close/assistant, canonical reload and completion next term.
- No fake live delivery/provider/device proof. Review current reachability and shared formatters before claiming the whole slice complete.
