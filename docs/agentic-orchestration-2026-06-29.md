# Pso Agentic Orchestration Control Tower — 2026-06-29

## Why This Exists

The 2026-06-29 night pass improved the product, but the execution failure was real: one critical rescue slice was reported as a SWARM. From now on, "agentic" work on Pso means visible role ownership, separate outputs, explicit gates, veto power and a recorded integration decision.

This document is the control tower for turning Pso from a demo-like MVP into a product Руслан can show to dog owners without apologizing.

## Mission

Build a trustworthy owner loop:

```text
Telegram session -> one dog profile -> first care task -> Today loop -> safe public memo -> return habit
```

Everything outside that loop is secondary until it has real service, privacy and QA evidence.

## Operating Rules

- No role is advisory-only. Each role can block release in its layer.
- No primary UI promise without a backing service contract or visibly honest blocked/demo state.
- No production deploy without Руслан approval, `npm run qa:local`, release note and smoke evidence.
- No fake network, fake marketplace, fake nearby dogs, fake AI certainty or fake public readiness.
- No "done" report without changed files, proof, risks and next action.

## Agent Roster

| Role | Owns | Veto If | Required Output |
|---|---|---|---|
| Product / IA | owner journey, activation, primary nav, copy promises | first 10 seconds need verbal explanation; core loop is unclear | journey diff, P0/P1 backlog, acceptance criteria |
| Frontend / UX | mobile shell, states, visual hierarchy, interaction ergonomics | fake controls, happy-path-only UI, unreadable mobile screens | UI fixes, screenshots or visual audit notes |
| Backend / Auth / Privacy | Telegram session, owner scope, Supabase, public card allowlist | private data can leak; guest state looks durable; auth copy is unsafe | service-contract gaps, API risks, test requirements |
| QA / Release | local QA, visual checks, prod smoke, rollback | proof is status-code-only; gates miss visible claims | command list, stop-the-line criteria, release evidence |
| Orchestrator | integration, sequencing, final decision | roles conflict unresolved; critical path unclear | final decision log and next slice plan |

## Current Parallel Audit

Started after Руслан's 2026-06-29 13:29 complaint.

| Agent | Role | Scope | Expected Artifact |
|---|---|---|---|
| Leibniz | Product / UX audit | docs, `app/page.tsx`, first-use loop | top product gaps and P0/P1 acceptance criteria |
| Darwin | Backend / auth / privacy audit | `app/api/**`, `lib/**`, migrations, auth docs | launch risks and engineering gates |
| Lorentz | Frontend / design audit | `app/page.tsx`, `app/globals.css`, components, design lab | mobile/design fixes and quick wins |
| Wegener | QA / release audit | package scripts, `scripts/qa/**`, release docs | release pipeline and stop conditions |

The orchestrator integrates their outputs into this document or a dated successor before any new release claim.

## P0 Execution Pipeline

### Slice 1: Trustworthy First Session

Owner: Product / IA + Frontend / UX

Acceptance:

- first screen says what Pso does in one glance: plan, reminder, memo;
- onboarding creates a dog and a care task without hidden magic;
- Today shows next action, memo readiness and recent history;
- no decorative panels compete with the next action.

Likely files:

- `app/page.tsx`
- `app/globals.css`
- `scripts/qa/check-ux-surface-contract.mjs`

Gate:

- mobile visual audit for Today/onboarding;
- `npm run qa:local`;
- Руслан can explain the product after 10 seconds without narration from us.

### Slice 2: Public Memo Worth Sharing

Owner: Product / IA + Backend / Auth / Privacy + Frontend / UX

Acceptance:

- memo preview shows exactly what another person sees;
- share/open/print is blocked until dog name, contact rule and bio/triggers exist;
- exact address, owner private contact, medical notes and private history do not leak;
- public route and app preview use the same safety model.

Likely files:

- `app/page.tsx`
- `app/dog/[slug]/page.tsx`
- `app/dog/[slug]/DogCardActions.tsx`
- `scripts/qa/check-ux-surface-contract.mjs`

Gate:

- public-card allowlist check;
- local and prod smoke for `/dog/card?...`;
- screenshot of app preview and public route.

### Slice 3: Durable Care Loop

Owner: Backend / Auth / Privacy + Product / IA

Acceptance:

- reminder create, complete, snooze and edit/delete are service-backed or honestly marked local;
- first care task survives reload in authenticated flow;
- guest mode is visibly local and non-durable;
- Today prioritization is deterministic and test-covered.

Likely files:

- `app/page.tsx`
- `app/api/reminders/**`
- `lib/server/**`
- `lib/readiness.ts`
- `scripts/qa/check-readiness-contract.mjs`

Gate:

- bootstrap/reminder smoke;
- guest-vs-auth copy gate;
- no UI copy implies durable cloud sync without evidence.

### Slice 4: Release Discipline

Owner: QA / Release + Orchestrator

Acceptance:

- `npm run qa:local` passes;
- visual-state screenshots exist for Today, Pamyatka, Map, Plan, Profile;
- release note lists known limitations honestly;
- prod smoke checks content and safety states, not only HTTP 200;
- no deploy without explicit Руслан approval.

Likely files:

- `docs/RELEASE_RUNBOOK.md`
- `docs/TEST_REPORT.md`
- `docs/KNOWN_LIMITATIONS.md`
- `scripts/qa/**`

Gate:

- stop-the-line on any failed local gate;
- stop-the-line if any primary screen promises social, marketplace, AI certainty or public network without backing data.

### Slice 5: Owner Isolation And Public Privacy

Owner: Backend / Auth / Privacy + QA / Release

Acceptance:

- production owner model is explicit: Telegram primary, browser/email mode either gated for QA or documented as non-primary;
- no write route trusts a client-provided owner id;
- service-role fallbacks are covered by IDOR tests for pets, reminders, wishlist, zones, map features and assistant context;
- `/dog/[slug]` is either clearly query-preview-only or backed by persisted publish/unpublish with an allowlisted public projection;
- social/map public surfaces require explicit consent and cannot expose another owner's private dog/profile data.

Likely files:

- `app/api/**`
- `lib/server/**`
- `supabase/migrations/**`
- `app/dog/[slug]/page.tsx`
- `scripts/qa/**`

Gate:

- Telegram fixture smoke for valid, expired and tampered `initData`;
- IDOR matrix for user A vs user B across owner-scoped routes;
- rendered public-card privacy snapshot that fails on forbidden private fields;
- health check proves DB/migration/RLS basics, not only environment booleans.

## P1 Backlog After P0

- Assistant action engine: answer -> create reminder, memo note or map note.
- Profile depth: diet, allergies, meds, vet notes, social rules, triggers, alone time.
- Calendar/reminder editing: recurrence, reschedule, delete, overdue grouping.
- Map as personal notebook first: approximate places, private routes, no public community layer until real moderation/data.
- Wishlist as care inventory, not marketplace: need, reason, bought, unsuitable, rebuy date.
- Auth architecture ADR: converge Telegram session, Supabase owner bridge and browser QA mode into one production owner model.

## Integration Decision Format

Every orchestrated pass ends with:

```text
Status: done | partial | blocked
Agents:
Changed:
Proof:
Vetoes:
Risks:
Next:
```

## Current Decision

Status: partial

Agents:

- Product / UX: rescue improved the product, but first-use could still bypass the first care task; primary nav was too broad; PRD/current-state docs had drift.
- Backend / Auth / Privacy: Telegram owner path and Supabase persistence foundation exist, but auth models are mixed; service-role routes need IDOR regression tests; public card is not a persisted backend slug yet.
- Frontend / UX: bottom nav and duplicate/fake controls made the app feel prototype-like; quick wins include reducing nav, removing dead CTAs, fixing memo duplication and demo-avatar honesty.
- QA / Release: `qa:local` is useful but mostly static; visual scripts are not a reliable release gate until Playwright is an explicit dependency; prod smoke must verify content/privacy/flags, not just HTTP 200.

Changed:

- created this control tower;
- added `scripts/qa/check-agentic-orchestration-contract.mjs`;
- wired the orchestration contract into `npm run qa:local`;
- tightened onboarding so reveal-stage exits create the first care task instead of opening an empty app;
- made public memo readiness match the checklist by requiring safe neighborhood/area before share/open/print;
- reduced primary bottom nav to the mature core: `Главная`, `План`, `Памятка`, `Профиль`;
- updated design/UX contracts so deferred `Ассистент` and `Карта` are not required as primary surfaces.

Proof:

- `npm run qa:local` passed after the integration.

Vetoes:

- Product veto: do not call this "non-MVP ready" until first-session owner flow is visually proven.
- Backend/privacy veto: do not call public dog card backend-backed until persisted publish/unpublish and allowlist projection exist.
- Backend/privacy veto: do not call the app production-safe until mixed auth paths and service-role routes have automated IDOR coverage.
- QA veto: do not call anything "prod" without explicit Руслан approval, waitable deploy, prod content/privacy smoke and release evidence.
- Frontend veto: visual gate is blocked until Playwright/browser binaries are reproducible in the project.

Risks:

- current product still has broad app-shell ambition in secondary tabs;
- API owner isolation needs automated IDOR coverage;
- auth architecture still mixes Telegram app-session, Supabase Auth, Better Auth route/schema and browser magic-link surfaces;
- reminder delivery is CRUD/history only, not production notification delivery;
- public dog card is still a query-param preview, not a persisted backend publish/unpublish lifecycle;
- production deploy was not performed and must not be performed without explicit approval.

Next:

- P0 QA slice: add owner-flow smoke for create dog -> first reminder -> complete -> history -> memo blocked/ready;
- P0 backend slice: design DB-backed public memo publish/unpublish and allowlist route;
- P0 security slice: add IDOR/service-role regression matrix and Telegram fixture smoke before any public launch claim;
- P0 release slice: make visual/auth/privacy gates reproducible and record screenshots/evidence before any "ready" claim.
