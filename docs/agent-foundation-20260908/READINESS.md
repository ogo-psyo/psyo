# Release readiness — agent foundation

Status: local implementation; production activation blocked. This is the first
foundation slice of the target architecture, not every future integration.

## Implemented

- Agents SDK with bounded turns/time, hosted search, private profile/passport/
  temperament/memory lookup, saved-record search and imported-knowledge search.
- Shared server mutation services: save the previous answer by explicit command
  or button; remember an exact user quote by explicit command; UI correction and
  forgetting. Owner checks and atomic replay/cancellation guards in Postgres.
- Durable Vercel Workflow dispatch, database run state, polling/reopen/cancel,
  interrupted-worker recovery, safe tool-name event log and usage records.
- Supabase source config, restricted HTTPS ingestion, source revisions/search,
  daily scheduler, no loss of the previous good revision on refresh failure.
- Existing manual app capabilities retained. No rejected redesign imported.
- Separate agent and knowledge kill switches. Both are OFF unless configured.

## Verified locally

- Private pre-change backup restored in an isolated networkless Postgres instance:
  application schema, auth/storage schema, data, source bundle and Storage files.
  Storage lengths and available ETags compared. Detailed receipt remains private.
- `npm run qa:local`: build, 152 tests, contracts and lint budget passed.
- Dedicated SQL transaction: ownership/RLS, duplicate requests, input conflict,
  memory correction/forgetting, idempotent saves, refusal after cancellation,
  memory mutation replay and removal of derived memory payload.
- 9 anonymous HTTP checks: all new private endpoints and the scheduler refused
  access (401). This does not substitute for authenticated live acceptance.
- Chromium/WebKit, 320/390: reconnect after closing/reloading, save failure/retry,
  saved-answer reopening, memory editing/forgetting and cancellation. API fixtures
  were explicitly synthetic; no model-quality claim comes from these tests.
- Local Workflow actually dispatched and completed a source job with the source
  switch OFF (no network/provider call). CLI uses the same `.next/workflow-data`
  directory as Next.js. Cloud durability still needs staging verification.
- Dependencies audited: zero known vulnerabilities after compatible transitive
  fixes for nanoid and undici. Do not remove those overrides without rechecking.

## Blocking live gates

1. OpenAI account key is absent from current production. Protected entry timed
   out without a credential. Never paste the key into chat or committed files.
2. Paid API-test allowance is not yet established. Select a supported model from
   the authorized account and record real latency, calls and usage before rollout.
3. Direct local source fetch is correctly denied: the environment resolves the
   public site to a reserved address. Do not weaken SSRF protection. Validate the
   actual source fetch on Vercel's public egress before enabling ingestion.
4. Cloud run recovery, authenticated live model/tools, source refresh, two-owner
   isolation and final post-deployment smoke on both aliases remain pending.

## Activation procedure (deployment already authorized)

1. Verify current production source and recovery point are still c15d067; refresh
   backup if external changes occurred. Keep the prior immutable deployment.
2. Configure the OpenAI credential using Vercel's masked environment UI and set
   `PSO_AGENT_MODEL` to the tested model. Configure spending limits before live use.
3. Apply the additive migration after local SQL/QA gates. Never reset existing
   tables or replace production with a local restored database.
4. Validate a preview with approved test identities. Enable the single configured
   source for the test only; GB is a source fixture, not a chosen launch market.
5. Test trip preparation, equipment selection and finding a saved record; check
   follow-up, explicit save, correction/forgetting and an unavailable source.
6. Only after those gates enable `PSO_AGENT_ENABLED=true` and, if source checks
   pass, `PSO_KNOWLEDGE_ENABLED=true`. Release and verify BOTH aliases.
7. Record revision, deployment ID and `/api/internal/health` flags. App rollback
   retains additive tables/new user records and can disable the new agent alone.

## Explicit limits

Document contents/OCR are not implemented: the new search tool returns metadata.
Private search checks the most recent 60 records per selected type and says so.
Direct write commands currently support the unambiguous «сохрани…» and
«запомни…» forms; other edits have explicit UI controls. This does not imply
arbitrary booking, messaging, payments, care mutations, map-route calculation or
every other existing API is already exposed as a tool. Their manual paths remain.
No public dog-friendly catalog, all-sites crawler or production reminder-delivery
overhaul is claimed by this release.

## Official implementation references

- https://developers.openai.com/api/docs/guides/agents/quickstart
- https://developers.openai.com/api/docs/guides/tools
- https://useworkflow.dev/docs/getting-started/next
- Installed Next.js 16 route-handler documentation and installed SDK declarations.
