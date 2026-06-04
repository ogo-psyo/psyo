# Псё Top App Prep Pack

Дата: 2026-05-08

Цель: подготовить продукт, дизайн, аналитику, инфраструктуру и release gates перед реализацией следующего большого slice: **avatar-first emotional entry → digital dog world**.

## Главная рамка

Псё — не pet CRM. Псё — цифровой мир собаки:

1. **Avatar / Identity** — эндорфин, герой, карточка, sharing.
2. **Care OS** — Today, уход, напоминания, безопасный ассистент.
3. **World Map** — места, риски, клиники, новый район.
4. **Social** — друзья-собаки, совместимость, безопасные знакомства.
5. **Commerce / Partners** — клиники, магазины, товары как продолжение заботы.

## Файлы

- `01-product-prd.md` — PRD большого направления.
- `02-event-taxonomy.md` — события аналитики и свойства.
- `03-tools-setup-checklist.md` — какие инструменты нужны и как подключать без хаоса.
- `04-data-model.md` — новые сущности и связи.
- `05-avatar-pipeline-spec.md` — avatar generation/job/storage pipeline.
- `06-mobile-appstore-plan.md` — PWA → Capacitor/TestFlight → later native.
- `07-world-places-curation.md` — карта, места, клиники, trust levels.
- `08-safety-qa-release.md` — privacy/medical/moderation/release gates.
- `09-implementation-backlog.md` — порядок работ и задачи.
- `supabase/migrations/20260508100000_topapp_preparation_schema.sql` — draft schema для будущих сущностей.

## Не сделано намеренно

- Не подключены внешние платные сервисы.
- Не созданы аккаунты в PostHog/Sentry/Mapbox/App Store Connect.
- Не применялась новая Supabase migration.
- Не менялся runtime приложения.

Это подготовка перед реализацией, а не внешний запуск.
