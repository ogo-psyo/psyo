# A04 · Private context is not an empty fallback

Service: AssistantService. Found while preparing remaining walk actions.

## Contract and change

- `map_routes.route_source` is canonical; `activity_type` does not exist in repository migrations. Both the legacy snapshot and agent private search now read route_source and dates.
- The legacy path verifies the owned pet before reading related rows. Failed pet/context/thread reads return 503 ASSISTANT_CONTEXT_UNAVAILABLE before generation or message writes. Missing owned pet returns 404. Successful empty reads remain valid.
- Observation context includes bounded original note with date; deleted notes remain excluded. Only ready document metadata enters context, explicitly not file contents.
- Agent search already reported READ_FAILED rather than an empty array; its SDK turns that into an explicit tool error returned to the model. No live model quality claim.

## Evidence

- Old `EXPLAIN SELECT id,title,activity_type FROM public.map_routes LIMIT 0` fails with nonexistent column in isolated local `pso_release_atomic_test`.
- `python3 scripts/qa/assistant-context-schema.py`: 23 source-derived SELECT projections compile, read-only EXPLAIN, no record output. Includes old/new assistant and runner. Does not validate filters, PostgREST, cloud schema or RLS.
- `npx tsx --test scripts/qa/assistant-context.behavior.test.ts scripts/qa/assistant-route.behavior.test.ts`: 20 pass, including failures in all 9 context/history tables and unavailable pet. Synthetic API dependencies; no provider.
- `npx vitest run scripts/qa/vitest/agent-private-records.test.ts`: 4 pass. Original note, ready documents, canonical walk source/date and storage error behavior.
- `npm run qa:local`: 193 tests, lint/build/contracts passed.

No migration, cloud write, production change or paid call. Local fixture is not an exact clone of current cloud schema: older route planning/gap columns are absent there and must be applied before later route persistence checks.
