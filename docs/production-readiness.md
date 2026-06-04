# Псё — production readiness snapshot

## Current scope

Рабочий local-first продукт:

- photo-derived avatar render;
- публичная avatar card;
- паспорт собаки;
- характер / привычки;
- care-профиль;
- privacy-safe карта района;
- local persistence без сохранения фото в localStorage.

## Production boundaries

Сейчас это client-only product shell. Для настоящего production нужны:

1. Supabase/Postgres auth + profiles.
2. Object storage для фото-референсов.
3. Публичные dog-card URLs.
4. Privacy model для карты: approximate area, ручной район, no exact address by default.
5. AI/avatar pipeline как отдельный async job, не blocking UI.
6. Moderation/reporting для public cards и nearby dogs.

## Verification gate

Current local gate:

```bash
npm run build
```

Smoke strings:

- `Создай отдельный цифровой образ собаки`
- `Паспорт собаки`
- `Привычки и характер`
- `Здоровье, уход, вет`
- `PSЁ AVATAR CARD`

## Deployment gate

Do not deploy to Vercel until Руслан explicitly confirms:

- whether this should replace existing `vercel-site` or be a separate Vercel project;
- public name/domain;
- whether any sample photos are allowed in repository or demo.
