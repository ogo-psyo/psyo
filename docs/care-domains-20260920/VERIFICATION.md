# Care domain integration verification

- Approved prototype v3 translated into real app, not embedded HTML. Naris, live Liquid, five supplied WebP artworks, transparent header. No changes to map, assistant or Woof.
- Additive metadata and atomic historical-create RPC, owner isolation, stable retry receipts. Existing update/complete signatures retained. Notification flags and external sends unchanged: delivery unavailable, explicitly labeled.
- Full qa:local passed: 249 tests, lint budget 218/220, Next production build and source contracts. Old renderer-shape guards migrated to CareWorkspace behavior guards; removed counter-use requirement where no counter remains (formatter API still tested).
- Isolated PostgreSQL migration + SQL tests passed. Browser auth/HTTP adapter invokes real local RPCs: creation after lost response has one row, reload, metadata edit, reschedule, actual-date recurrence, undo, historical fact, load error/retry. Chromium 390px and WebKit 320px.
- Local clone lacked wishlist-link and completion-undo migrations; brought into alignment before testing. A nonexistent deleted_at filter introduced during integration was caught and removed; production schema verified. Test timezone assertion changed to compare the user's local calendar date.
- Scoped production backup includes all reminders, events, wishlist and two replaced function definitions; rollback definitions restored successfully inside a local transaction then rolled back. No record rewrite in migration.
- Browser transport is controlled fixture, not a live authenticated-user session. No physical iPhone or Telegram delivery verification claimed.

Guest create/complete/reload/history/undo passed, with zero reminder API writes. Mobile keyboard test simulates viewport shrink and asserts field visibility without test scrolling; not physical-device proof.
