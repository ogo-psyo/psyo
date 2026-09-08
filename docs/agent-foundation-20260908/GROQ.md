# Free-provider slice — 2026-09-08

AssistantService. User approved Groq + free web-search investigation and
implementation; prior deployment approval persists. Paid calls are paused.

## Architecture and state

Existing run/thread/event/memory/artifact tables, ownership checks, admission,
workflow dispatch, cancellation and idempotent save are unchanged. Provider
selection happens before admission and again before run execution. A missing
or unsupported config rejects admission; queued work fails without provider
calls. No migration is needed **for this adapter**; the foundation migration
itself remains unapplied in production.

Agents SDK 0.17.1 already exposes `OpenAIProvider({baseURL,useResponses:false})`
for Chat Completions compatible endpoints. Retain it as the tool loop, explicitly
route to `api.groq.com`; do not substitute the key into a Responses request.

Main tool-calling model → private Pso tools / `web_search` → Compound Mini,
restricted to `web_search` only → structured source records → main model.
Compound cannot run our local/private tools, so it is not the main orchestrator.
No code execution, MCP or secondary search service is added. The already-installed
OpenAI-compatible HTTP client (`openai` 7.10.0) is now an explicit direct dependency
so its own automatic retries can be disabled; runner retry=0 alone left two hidden
HTTP retries. This is a client library, not an OpenAI API call or paid service.
Search only receives the generalized query, not the thread/profile wholesale.
Generalization currently relies on the model instructions; this is not a claim
of automatic removal of every possible personal detail.

## Config (non-secret)

Set through Vercel project settings only after account/live checks:

| Setting | Candidate / meaning |
| --- | --- |
| PSO_AGENT_PROVIDER | groq |
| PSO_AGENT_MODEL | llama-3.3-70b-versatile (candidate, live quality unverified) |
| PSO_AGENT_SEARCH_PROVIDER | groq-compound |
| PSO_GROQ_FREE_VERIFIED | true ONLY after confirming account Free tier AND search entitlement |
| PSO_AGENT_ENABLED | existing kill switch; leave disabled pending release gates |

The gate is an operator attestation, **not** a billing lookup, permanent zero-cost
guarantee or a spend cap. Revalidate if the account plan/model changes. API model
listing and rate-limit response headers do not establish the billing plan. In a
paid account do not set the gate; use an explicitly free project/account first.
Existing `GROQ_API_KEY` stays in Vercel. No key in commands, logs or this document.
No production settings changed during preparation.

## Bounded failure behavior

Seven main-model turns, 90-second run deadline, two search invocations per run,
25-second search timeout; no provider retry and no fallback to OpenAI. Search
429 fails rather than buying additional capacity. Owner/run checks surround
search; a late response cannot undo cancellation. Model and search token counts
are recorded separately. Existing admission limits still apply.

Search citations come only from `executed_tools[].search_results.results`, not
generated answer links or tool-output prose. Unknown/empty response shape fails
explicitly instead of synthesizing evidence. The indexed provider documentation
and SDK tests inform this shape; actual Compound response compatibility is a
**live gate**, not yet proven. Search snippets are evidence of retrieval, not
proof that a full page was read or a fact is correct.

## Verification / deployment gate

Local evidence: full `npm run qa:local` passed (158 tests, build, contracts,
unchanged 220-warning lint budget). Six provider-specific tests exercise the
installed SDK with intercepted HTTP: main model → function call → search →
tool result → answer; exact endpoint, no OpenAI fallthrough; missing free gate;
structured citation filtering; two-search cap/cancellation; main-model and
search 429 each produce one HTTP call. Responses are fixtures, not live Groq.
The extra quota test initially found three hidden HTTP attempts; client-level
`maxRetries: 0` fixed it and the same test passed. Dependency audit: zero findings.
No database/auth policy changes in this slice. Previous foundation SQL/browser
evidence remains applicable; this does not upgrade it to live provider proof.

- Verify Free/no payment and actual allowed models/search in Groq Console.
- On isolated cloud deployment using existing protected provider config: check
  model tools, genuine Compound structured sources, quota failure and no paid
  fallback. Use fictional pet/public queries; record aggregate counts/timing,
  never prompts, keys, raw provider errors or reasoning in logs.
- Check personalization → public search → follow-up → explicit save → reopen;
  memory correction/forgetting; existing SQL ownership/cancellation gates.
- Complete source-ingestion and cloud Workflow checks from READINESS.md.
- Release only after live gates; smoke both aliases. Do not publish this locally
  tested adapter as a completed live agent.

Rollback: disable `PSO_AGENT_ENABLED`, keep existing Groq FAQ-style helper and
all stored data. Switching back to paid OpenAI requires separate explicit config
and spending authorization; never perform it automatically.

## Sources and evidence limits

- https://console.groq.com/docs/tool-use/built-in-tools — official indexed text
  states Compound cannot use local tools/MCP, supports enabled-tools restriction.
- https://console.groq.com/docs/tool-use/built-in-tools/web-search
- https://console.groq.com/docs/compound/built-in-tools
- https://console.groq.com/docs/rate-limits — account limits remain unverified.
- Installed `@openai/agents-openai/dist/openaiProvider.d.ts` and
  `openaiChatCompletionsModel.js`: actual provider/serialization/retry contract.

Direct web_fetch of documentation was blocked by reserved DNS; no bypass.
Therefore current indexed documentation is partial evidence, not a full-page
or account verification. Existing Vercel metadata confirms Groq credential
presence, not provider balance/plan. No live model/search calls during preparation.
