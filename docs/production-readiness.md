# Псё — production readiness snapshot

## Current scope

Рабочая RC1 visual/product foundation:

- Telegram-first entry copy and browser/local fallback;
- dog profile, first care task and Today care loop;
- safe public memo preview with share/open/print blocked until required public fields exist;
- privacy-safe personal map surface;
- Supabase/Telegram persistence foundation exists, but owner-isolation tests are not complete.

## Production boundaries

Сейчас нельзя говорить "prod ready". Для настоящего production нужны:

1. One explicit production owner model: Telegram primary, browser/email either gated or documented as QA fallback.
2. IDOR/RLS regression suite for pets, reminders, wishlist, zones, map features and assistant context.
3. DB-backed public dog-card publish/unpublish with an allowlisted projection.
4. Reminder delivery loop or honest removal of delivery promises.
5. Visual QA with reproducible Playwright/browser dependency.
6. Deep health: DB ping, required migrations/tables, RLS probe, Telegram fixture and release identifier.

## Verification gate

Current local gate:

```bash
npm run qa:local
```

This proves build and static contracts. It does not prove "ready" or "prod".

Reproducible local visual gate, after starting the app on `BASE_URL`:

```bash
BASE_URL=http://127.0.0.1:3101 OUT_DIR=test-results/design-audit npm run qa:visual
```

Production smoke gate, after a Ready deployment:

```bash
APP_URL=https://pso-mvp-uglanovrms-projects.vercel.app npm run qa:prod:smoke
```

Blocked gates before "ready":

- visual owner-flow smoke: onboarding -> first care task -> Today -> complete -> history -> Pamyatka blocked/ready;
- auth/bootstrap smoke with Telegram fixture and unauthenticated no-pet check;
- public memo privacy snapshot;
- IDOR matrix for user A vs user B;
- release artifact with Product/UX, Backend/Auth/Privacy, Frontend/UX and QA/Release veto outputs.

## Deployment gate

Do not deploy to Vercel until Руслан explicitly confirms production deploy.

After deploy, do not say "prod" until:

- Vercel deployment is Ready, not just submitted;
- production smoke includes content/privacy/flag evidence, not only HTTP 200;
- `/api/internal/health` identifies production env and release;
- billing/new invoices/AI/avatar/uploads remain disabled unless explicitly approved;
- known limitations and release notes are updated.
