# RC1 Foundation Test Report

Date: 2026-06-25

## Local Gates

Run before deploy:

```bash
npm run qa:local
```

Expected checks:

- `next build`
- env contract
- auth redirect source
- readiness contract
- v1 BFF contract
- RC1 foundation contract
- design concept contract
- prod risk gates
- UX surface contract
- human copy contract

Critical prod-risk defaults:

```text
BILLING_ENABLED=false
PLUS_PAYWALL_ENABLED=false
NEW_INVOICES_ENABLED=false
TELEGRAM_NOTIFICATIONS_ENABLED=false
AI_QA_ENABLED=false
```

`AI_QA_ENABLED=false` means `/api/assistant` must use local rules fallback and must not call the external text provider.

## Manual Visual Check

Generated screenshot:

```text
reports/rc1-foundation-390.png
```

Viewport:

```text
390x844 mobile
```

## Production Smoke

After deploy, verify:

```text
/
/api/internal/health
/api/billing/entitlements
/legal/privacy
/legal/terms
/support
```
