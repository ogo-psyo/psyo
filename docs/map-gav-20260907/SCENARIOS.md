# GEO-01 — preservation and acceptance matrix

Baseline: production ab13977ef75f29303073d051525ffa20b9c9320c. Read source before changes; do not interpret unvisited states as missing features. Owner/pet isolation, current route/share IDs and consent remain unchanged.

| Scenario / entry | Result and data / rights | Acceptance |
|---|---|---|
| Main navigation → Map | Existing Leaflet/OpenFreeMap scene and selected dog | map browser suite 6 viewport/engine combinations |
| Empty / named / non-empty recovered draft | Ordinary map first, optional resume, metadata preserved, explicit delete distinct from fold | map-session behavior + browser reload |
| Map → Start walk → fold → other tab → return | Same running GPS watch; no implicit finish; global recording status | mocked GPS browser suite |
| GPS pause / loss / reload | Distinct geometry segments, no invented line across gaps; restored recording paused | geometry tests + browser mock |
| Manual route by map click / center button | All points ordered; accessible up/down/delete/undo; return-to-start idempotent | domain + UI source/interaction |
| Route → review → private save | Confirmed save only; stable request retry ID; old EWKB/EWKT decoded | domain/endpoint + browser |
| History → repeat / edit planned route | Original recorded history preserved, editable new planned copy; planned edit retains internal route ID and draft target across reload | source + scenario checks |
| Route rename / note / share / revoke / delete | Existing owner guard and coarse public page retained. Editing closes old share URL as before | existing map privacy/mutation contracts |
| Search → area → chosen place → return | Explicit provider submit, latest request wins, frozen bounds visible, query retained | bounded provider code + browser fixtures |
| Existing zones / risks / coarse areas | Current IDs, notes, privacy radii retained; no public exact location escalation | existing privacy suite + code review |
| Layers → presets / manual override | Existing routes, places, risks all accessible; state per dog; draft and camera not reset | source + target UI |
| Place → save in chosen collection | One internal saved-place identity, provider ref separate; success and undo | pure domain + CAS endpoint + browser |
| Same place in two collections → remove one | Shared object and second membership preserved; order and notes untouched | domain + two-tab CAS + browser |
| Collection → select places → plan walk | Ordered point copy, source collection unchanged, active draft not replaced | domain + UI |
| Time budget → recorded loop | Honest estimated-time candidate in numeric tolerance, or no candidate; manual planning remains | duration tests; no new-area walking network promise |
| Gav → live / discovery / all goals | Both modes remain; mating available; selected filters retained per dog | source contracts + social tests |
| Gav without coordinates / manual area | No fictitious local zero; explicit area, radius, load/error/empty states | component conditions + mocked browser |
| Profile hidden save → publish → hide | Explicit actions, draft retained on error/close, same selected pet | existing profile suite + new return-value contract |
| Signal publish → lost response → retry | Same attempt identity; no speculative success; parameters and expiry visible | Gav browser injected 503 + retry |
| Request → two-sided response / error / block | Current server state wins; error doesn't close confirmation; explicit status result | existing SQL/social suites + two-user browser mocks |
| Accepted connection → propose place/route | Explicit server preview then confirm; owner/pet and blocked/closed checks; notes removed; private route endpoints omitted | 8 endpoint tests + SQL guard |
| Proposal → source removed / changed | Snapshot geometry withheld, clear unavailable state | endpoint test |
| Map/Gav assistant → return | Existing assistant entry points and orchestration unchanged | canonical/regression contract suite |
| Profile, care, records, documents, memo, subscription, Things | Unrelated product paths remain in source; no schema or logic removal | full existing suite |

## Boundaries

- Browser GPS tests use synthetic coordinates, not a claim about background OS tracking. Physical Telegram, locked-screen behaviour and real microphone were not tested in this delivery. Existing open-app limitation remains explicit.
- Remote QA project is inactive; no real users receive test signals or messages. Database fixtures run in local transactions and roll back.
- Yandex migration, licensing, remote pedestrian routing and Yandex data matching are deferred. Current stored geometry and object IDs require no destructive migration.
- New collections did not exist as a provider-place membership model in the inspected source. They are additive, not a replacement for existing zones or route history.
