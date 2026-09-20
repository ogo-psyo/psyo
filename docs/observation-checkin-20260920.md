# Open one-tap observation check-in

Owner17002: dropdowns are tedious, the giant note dominates the form, and wellbeing must not be hidden behind a disclosure.

The editor now has four open metric groups with native toggle buttons (one selection/group, tap again clears), followed by a compact optional note. No defaults, mandatory metrics or new data model. Friendly short labels map to the same canonical values; legacy/custom values remain visible, preserved and clearable. The full form disables during mutation; fieldsets/legends and aria-pressed expose group/selection. Selected controls have both color and underline. 44px minimum targets, 4 columns at typical mobile width, 2 at320px, no horizontal overflow. Existing note-only, metric-only, mixed and primary-fact drafts retained.

QA: observation-checkin.smoke.mjs Chromium390/WebKit320 covers replace/clear/Space, dimensions, metric-only error/retry/canonical payload/busy, legacy edit and keyboard save. observations-entry.smoke.mjs covers note-only, draft/back, filters, load/retry and reload. Synthetic API fixtures; no owner's records changed, no physical iPhone claim. qa:local required before release. No API/auth/schema/dependency/service changes.
