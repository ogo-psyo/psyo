# Project Intelligence — Псё / pso-mvp

## Purpose

Mobile-first dog owner companion: dog profile/passport, reminders, assistant, map/zones, wishlist/shop, avatar/onboarding, and public dog card.

This file is the agent decision layer for this project. It is not marketing docs.

## Production posture

Псё is being built for commercial use and real people, not as a sandbox toy.

- Treat each slice as either production-safe product surface or explicitly unfinished.
- Do not use "demo", "sandbox", or "prototype" language to excuse weak product behavior unless the UI truly labels that state for users.
- A small slice is acceptable; a fake slice is not.
- Prefer commercially honest UX: clear value, privacy boundaries, error states, support paths, and no overclaiming.
- Local implementation can be incremental, but reporting must distinguish "built locally", "ready for deploy", and "production-ready".

## Stack

- Next.js 16 / React 19 / TypeScript
- App Router under `app/`
- Supabase auth/client helpers
- Leaflet map
- localStorage profile fallback for guest mode
- API routes under `app/api/`
- Vercel deployment

## Required reading for RC1 work

Before changing product scope, auth, billing, reminders, privacy, or release
behavior, read:

1. `IMPLEMENTATION.md`
2. `DESIGN_DIRECTION.md`
3. `docs/pso-hld-soa-2026-06-24/01-HLD.md`
4. current package manifests, migrations and QA scripts

`IMPLEMENTATION.md` is the owner-facing RC1 target. Current code can move toward
it incrementally, but unfinished billing, reminder dispatch, legal, or storage
behavior must stay behind feature flags and honest UI copy.

## Directory map

- `app/page.tsx` — main client app shell, onboarding, tabs and local UI state
- `app/globals.css` — visual system, mobile shell, responsive CSS
- `app/api/` — backend routes for bootstrap, assistant, avatar, pets, reminders, wishlist, zones
- `app/dog/[slug]/page.tsx` — public dog card route
- `components/GeneratedAvatar.tsx` — avatar rendering component
- `components/LiveMap.tsx` — Leaflet map/zones UI
- `lib/` — data, domain helpers, profile storage, Supabase helpers
- `lib/server/` — server-side auth/Supabase helpers
- `scripts/qa/` — local QA/smoke contracts

## Layer boundaries

- Current service-logic reset:
  `docs/service-logic-reset-2026-06-06.md`.
- Shared OpenClaw skills practices research:
  `/Users/ogoruslan/.openclaw/workspace/reports/openclaw-skills-practices-for-leadgen-and-pso-2026-06-06.md`.
- UI screens may use components, client helpers and API routes.
- UI must not bypass API privacy rules.
- API routes may use server helpers and Supabase; they must not import UI components.
- `localStorage` is guest/demo fallback, not authenticated source of truth.
- Auth/session changes are high-risk and require QA.
- Visual-only CSS work must not change API, auth, storage or external provider behavior.
- Non-trivial UI rebuilds must start from a readiness/view-model contract, not
  from adding more cards/tabs.
- Treat the OpenClaw skills ecosystem as a pattern source, not an install list.
  Do not install community avatar, browser, commerce, scraping, assistant, or
  automation skills without source review, local vetting, a test task, and
  explicit approval.

## Source of truth for redesign inputs

- Руслан may provide an external codebase/reference for design, UI structure,
  screen composition, and scenario inspiration.
- If that reference differs from current database/domain/service contracts,
  the current DB and entity/service contracts are the source of truth.
- Pure visual differences may be adapted directly to the current model.
- Scenario differences, missing entities, new fields, new relations, or new
  persistence/API requirements must become explicit backlog tasks before
  changing DB/auth/API behavior.
- Do not silently reshape the DB/domain model to match a design reference.

## Dependency map

```text
UI screens/tabs
→ components
→ client helpers / local profile storage
→ API routes
→ server auth/Supabase helpers
→ Supabase / external providers
```

Forbidden shortcuts:

- UI → Supabase direct policy bypass for private data.
- API routes → UI components.
- CSS/design slice → auth/storage/API behavior changes.
- Guest-mode assumptions → production authenticated behavior.

## Absolute rules

- Do not edit `.env*` or secrets.
- Do not add dependencies without explicit approval.
- Do not deploy without explicit Руслан approval.
- Do not change auth/session/API privacy as part of unrelated UI work.
- Do not weaken unauthenticated privacy checks.
- Do not introduce external sends/emails except through existing approved QA scripts and explicit approval.
- Do not broaden scope silently; report blocker or ask.
- Do not let a visible screen imply production readiness unless its service,
  persistence, privacy/safety state, and QA evidence exist.
- Do not call assistant, health, map, wishlist, avatar, or public-card behavior
  production-ready without explicit readiness evidence.

## Workflow and commands

Local development:

```bash
npm run dev
```

Build/typecheck:

```bash
npm run check
```

Local QA:

```bash
npm run qa:local
```

Auth QA helpers:

```bash
npm run qa:auth:generate-link
npm run qa:auth:send
npm run qa:bootstrap
```

Deploy only after approval:

```bash
vercel --prod
```

## Change-type verification matrix

| Change type | Required check | QA gate |
|---|---|---|
| CSS-only visual polish | `npm run check`; grep/visual inspection if relevant | core_check |
| UI behavior/state | `npm run qa:local` + focused manual/smoke path | QA recommended |
| API/auth/privacy | `npm run qa:local` + targeted auth/bootstrap/API smoke | QA required |
| dependencies/config | approval + build + rollback note | QA required |
| deploy | explicit approval + prod smoke | QA required |
| readiness/service contract | `npm run qa:local` + fixture/smoke for blocked and ready states | QA required |

## Agent handoff rules

Developer handoff must include:

- exact slice;
- likely files;
- non-goals;
- verification command;
- stop condition / blocker rule.

Designer handoff must include:

- target screen/flow;
- first/second/third visual hierarchy;
- constraints and forbidden directions;
- Developer-ready requirements.

QA verifies acceptance criteria and proof, not vibes.

Any agent handoff for Pso must name which service contract it touches:
`ProfileService`, `TodayService`, `ReminderService`, `AssistantService`,
`AvatarService`, `MapZoneService`, `WishlistService`, or `ReadinessService`.

## Design/product rules

- Mobile-first; phone shell is primary.
- Keep the product feeling: warm, pet-centric, practical, not generic SaaS.
- Visual hierarchy should make the next useful action obvious.
- Prefer small design-system slices over whole-app rewrites.
- Respect `prefers-reduced-motion` for motion changes.
- Demo/local/blocked states must be visibly honest; UI copy cannot compensate
  for missing backend or safety gates.
- Commercial readiness matters: a screen should feel useful to a real dog owner,
  not like an internal scaffold.

## Known risk zones

- Supabase auth/session and redirect behavior.
- Unauthenticated access to private pet data.
- Assistant and wishlist auth boundaries.
- Map/zones location privacy.
- Avatar external provider calls.
- Vercel prod deploy.

## Reporting format

```text
Status: done | partial | blocked
Changed:
Proof:
Risks:
Next:
```
