# Gav map recovery and exploration verification

## Confirmed
- Reproduction on published c368a135 fixture state: own-signal edit action below nav at390×720; forced WebGL loss not surfaced. Exact original physical iPhone root cause remains unverified.
- Live recovery: WebKit390 GPU loss→warning→retry→ready; noGPU Chromium390, blocked network WebKit320×640; no scene mutations or page exceptions after repaired adapter resize/unmount race.
- Native live map dominant expansion at390×720 /320×640: drag → query moved center → peer marker → response → relationship → back; selected peer survives collapse/re-expand. Source signal position unchanged by browsing. List and tools remain in same lower panel.
- Full two-actor journey WebKit repeated after expanded UI changes: response/accept/place/receive/history/errors PASS.
- Shared route flow WebKit390 PASS with revised common basemap lifecycle.
- qa:local final PASS143 tests, build, contracts. Lint219 under unchanged220 budget.
- Screens and detailed logs: workspace reports/pso-gav-live-incident. Current source has no DB/API/provider/auth/flag changes.

## Failure accounting
- Initial blocked-network test revealed adapter0.1.4 deferred resize after unmount; synchronous public size/container resize integration fixed it; rerun passed.
- First expanded320 map gained too little area; reduced expanded panel content, rerun passed without lowering mobile area threshold.
- Exact label locator for native select did not resolve even though screenshots confirmed visible control; changed to scoped native select and added actual radius choice assertion.
- Earlier screenshots/tests not passed off as evidence of final layout. Compiled final/prod results appended below when complete.

## Limits
Fixture API two-actor tests are not live writes to real accounts. Real map renderer/tiles exercised except explicit failure cases. Physical Telegram iOS acceptance not claimed. Existing supported-city/radius API stays authoritative; viewport search is explicit center+radius, not a new bbox service.

## Final compiled check
Compiled WebKit map flow including changing radius to5km, response/back/collapse and editing own note after changed map center PASS. Actual PUT coarseLocation equals own signal location, not query center. The test's first attempt used wrong field location and failed undefined; corrected fixture to current coarseLocation contract and reran. Source rebuilt after location correction; final npmruncheck passed. Compiled desktop and noGPU320 and full two-actor WebKit also passed (before this isolated composer-source correction).
