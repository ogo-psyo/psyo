# Product-step regression fix · 2026-09-15

User16731: missing zone/route steps, Gav forms/map expansion, duplicated dog age.

## Changes
- Direct route and zone entry points. Route stop confirmation, reorder/undo, walking/manual modes, explicit calculation preview/apply, retry, GPX and reuse, discard confirmation.
- Do not allow zone creation to overwrite an unfinished route (the existing backend form shares draft state); continue/save/discard is available.
- Zone composer now remains in normal flow, with source lavender/paper controls instead of legacy green sticky actions.
- Gav: source full-page profile and filters; feed uses selected filters and handles Russian saved traits plus historical enum codes. Five age categories retained. Map expands280→390 and invalidates its canvas size.
- Social draft hydration does not overwrite the saved draft during the first effect pass. Failed writes keep input; hidden save closes only after confirmation.
- Dog basics show name, one combined age entry, breed. Other fields remain in groups; existing age group is preserved when editing numeric age. No schema change or new cloud-age storage claim.

## Verification
- npm run qa:local PASS:232tests, build, lint within budget, contract checks. No DB/provider changes.
- verify.cjs and verify-forms.cjs PASS against production build at3296, Chromium390/WebKit320. Also development WebKit320. Actual UI events and Leaflet/MapLibre with deterministic backend/basemap fixtures: no real-owner writes, no live route-provider claim.
- Route: mapclick→confirm2stops→reorder/undo→calculate→apply→503 retains input→same-keyretry→saved→reload→reopen; manual draft, keep/delete confirmation and zone-during-draft guard.
- Zone: mapclick→title→private save→map. Gav filter results1/0/reset2, failed hidden save→back→draft restored→retry closes; profile save error preserves age and retry key.
- Source visual review at320/390, no horizontal overflow/JS errors. Fixed zone sticky overlap and green material, source390px expanded map.
- Impeccable detector onepass: no errors; four Arial warnings are pinned source decisions; inherited radius/color advisories include !important parsing and contextual source palette, not a reason to redesign.

Run from repo: BASE_URL=http://localhost:PORT ENGINE=webkit WIDTH=320 node docs/unified-release-20260909/evidence/ux-regressions-20260915/verify.cjs (and verify-forms.cjs). Fixtures only; never use these results to claim authenticated production integration or physical Telegram certification.
