# Map / Gav delivery — 2026-09-07

## Source and rollout

- PR: https://github.com/ogo-psyo/psyo/pull/21 (merged).
- Production source: `ad4265b05ef5394b38e534bec91636c399dc0b43`; identical application tree to CI-tested `1408f1bddb8d513ed44fd4779f2035f09b45b926`.
- Deployment: `dpl_4JVTdM6jQJQ24nqoFveF4Jwx3bG3`, https://pso-jtwpcxpu6-uglanovrms-projects.vercel.app.
- Alias: https://pso-mvp.vercel.app.
- Previous rollback target: https://pso-l2ocszhbf-uglanovrms-projects.vercel.app (`dpl_7DA9p2ZGrRV6F8Cqmr8wvXpRy39w`). Roll back application only; retain new additive data/schema.
- Four exact additive migrations applied in one transaction; old route count and distinct IDs remain 1 / 1. RLS is on and direct client insert denied for new private tables. No existing route or social data rewritten.

## Evidence

- Local and CI: 117 tests / 8 files, lint within existing warning budget, build and legacy contracts pass. New exact SQL transaction: 11 pgTAP assertions, rolled back locally.
- Local compiled UI: Map six engine/viewport combinations; Gav reliability and widths pass in Chromium/WebKit. Mutations/GPS there are synthetic fixtures, not live-user activity.
- Production: health release exactly matches merge SHA; canonical identity ready. Standard release smoke passed after explicitly permitting *unchanged* existing upload/avatar feature flags. First default smoke rejected those flags; comparison against prior live deployment proves this release did not enable them. No generation/upload/payment call performed.
- Production private GET/POST endpoints return 401 unauthenticated; real Nominatim search returns a stable-source-ID result within requested bounds. No test signal, response or meeting sent to real users.
- First production log export: no server 5xx; successful real search 838 ms. Traffic below statistical threshold, not a performance baseline. Operational event report excludes raw request logs and private values.
- Production browser traversal passed Chromium/WebKit at 320×740, 390×844 and 1280×720: real tiles, manual area selection, visible attribution, Home scrolling after Map, no horizontal overflow or page exceptions. Guest 401 was honestly shown as an error but its copy/loading boundary needed correction; this follow-up distinguishes unavailable authenticated access and avoids repeated guest requests.

## Scope and acceptance boundaries

Yandex integration is deferred as requested (GEO-02/04/06 and vendor-specific parts of 03/05/07/12). Current Leaflet/OpenFreeMap/Nominatim stack stays active.

GEO-15 is partial: selection of an existing recorded closed loop near the chosen start and within the declared time tolerance, not generation of a new walk through an arbitrary street network. No current walking-routing API exists in the baseline. That full capability remains unresolved with the deferred routing integration; it is not represented as 100% implemented.

Physical Telegram WebView / screen-lock and background GPS are not verifiable from desktop automation. UI does not promise background tracking and explicitly marks missing sections. No designated live two-party QA account was available for authenticated production writes; those chains have endpoint, SQL, and two-browser fixtures, not a claimed real-user end-to-end acceptance. No unrelated account or public signal was used for testing.

All other section entrances and assistants are preserved; checks cover touched and baseline contracted behavior, not an invented exhaustive physical-device certification. The per-card repository ledger is the scope map. Released does not mean every original DoD checkbox is independently proven.

## Follow-up

Guest access refinement is in this commit. Local full gate passed; targeted two-user and guest browser checks, CI and follow-up deployment are recorded in the final external release receipt. No further schema changes.
