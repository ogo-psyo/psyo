# Project Intelligence — Псё / pso-mvp

## Purpose

Mobile-first dog owner companion: dog profile/passport, reminders, assistant, map/zones, wishlist/shop, avatar/onboarding, and public dog card.

This file is the agent decision layer for this project. It is not marketing docs.

## Stack

- Next.js 16 / React 19 / TypeScript
- App Router under `app/`
- Supabase auth/client helpers
- Leaflet map
- localStorage profile fallback for guest mode
- API routes under `app/api/`
- Vercel deployment

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

- UI screens may use components, client helpers and API routes.
- UI must not bypass API privacy rules.
- API routes may use server helpers and Supabase; they must not import UI components.
- `localStorage` is guest/demo fallback, not authenticated source of truth.
- Auth/session changes are high-risk and require QA.
- Visual-only CSS work must not change API, auth, storage or external provider behavior.

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

## Design/product rules

- Mobile-first; phone shell is primary.
- Keep the product feeling: warm, pet-centric, practical, not generic SaaS.
- Visual hierarchy should make the next useful action obvious.
- Prefer small design-system slices over whole-app rewrites.
- Respect `prefers-reduced-motion` for motion changes.

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
