# RC1 Foundation Release Runbook

## Before Deploy

```bash
npm run qa:local
```

If a local server is running, capture the reproducible visual gate:

```bash
BASE_URL=http://127.0.0.1:3101 OUT_DIR=test-results/design-audit npm run qa:visual
```

Required evidence before saying "ready":

- agent outputs or explicit owner decision for Product/UX, Backend/Auth/Privacy, Frontend/UX and QA/Release;
- fresh mobile check of onboarding -> first care task -> Today -> history -> Pamyatka;
- public memo blocked and ready states checked for private-field leaks;
- auth/bootstrap smoke proves Telegram/session behavior and unauthenticated bootstrap does not return private pets;
- IDOR/service-role matrix is green for owner-scoped routes before any public launch claim;
- visual scripts are either green with project-pinned browser dependencies or explicitly marked blocked;
- known limitations updated if any primary surface is local/demo/blocked;
- explicit Руслан approval for production deploy.

Do not enable billing or new invoices unless owner/legal gates are approved.

## Deploy

```bash
npx vercel deploy --prod -y
```

## Smoke

Check:

```bash
APP_URL=https://pso-mvp-uglanovrms-projects.vercel.app npm run qa:prod:smoke
```

Smoke must include content/privacy evidence, not only HTTP status:

- `/` includes the core care loop and does not promote fake social/community/commerce;
- `/api/internal/health` reports production env and expected disabled risky flags;
- `/api/internal/health` includes a release identifier for the deployed build;
- `/api/billing/entitlements` keeps billing/paywall blocked unless explicitly approved;
- unauthenticated `/api/app/bootstrap` does not return a private pet;
- public memo page shows only allowlisted fields.

## Rollback

If RC1 foundation breaks the Mini App:

1. Promote the previous Vercel production deployment.
2. Keep Telegram webhook receiving updates.
3. Keep billing flags off.
4. Record the failure in `docs/KNOWN_LIMITATIONS.md` or a dated incident note.

## Mini-app entrypoint gate (postmortem 2026-09-07)

A successful short alias is not a completed Mini App release. Enumerate Vercel aliases and record the actual configured Telegram entry URL. Never claim BotFather/menu configuration was inspected unless it was. The documented legacy hostname must not stay pinned to an older deployment.

After deploy and alias assignment, verify the exact merge SHA on both supported origins:

```bash
node scripts/qa/check-release-entrypoints.mjs EXPECTED_FULL_SOURCE_SHA
```

Also browser-smoke the legacy/Telegram origin, preserving its origin (no redirect migration of local drafts/auth). Record deployment READY, both health results, applicable authenticated write acceptance and physical Telegram coverage separately. If alias reassignment is needed, use the already tested deployment and verify again. A rollback must account for all supported aliases and preserve additive data/migrations.
