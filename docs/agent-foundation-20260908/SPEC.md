# Agent foundation — authorized production implementation

User approval: 2026-09-08, «Сделай бэкап и делаем прод». Baseline c15d067.
No redesign; preserve all manual product capabilities. The earlier planning-only
restriction is superseded. External sends, purchases and paid-provider tests
require their own established authorization; deployment itself is authorized.

## Service contracts and implementation backlog

1. Recovery: verified git restore; database schema/data backup; Storage objects;
   checksums and immutable previous deployment. No destructive migrations.
2. AssistantService: authenticated durable runs through Workflow SDK on Vercel;
   OpenAI Agents SDK + hosted search; status/cancel/reconnect and bounded usage.
3. MemoryService: owner/pet facts with source, correction and deletion; independent
   of public knowledge. No unrestricted SQL tool or client-controlled owner.
4. KnowledgeService: admin-managed source config; bounded public HTTPS fetch,
   extracted versioned text, active revision and failed-refresh diagnostics.
5. ResultService: saved research/plans with sources, stable IDs and ownership;
   manual app actions and tools share services. No fake route or saved-state IDs.
6. UI: existing assistant gains persisted jobs/results; no fabricated suggested
   action buttons based on keywords in the agent branch. Explicit failure state.
7. Acceptance: live different-intent queries, follow-up, memory recall/correction,
   save/reopen, source refresh failure, cancel, cross-owner denial, rollback flag,
   existing local QA, production smoke for both aliases.

## State-first design

Supabase is canonical for runs, results, memories and source revisions. Vercel
Workflow handles durable dispatch/retry; only opaque run IDs cross its queue.
Private content stays in Supabase and is loaded in authorized worker steps.
Run states: queued → running → succeeded | failed | cancelled. Failed runs expose
a safe error and explicit retry; no silent fallback that loses saved actions.
Unique client request IDs prevent double submissions. Worker attempts and model
turns/time/output are bounded. Tool writes use stable run-scoped identities.
Cancellation is checked before every product mutation; already completed writes
remain visible. No retry may duplicate a saved plan or memory item.

Threads belong to one owner/pet. Revalidate ownership before any private read,
write or run-status disclosure. Server-assigned principals never come from model
arguments. RLS denies anonymous access and enforces owner for ordinary clients;
server-role execution still checks the same domain boundary.

Private memories are not copied into general knowledge. Corrections supersede,
deletion removes content from derived agent state and prevents reintroduction
from stale thread summaries. User profile stays authoritative, not duplicated.
General knowledge records retain source URL, retrieval time, applicability,
content hash and active revision. A failed fetch never advances freshness.

## Release gates

Agent flag off keeps current assistant unchanged. Missing credentials/model or
storage must never enable a broken agent. Key and paid-test allowance currently
pending; no live provider calls until resolved. Flag-on release requires live QA.
Rollback restores current immutable app deployment; additive tables remain,
including new user data. Do not deploy rejected worktree UI changes.

## Boundaries

The foundation is general-purpose, not a scripted walk assistant. Coverage of
every external source, commercial catalog and document format is not implied.
No autonomous messaging, booking or purchasing tool is introduced. Existing
map/social/care interfaces remain usable regardless of agent availability.
