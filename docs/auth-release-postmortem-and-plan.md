# Auth / Magic Link Incident — Postmortem and Release Plan

## Context

Project: `pso-mvp`
Production URL: `https://pso-mvp-uglanovrms-projects.vercel.app`
Supabase project ref: `cnqcwchseefwqgjgnmyn`

Incident:
1. Magic links redirected to `localhost` because Supabase hosted Auth `site_url` was still local.
2. Follow-up testing burned through Supabase built-in email quota and `signInWithOtp` started returning `429 email rate limit exceeded`.

## Executive diagnosis

This was not just a bad Supabase setting. The architectural failure was that agent roles existed as an advisory layer, but not as release gates.

Previous flow effectively was:

```text
Idea → Build → Deploy → Manual Fixes → Oops
```

Required flow:

```text
Intent → Scope → ADR/Risk Review → Implementation → Role Gates → Release Checklist → Smoke → Runbook/Postmortem
```

## Root causes

### 1. Wrong canonical auth origin

- Supabase Auth `site_url` was local.
- App code had no strict single source of truth for auth redirect origin.
- A workaround was added in `app/page.tsx`: localhost redirects to prod. This protects the production URL but is not a clean long-term dev/staging model.

### 2. Email tests used real production email flow

- Magic-link verification used real Supabase Auth email sending.
- Built-in Supabase email sender has strict limits and is not suitable for repeated QA.
- Raising local config rate limits does not fully solve hosted/default email-provider limits without custom SMTP.

### 3. Environments are not separated enough

- Local, preview/staging, and production redirect behavior are mixed.
- Production Supabase project is used for too much QA.
- No dedicated staging Supabase/Auth email setup.

### 4. Release scripts/docs are incomplete

Known gaps from repo inspection:

- `.env.example` / docs/scripts must explicitly cover:
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- `scripts/connect-supabase.sh` mixes setup, env mutation, schema push, deploy, and smoke. This should be split.
- `docs/supabase-setup.md` needs auth redirect/rate-limit-safe QA guidance.
- `.gitignore` should ignore local env/secrets:
  - `.env`
  - `.env.*`
  - `!.env.example`
  - `.secrets/`

### 5. No auth readiness gate

Before saying “ready”, the system did not require proof for:

- hosted Supabase Site URL;
- redirect allowlist;
- Vercel env completeness;
- frontend Supabase client initialization;
- no-send magic-link redirect smoke;
- production email-provider/rate-limit policy;
- rollback/runbook.

## Target auth architecture for MVP

### Production

- App URL: `https://pso-mvp-uglanovrms-projects.vercel.app`
- Supabase Auth:
  - `site_url = "https://pso-mvp-uglanovrms-projects.vercel.app"`
  - redirect allowlist includes exact production URL.
- Vercel env:
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Custom SMTP should be connected before serious production email QA:
  - Resend / Postmark / Mailgun / SendGrid
  - sender domain
  - SPF/DKIM

### Staging / preview

Preferred:

- separate Supabase project;
- separate Vercel preview/staging URL;
- Mailtrap / Resend sandbox / Postmark test stream;
- e2e email tests run here, not on production.

Minimum acceptable MVP version:

- production Supabase project can allow exact preview URLs temporarily;
- no real email smoke by default;
- only `admin.generateLink` no-send checks in automation.

### Local

Preferred:

- `supabase start`;
- Inbucket at `http://localhost:54324`;
- no external email delivery.

Local app:

- `NEXT_PUBLIC_APP_URL=http://localhost:3000`;
- local redirects should stay local.

## App auth recommendation

Short term MVP:

```ts
const redirectTo = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
```

Better next step:

- make `NEXT_PUBLIC_APP_URL` required in production;
- add `/auth/callback` route;
- move toward `@supabase/ssr` cookie-based session handling instead of passing bearer tokens from client to API.

## Agent operating model

Roles are not “advisors”. They are release gates.

### Required roles for auth/data releases

1. **Product Lead**
   - validates user journey and sprint scope;
   - veto if user flow is broken or irrelevant.

2. **Backend/Data/Auth Architect**
   - owns Supabase, RLS, auth, migrations, ownership;
   - veto if auth/data safety is uncertain.

3. **QA/Release Engineer**
   - owns env, deploy, smoke tests, rollback, rate limits;
   - veto if release checklist or smoke is missing.

4. **Ops Incident Commander**
   - activated on production incidents;
   - owns mitigation, comms, postmortem, runbook.

5. **Safety/Vet Reviewer**
   - required for assistant/medical/behavior flows, not core auth.

## Required artifacts

Create and maintain:

```text
docs/releases/sprint-1-auth-release.md
docs/adr/0001-auth-redirect-and-session-model.md
docs/runbooks/auth-magic-link.md
docs/runbooks/supabase-email-rate-limit.md
docs/risk-register.md
docs/owner-map.md
docs/qa-release-auth.md
```

## Release gates

A feature is not “ready” until:

1. Scope and non-goals are clear.
2. ADR exists for architectural choices.
3. Risk register is updated.
4. Backend/Auth Architect pass.
5. QA/Release pass.
6. Product Lead pass.
7. Release checklist passes.
8. Production smoke passes.
9. Rollback/mitigation path exists.

For auth releases, Backend/Auth and QA/Release have hard veto.

## QA pipeline

### Local gate

No production calls, no real emails.

Commands/checks:

```bash
npm ci
npm run check
node scripts/qa/check-env-contract.mjs
node scripts/qa/check-auth-redirect-source.mjs
```

Acceptance:

- build passes;
- env contract complete;
- no hardcoded localhost in production auth path;
- no real emails sent.

### Staging / preview gate

Default smoke is no-send:

```ts
supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: 'qa+pso@example.com',
  options: { redirectTo: process.env.EXPECTED_APP_URL }
})
```

Checks:

- generated link contains expected app URL;
- generated link does not contain localhost/127.0.0.1;
- frontend Supabase env is present;
- API bootstrap does not 500;
- protected routes reject bad tokens with 401, not 500.

### Production gate

Before deploy:

- local gate green;
- staging/preview no-send smoke green;
- Vercel production env checked;
- Supabase hosted Auth config checked;
- prod no-send magic-link redirect smoke green.

After deploy:

- production URL returns 200;
- `/api/app/bootstrap` returns valid JSON;
- login screen renders;
- frontend Supabase client initializes;
- real email smoke: max 1 controlled test, manual only, only if explicitly allowed.

## Scripts to add

Recommended structure:

```text
scripts/qa/check-env-contract.mjs
scripts/qa/check-auth-redirect-source.mjs
scripts/qa/check-frontend-env.mjs
scripts/qa/smoke-auth-generate-link.mjs
scripts/qa/smoke-auth-send-email.mjs
scripts/qa/smoke-bootstrap-auth.mjs
scripts/qa/smoke-prod.sh
scripts/qa/smoke-staging.sh
```

Recommended package scripts:

```json
{
  "qa:local": "npm run check && node scripts/qa/check-env-contract.mjs && node scripts/qa/check-auth-redirect-source.mjs",
  "qa:auth:generate-link": "node scripts/qa/smoke-auth-generate-link.mjs",
  "qa:auth:send": "node scripts/qa/smoke-auth-send-email.mjs",
  "qa:prod": "bash scripts/qa/smoke-prod.sh"
}
```

## Real email test rules

Real email sending must not be part of default CI.

Required guard:

```bash
ALLOW_REAL_EMAIL_SEND=1 QA_EMAIL=... npm run qa:auth:send
```

Rules:

- one call only;
- sanitized output only;
- not on every deploy;
- prefer staging SMTP sandbox;
- production real email smoke only after no-send checks pass.

## 48-hour recovery plan

### 0–4h: stabilize

- Freeze auth changes except hotfixes.
- Confirm Supabase Site URL and redirect allowlist.
- Confirm Vercel env completeness.
- Stop repeated real email tests.
- Document current incident.

### 4–12h: hotfix hardening

- Add client-side cooldown on magic-link button.
- Show explicit 429/rate-limit message.
- Ensure canonical redirect is deterministic.
- Add no-send auth smoke script.

### 12–24h: verification

- Run no-send prod magic-link redirect smoke.
- Verify prod URL 200.
- Verify bootstrap JSON.
- If email quota recovered, run one real email test only.

### 24–48h: operationalize

- Add ADR, runbook, risk register, owner map.
- Split setup/deploy/smoke scripts.
- Connect SMTP or staging email sandbox.
- Make Backend/Auth + QA/Release pass mandatory for auth/data changes.

## Current decision

Do not continue repeated production email testing until either:

1. Supabase email quota resets and one controlled real-email smoke is allowed; or
2. custom SMTP / sandbox email provider is connected; or
3. a temporary QA-only no-send auth bypass is implemented outside production user flow.
