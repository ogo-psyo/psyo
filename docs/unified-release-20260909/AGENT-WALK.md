# A05 · Calculated walk from verified search objects

Services: AssistantService + MapZoneService.

## State-first scope

Input is 2–8 references to real place objects from the current run or completed recent runs in the same owner/pet/thread after its privacy epoch. Model-supplied coordinates are not accepted. Optional return to first place; not a promise of an exact-duration loop. Points can be OSM object centers, not verified entrances.

A bounded tool uses the same routing service as the existing Map API. The server collects a computed path, original stops, snaps, distance/time/stairs/source/time; only a successful non-cancelled run persists it in `agent_runs.result.walk`. This is a proposal, not a saved `map_routes` record. Current-run recalculation replaces the proposal only after success. Two calculations maximum per run. Read/search/compute do not grant publication or messaging.

The existing Map will preview it and use the existing private route save path. An unrelated unfinished route must remain intact; replacing it implicitly is forbidden. Explicit viewing/application of a reviewed proposal is not yet autonomous save/recall. Agent save/recall and live provider/cloud/device proof remain subsequent gates.

Acceptance: shared API behavior preserved; arbitrary/foreign/stale references rejected before routing; quota/failure/cancellation never create fake geometry; source-provided snaps visible; reload restores proposal; current route not overwritten; existing save/retry opens same real route. Local tests use synthetic provider/HTTP replies, clearly separated from live evidence.

## Implemented and verified locally

- `lib/server/walkingRoute.ts` is the shared bounded routing service; the existing API delegates to it and rejects mismatched signed principals before I/O.
- `calculate_walk` + `recall_places` registered in agent. Recent place objects are selected only from owned completed same-thread runs after privacy_epoch. Server-generated geometry is collected in the result, not invented by the model.
- Map preview shows distance/time, stairs, original named stops and snap distances. Applying a checked result enters the existing private-save review, without extra calculation/apply/done stages. It is blocked while any current route exists; closing preview resumes that route.
- `npm run qa:local`: 199 tests; lint 216/220; build and contracts pass. After final CSS-only button cleanup, `npm run check` passes.
- `agent-walk.test.ts` (5): known references/round-trip, two-call cap, unknown/duplicate/foreign/aborted, late cancel/quota, latest-object recall/invalid results. Provider mocked.
- Existing walking API suite (5) preserves shared quota and quantized egress, adds principal mismatch. Provider/storage mocked.
- `evidence/agent-walk.cjs`: Chromium/WebKit × 320/390, preview/snap display, private save 503/retry with stable key, reload proposal, bootstrap canonical saved route and open same ID/path/stops, unrelated recovered draft retained. 4 pass (`agent-walk-ui.json`). Every API/provider response synthetic; no cloud save claim.
- Existing `evidence/agent-map.cjs`: all 4 pass again against combined build (place save/retry, old route append/reload).

Review: no new dependency/schema or publication. No arbitrary model coordinates. Private objects remain scoped to run/pet and cancellation guards. Source graph cache/limits unchanged. Physical Telegram, live agent quality and canonical cloud persistence remain open. Autonomous route save/recall not implemented in this slice; the explicit button uses existing Map save API.
