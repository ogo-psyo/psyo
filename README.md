# Pso / Псё

Pso is a mobile-first web/PWA prototype for dog owners. It explores a privacy-first companion layer around a dog profile: daily care, reminders, avatar identity, walking context, map zones, assistant support, and trusted service discovery.

The product thesis is simple: pet-care software should feel personal and useful without turning private pet data into opaque targeting or unsafe social mapping.

## Current Scope

- Dog profile and passport UI.
- Local guest profile persistence.
- Daily care and reminder flows.
- Avatar/profile image handling.
- Privacy-safe map and zone concepts.
- Wishlist / service discovery experiments.
- Assistant API boundary with safety-oriented context.
- Supabase Auth/Postgres/RLS architecture notes and app routes.
- QA scripts for build, env contract, auth redirect source, bootstrap, and local avatar upload.

## Stack

- Next.js App Router
- React
- TypeScript
- Supabase Auth/Postgres/RLS
- Vercel deployment target
- Local-first guest mode with optional cloud persistence

## Local Development

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Verification

```bash
npm run build
npm run qa:local
```

Auth-specific QA scripts require Supabase environment variables and are intended for configured environments:

```bash
npm run qa:auth:generate-link
npm run qa:auth:send
npm run qa:bootstrap
```

## Environment

Copy `.env.example` and fill only the values needed for your environment:

```bash
cp .env.example .env.local
```

Required for full backend/auth flows:

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
```

Never commit real `.env*`, `.secrets`, `.vercel`, build output, or local QA artifacts.

## Architecture Docs

- `docs/pso-companion-prd-hld-2026-05-27/01-PRD.md`
- `docs/pso-companion-prd-hld-2026-05-27/02-HLD.md`
- `docs/pso-companion-prd-hld-2026-05-27/03-Information-Model.md`
- `docs/backend-roadmap.md`
- `docs/production-readiness.md`
- `docs/supabase-setup.md`

## Roadmap

- Harden Supabase-backed profile, reminders, zones, wishlist, and assistant flows.
- Improve privacy controls for map/location data.
- Add moderation and trust rules for user-generated places.
- Expand bounded assistant behavior tests.
- Improve avatar generation and local fallback paths.
- Add release checks for security-sensitive API routes and RLS policies.

## Open Source Status

This repository is prepared as an open-source candidate. Before public release, choose and add a license, verify no private deployment metadata or secrets are present, and review sample/demo data.
