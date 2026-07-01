# Псё RC1 Implementation Contract

Source: owner-provided RC1 spec, 2026-06-25.

## Product Target

Псё is a Telegram Mini App for dog owners. RC1 must prove a recurring care loop:

```text
open in Telegram
→ create pet
→ create first reminder
→ receive Telegram reminder
→ complete it
→ see care history
→ hit a contextual free limit
→ upgrade to Псё Плюс through Telegram Stars
```

The product promise is:

```text
Псё помнит
→ вовремя напоминает
→ помогает выполнить
→ сохраняет историю
→ координирует заботу
→ даёт ощущение контроля
```

## RC1 Release Gates

Do not enable production billing, broad acquisition, or irreversible data
migrations until these owner/legal decisions are confirmed:

- Stars price and subscription terms;
- support contact;
- privacy policy and terms;
- personal-data storage/localization decision;
- production bot token and webhook secret;
- database backup/restore procedure.

Default dev values are allowed only behind safe feature flags:

```text
plus price: 199 Stars / 30 days
founder price: 149 Stars
free pets: 1
free active reminders: 3
free history: 30 days
billing_enabled: false
plus_paywall_enabled: false
```

## Scope Priority

1. Telegram-first identity and server-side `initData` validation.
2. Pet onboarding with first useful reminder.
3. Home screen: status, nearest action, quick actions, 7-day view, history.
4. Care events, reminder jobs, Telegram delivery and idempotent completion.
5. Public safe pet card and PDF sitter card.
6. Free/Plus entitlements and contextual paywall.
7. Telegram Stars subscription, webhook processing and reconciliation.
8. Settings, privacy, export/delete, support and legal pages.
9. Hardening: RLS/IDOR, observability, performance, accessibility, runbook.

## Non-Negotiables

- Never trust `Telegram.WebApp.initDataUnsafe`; validate raw `initData` on server.
- Never expose Supabase service/secret keys to the browser.
- Never serialize private pet fields into public card HTML/API.
- Every retryable state-changing command needs idempotency.
- Reminder, callback and payment webhooks are at-least-once delivery.
- Client payment callbacks never activate entitlement by themselves.
- Free limits must be enforced server-side.
- Public-card fields must be explicit whitelist projection.
- Browser/demo mode cannot gain production privileges via `?qa=1`.

## Current Safe Increment

This repository can ship RC1 foundation before full storage/payment rollout:

- visible product entry aligned to "Псё помнит";
- feature flags and env documentation;
- read-only entitlement snapshot with billing disabled;
- internal health endpoint;
- legal/support placeholders that do not claim final approval;
- QA guard that prevents pretending Stars/reminder production readiness.

Everything beyond that must be implemented in reviewable stages with migrations,
tests, release notes and deploy proof.
