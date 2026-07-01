# Псё RC1 — DoR / swarm breakdown

Дата: 2026-06-25

## Концепция

Псё RC1 — Telegram-first care loop для владельца собаки:

```text
открыл Mini App
-> создал питомца
-> поставил первое полезное напоминание
-> получил его в Telegram
-> отметил выполнение
-> увидел историю
-> понял контекстный лимит
-> перешёл в Псё Плюс через Stars
```

Псё не должен выглядеть как анкета, магазин, вет-CRM или AI-чат. Первый экран — это живой центр собаки: статус, ближайший шаг, память ухода и поддерживающие системы.

## DoR slices

### 1. RC1 Foundation / Product Entry

Ready when:
- `IMPLEMENTATION.md` лежит в репозитории и связан с правилами проекта.
- Feature flags и `.env.example` отражают billing/reminder gates.
- `/api/internal/health`, legal/support и entitlements skeleton отвечают.
- UI не обещает production billing/reminders.
- QA guard ловит технические статусы и не-human copy на главном экране.

### 2. Telegram Identity

Ready when:
- Сервер валидирует raw Telegram `initData`.
- `initDataUnsafe` не используется как доверенный источник.
- Browser/demo mode не получает production-привилегии.
- Session/auth smoke покрывает happy/error path.

### 3. Pet Onboarding + First Reminder

Ready when:
- Пользователь создаёт питомца за 1-2 минуты.
- После создания сразу предлагается первое напоминание.
- Минимум полей не превращается в длинную анкету.
- Server persistence, RLS/IDOR и owner-bound access проверены.

### 4. Today Care Hub

Ready when:
- First viewport показывает dog status card, один next best care action и быстрые плитки.
- Визуальный язык соответствует `DESIGN_DIRECTION.md`: Living Companion OS, cream/mint, soft care.
- Есть loading/empty/content/error/permission states.
- Mobile screenshot 390px проходит без overlap и технических строк.

### 5. Reminder Delivery Loop

Ready when:
- Reminder jobs доставляют уведомления в Telegram.
- Completion/snooze идемпотентны.
- Повторные webhook/callback события безопасны.
- Выполнение создаёт событие истории.

### 6. Care History

Ready when:
- Выполненные напоминания сохраняются как care events.
- Today/Profile показывают историю в рамках free лимита.
- UI не обещает full medical history без отдельной модели и политики.

### 7. Public Safe Dog Card

Ready when:
- Public card строится только из explicit whitelist.
- Не публикуются точный адрес, телефон владельца, precise geo, chip, vet clinic, полная медистория.
- Share/print route проверен privacy QA.

### 8. Entitlements + Contextual Paywall

Ready when:
- Free limits enforced server-side.
- UI читает entitlement snapshot, но не активирует Plus сам.
- Paywall появляется только у понятного ограничения.
- Billing остаётся disabled до owner/legal release gate.

### 9. Telegram Stars Billing

Ready when:
- Утверждены price, terms, support, bot token, webhook secret.
- Client payment callback не активирует entitlement без server reconciliation.
- Refund/expiration/subscription states описаны и покрыты.
- At-least-once delivery обработан идемпотентно.

### 10. Release Hardening

Ready when:
- RLS/IDOR, observability, performance, accessibility прошли.
- Есть backup/restore и release runbook.
- Regression QA покрывает auth, reminders, entitlements, public privacy, mobile UI.

## Today first viewport contract

First viewport must include:
- Brand/header: `Псё`, active pet context, profile/settings access.
- Dog status card: name, state/context, short companion copy.
- Primary next step: exactly one main action.
- Quick actions: reminder, passport/context, share/care participation.
- No BFF/backend/readiness/internal states.
- No raw enums, long breed dumps, fake history, or billing promises.

Supporting content below first viewport:
- RC1 loop progress.
- Care history proof.
- Map/passport/assistant teasers.
- Contextual Plus gate with billing disabled unless release gates are satisfied.

## Current production scope

Current production is a deployable RC1 visual/product foundation, not full RC1:
- Today first viewport follows Living Companion OS.
- First reminder and local guest mode exist.
- Health/entitlements skeleton exists.
- Billing, Telegram reminder delivery, real Plus activation and durable reminder jobs remain gated.
