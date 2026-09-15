# Gav live-screen incident — 2026-09-07

User screenshot16401: own active signal, no peers, unavailable basemap, settings dominate while actions below navigation. Ongoing production-fix authorization. No new social entities/API/privacy changes.

## State/readiness
- Server-owned live signals and relationships stay authoritative; map renderer is independent transient state loading/ready/error.
- Basemap load has 12s bound. Error, lost WebGL context and failed initialization surface error; explicit retry rebuilds layer, normal renderer idle after recovery clears error. Resizing/visibility return invalidates Leaflet and resizes GL. No new providers or synthetic places.
- Own signal: status and edit/end together, plain empty-company explanation, optional profile browse. Existing server mutations retained.
- Neighbour signals: marker and labeled list select same card; list/response available without basemap.
- Area/filter controls compact; expand in flow, no absolute overlay collisions. Avatar whole and fallback compact.
- Switching to profiles releases live-map context. Return initializes visible map without changing signals/requests.

## DoR evidence
Reproduced on c368a135 production bundle with intercepted social fixture: edit action y713.55 at390×720 under navigation; forced WEBGL_lose_context produced zero warning. Exact device cause of user's gray surface not inferred from screenshot. Previous shared layer only listened initial load/error, no contextloss/deadline/resize observation; previous padding assumed large full-screen map.

## DoD
- Own-signal edit/end above navigation at mobile sizes; no duplicate radius/zero counter/status blocks.
- Basemap network failure, lost context, unavailable GPU do not block signals/editor/requests; visible retry restores map when available.
- Area retry keeps input; filters reachable; neighbour selection works without map; error not shown as no peers.
- Full two-actor Gav journey regression, shared map route smoke, qa:local, CI; both production aliases same verified source and production smoke.
- Evidence distinguishes fixture API from real map renderer/network and published guest smoke. Physical Telegram device not claimed.

## User steering: search on the map, not only read a panel
Map expands in the existing workspace (no second disconnected map). Pan/zoom → explicit “Искать здесь · N км” uses existing approximate-center/radius API, does not move the user's own signal. Markers and accessible signal list select the same card; selection remains after collapse. Radius is stated rather than implying viewport/bbox query support. Incoming/outgoing dialogs overlay this view and return to it. Viewport size changes do not reset camera. Expanded panel independently scrolls; map remains usable. No new geo provider/API/privacy behavior.

Editing an existing own signal uses that signal's approximate location, NOT the current browsing/search center. Explicit GPS choice in composer remains available. Regression checks inspect the submitted location after moving/searching the map then editing the note.
