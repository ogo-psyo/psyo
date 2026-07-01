# Псё — HLD

## Purpose

Псё is a Telegram Mini App / Next.js product slice for dog owners: a living companion center for dog identity, daily care loop, reminders, approximate places, assistant context, things, and shareable/printable dog card.

## Runtime Architecture

- Client: Next.js App Router, mobile-first UI, Telegram WebApp bootstrap, local guest state.
- Server/API: Next route handlers under `app/api/*`, owner/auth checks, payload mapping, safety boundaries.
- Data: Supabase Auth + Postgres + RLS for private owner-scoped state.
- Local fallback: `localStorage` profile/reminders/zones/wishlist for guest mode and demo resilience.
- Providers: avatar generation endpoint, assistant endpoint, Telegram bot webhook.
- Delivery: Vercel production alias `https://pso-mvp-uglanovrms-projects.vercel.app`.

## Quality Gates

- `npm run check` builds the app.
- `check-env-contract` guards required env documentation.
- `check-auth-redirect-source` guards auth redirect source.
- `check-readiness-contract` guards readiness integration.
- `check-ux-surface-contract` blocks technical/internal UI overload.
- `check-human-copy-contract` blocks raw enum/status labels and requires Russian human copy formatters.

## Human Copy Contract

- System states stay as enums in data/API contracts.
- Raw enum/status labels in UI are forbidden: no `complete`, `incomplete`, `overdue`, `ready`, `risk_zone`, `high`, or service jargon as visible copy.
- User-facing statuses, markers, CTAs, counters, and helper text must go through `lib/copy.ts` formatters.
- Copy must account for pet context: `{pet_name}`, Russian cases where needed, plural forms, and the domain context of the state.
- The home screen label is `Сегодня с {pet_name}` with fallback `Сегодня с питомцем`.
