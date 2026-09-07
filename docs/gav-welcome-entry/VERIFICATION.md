# Verification — 2026-09-07
- qa:local PASS:140 tests, build/typecheck/contracts; ESLint220, baseline220, delta0.
- UI on Chromium/WebKit ×320/390/1280 PASS. Initial area not chosen: no implicit GPS, no map placeholder/filter/status duplicates; both choices initially clear of navigation. Denied GPS -> manual entry; back preserves query; search503 and retry preserve input; selecting area returns normal map/filter view. Both Gav modes accessible afterward. 320 enlarged-text controls usable.
- Two-user Gav fixture PASS. No real signals/messages sent.
- Compiled `next start` WebKit390 same flow PASS (`compiled/`).
- Visual review found inherited absolute positioning in manual form; fixed to normal flow and added geometry assertion (form below intro). Initial desktop test assumed bottom rather than sidebar navigation; changed to rectangle non-overlap assertion. First ESLint run found two unused QA imports and one new state-sync effect; removed imports and derived location-failure presentation from explicit attempt + service locating/location state. Budget not raised.
- Screenshots and synthetic API/geolocation are acceptance fixtures, not physical Telegram/live dual-account proof.
- Owner first PNG16385 then explicit production instruction. No migration or feature flag/provider/auth changes. Post-deploy evidence recorded in workspace reports; release must check both documented aliases.
