# A06 · Recall a canonical saved walk

AssistantService + MapZoneService. Read-only vertical slice before autonomous saves.

Source of truth remains map_routes, not yesterday's answer. The agent searches recent owned records, reads an exact UUID for its current pet, and receives verified metadata. The runner collects an ID/title link, not model HTML or arbitrary geometry. Clicking the link fetches that route again under current owner/pet access. Deleted/foreign/failed reads stay errors; cached assistant text does not resurrect objects.

Map displays the canonical path, stops, gaps and note in a read-only saved-route view with GPX and return to conversation. It must not become an unsaved clone or replace an active draft. Reuse is optional and uses the existing route planner only with an empty workspace. No new data writes/schema in this slice. Local fixture needs the existing additive route migrations before projection checks; this is not a cloud migration.

Acceptance: current ownership and pet scope, deleted/failed read, metadata-only model result, exact map object after fresh fetch, GPS gaps/note/stop names retained, GPX and return, no map create call merely from reading, other draft retained, Chromium/WebKit narrow viewports. Live inference and cloud/device evidence remain open.

## Evidence and review

- `readOwnedMapRoute` is shared by read_walk and the new owner-only GET on the existing /api/map/features/[id] route. Both owner and current pet are checked; GET validates UUIDs and principal agreement and returns no-store normalized domain data, not share tokens/storage fields.
- Agent result contains verified ID/title references, not cached geometry. Click performs a fresh read. 404 removes the stale view/reference; 503 permits retry without navigating. Pet/assistant close aborts the pending navigation read.
- Local fixture only: applied existing 20260907010000_map_route_gaps.sql and 20260907120000_route_planning.sql. No new migration or cloud change.
- `assistant-context-schema.py`: 25 SELECT projections compile via read-only EXPLAIN against that fixture; not REST or live RLS evidence.
- `agent-saved-walk.test.ts`: 5 pass, covering canonical geometry/gaps/note, foreign route and pet, missing/deleted, unavailable DB, mismatched/anonymous principals, cancelled tool and metadata-only model result.
- `qa:local`: 204 tests, build/contracts; lint217/220 (existing imperative navigation controller adds one set-state-in-effect warning, within baseline). Final bounded empty-stops rendering/distraction cleanup passed `npm run check` again.
- `evidence/agent-saved-walk.cjs`: Chromium/WebKit ×320/390 all pass: 404, 503, successful fresh read, named stops/note, two GPX segments for GPS gap, original draft unchanged, no POST, return and reload fetch. Provider/API synthetic. Screenshot shows real UI, not live map/source evidence.
- Prior `agent-walk.cjs` four combinations pass against final combined build, including preview→place→preview, private save retry, canonical reopening and retained other draft.

No write tool was added here: autonomous save is still open. The generic saved answer action does not save a canonical route. Full-product design transfer and live release gates remain unfinished.
