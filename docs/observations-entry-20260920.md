# Observations entry and writing composition

Owner feedback: “Память о днях” did not explain the purpose; first-use screen and input felt sterile, and fonts were inconsistent.

- Same existing observations store and lifecycle. No API/schema/auth/storage changes.
- Consistent “Наблюдения” entry from profile and tools. First-use shows original approved dog art, purpose, explicitly illustrative examples, one add action. No invented data.
- Search and creation-date filter appear after entries exist. Filtered-empty has a reset, not a misleading first-entry message. Loading/error are distinct from empty.
- Editor focuses on a spacious writing sheet; metrics remain optional/collapsed, primary fact drafts supported. Existing mutation guards, errors, undo/delete and editing preserved.
- Legacy standalone Arial shorthands now use existing Naris token; fallback Arial remains legitimate. No new fonts or theme. Readability sizes retained outside this screen.

Verification: qa:local (241 tests/build/contracts); observations-entry.smoke.mjs Chromium390/WebKit320/Chromium1100 with controlled API fixtures, loading/error/retry, empty/no filters, draft/back, save error/retry/detail/reload, search/date/reset, computed fonts/overflow; stability-ui.smoke.mjs both engines with lost-response receipt fixture and keyboard viewport. No physical iPhone or live authenticated persistence claim. Art reused, no new image generation.
