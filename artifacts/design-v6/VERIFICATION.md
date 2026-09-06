# Псё · выбранный B «Дневник» — local implementation

## Result and scope

New branch design/journal-v6-20260906, base8cff342, isolated worktree wt-pso-journal-v6. The base preserves functional fixes, not rejected v5 visuals. B user choice recorded Sep6 15:04 (Telegram16160), subsequent «Давай» continued the same local job.

Home rebuilt: masthead, Today/date, single observation capture, daily read-only record projection, assistant, real care link, retained scenario/trend disclosures. Profile rebuilt: compact identity, capture, three-domain index, recent real history; existing editors/identity/privacy routes retained. Things uses same journal system; navigation uses installed Phosphor. Calendar/map/Gav/assistant visual controls harmonized. API/auth/DB/storage/provider behavior unchanged. No dependencies added; installed node_modules APFS-cloned from v5 for isolated Turbopack build. Initial symlink build failed, physical clone resolved it.

## Checks

- npm run qa:local: exit0, lint0errors/215warnings within220budget,98tests passed, Next production build and all source contracts passed. Two new tests validate local-day projection, mixed ordering, real completion timestamps, snoozed/cancelled/invalid/empty records.
- Last CSS-only reviewer fix: npm run check exit0; no behavior changes after full qa:local.
- git diff --check: pass.
- Browser capture: five routes ×320/390/1280, horizontal overflow0, nav visible, JSerrors0. Calendar/assistant also captured. Files geometry.json, capture.mjs.
- Profile320/390: Russian/English breed filtering, unknown/custom fallback, edited custom breed persisted to localStorage; profile-flow.log.
- Journal behavior: private note saved using existing guest path, reloaded into today's timeline; four scenarios, passport/character/history/health, public-card and wishlist routes reachable. Extraction fixture only, no paid API. journal-flow.log.
- Voice320/390/1280: synthetic audio and mocked transcription/extraction, cancel/no-send, review/edit/no-metrics/error-to-text, opt-in private-note choice,44px controls,16px inputs, nav suppression. voice.log. Structured voice save requires existing auth; no live provider/auth persistence claim.
- Map320/390: existing two-route scenarios planning/recording/review/saved/delete flow passed; map-flow.log. Actual live tile loading not asserted (smoke's wait is optional).
- Final metrics: portrait radius50/50/24/24, straight row radius0, desktop assistant label contrast11.96:1.
- Fresh finish review: initial fix → all3 resolved → ship for local preview; REVIEW.md.
- Detector ran once: design-system advisory drift against rejected v5 DESIGN.md. Documentation refreshed from built B by skill documenter; no second detector run.

## Boundaries

Production untouched; no deployment, external writes/messages to others or paid provider requests. Screenshots use synthetic profile/records. Real Telegram WebView, real microphone and authenticated backend round-trip not verified. Existing privacy/auth contracts retained. Technical QA/ship is not user design acceptance.

## Preview

http://localhost:3214/?demo=1 — local Mac only, production build, not public URL. Screenshot fixtures are not injected into user sessions. Server run id recorded in workspace SESSION-STATE.md. Final home/profile screenshots sent to Telegram16163/16164.

Existing PRODUCT.md has legacy schema/register; no unrequested init migration. DESIGN.md is updated for explicitly approved visual replacement, not incidental drift repair.
