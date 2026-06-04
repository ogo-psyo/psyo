# Backend roadmap — Псё

## Current status

Сейчас продукт — интерактивный frontend MVP:

- UI приложения уже показывает сценарии: Сегодня / Паспорт / Ассистент / Карта / Вишлист;
- профиль хранится локально в браузере;
- avatar generation endpoint уже есть, но требует `OPENAI_API_KEY`;
- реальной авторизации, базы, storage, notification jobs и интеграций пока нет.

## Target backend shape

Рекомендуемый стек для быстрого MVP:

- **Next.js API routes** — BFF/API layer;
- **Supabase Auth** — email/social login;
- **Supabase Postgres** — пользователи, питомцы, паспортички, напоминания, зоны, wishlist;
- **Supabase Storage** — фото питомцев, документы, avatar renders;
- **Vercel Cron** — ежедневная проверка напоминаний;
- **OpenAI / другой LLM** — ассистент с контекстом профиля;
- **PostHog/Vercel Analytics** — продуктовая аналитика;
- Later: Mapbox/Яндекс/Google Maps, партнёрские API клиник/ветшопов.

## Core entities

Контракт уже заложен в `lib/domain.ts`:

- `AppUser`
- `Pet`
- `PetPassport`
- `SocialProfile`
- `Reminder`
- `MapZone`
- `WishlistItem`
- `AssistantThread`
- `AppBootstrap`

## API contracts added

Demo endpoints added as backend placeholders:

- `GET /api/app/bootstrap` — собирает стартовое состояние приложения;
- `GET/POST /api/reminders` — контракт напоминаний;
- `GET/POST /api/wishlist` — контракт вишлиста;
- `POST /api/assistant` — контракт ассистента;
- existing `POST /api/avatar/generate` — генерация аватара по фото/prompt.

Эти endpoints пока demo-mode, без базы. Они нужны, чтобы frontend и backend развивались по одному контракту.

## MVP backend phases

### Phase 1 — Real persistence

Цель: пользователь не теряет данные между устройствами.

- Подключить Supabase project.
- Добавить env:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` только server-side.
- Создать таблицы:
  - `profiles`
  - `pets`
  - `pet_passports`
  - `social_profiles`
  - `reminders`
  - `map_zones`
  - `wishlist_items`
  - `assistant_threads`
  - `assistant_messages`
- Row Level Security: владелец видит только своих питомцев; share links — ограниченное публичное представление.

Acceptance:

- регистрация/логин;
- создать питомца;
- сохранить паспортичку;
- обновить с другого устройства.

### Phase 2 — Photos and avatar pipeline

Цель: нормальная работа с фото и avatar hook.

- Фото загружаются в Supabase Storage.
- Avatar render сохраняется как asset, а не data URL.
- Генерация идёт через server API.
- Ограничить размер, типы файлов, rate limit.

Acceptance:

- загрузка фото;
- генерация аватара;
- публичная карточка показывает avatar URL.

### Phase 3 — Reminders engine

Цель: удержание.

- CRUD напоминаний.
- Шаблоны: вакцинация, обработка, корм, груминг, лекарства, тренировка.
- Vercel Cron ежедневно проверяет due reminders.
- Каналы уведомлений: сначала in-app; позже email/Telegram/push.

Acceptance:

- создать напоминание;
- увидеть “сегодня важно”;
- отметить done/snooze.

### Phase 4 — Assistant v1

Цель: главный продуктовый слой.

- LLM получает структурированный контекст питомца.
- Safety system prompt: no diagnosis; triage; red flags; recommend vet/trainer when needed.
- Сценарии:
  - воспитание;
  - уход;
  - health triage;
  - покупки;
  - подготовка к поездке/ветклинике.
- Assistant может предложить создать reminder или wishlist item.

Acceptance:

- задать вопрос;
- получить ответ с учётом паспортички;
- предложение действия: reminder/wishlist.

### Phase 5 — Map and zones

Цель: карта как safety/social layer.

- Хранить approximate zones, не точный GPS.
- Safe places / risk zones / clinics / shops.
- Nearby dogs only with consent and rough area.
- Moderation/reporting for public zones.

Acceptance:

- создать домашнюю зону;
- добавить риск/место;
- включить/выключить публичность.

### Phase 6 — Clinics, vetshops, collections, wishlists

Цель: полезная монетизация.

- Wishlist CRUD.
- “Купить снова”.
- Подборки под профиль собаки.
- Партнёрские карточки должны объяснять why relevant.
- Не превращать home screen в рекламу.

Acceptance:

- создать wishlist item;
- ассистент добавляет item после рекомендации;
- подборки фильтруются по размеру/возрасту/аллергиям.

## What blocks real backend now

Нужны решения/доступы:

1. Supabase project создавать новый или использовать существующий?
2. Какие login methods: email magic link, Google/Apple, Telegram?
3. Какой LLM provider для ассистента и avatar generation?
4. Уведомления сначала in-app или сразу Telegram/email/push?
5. Карта: Mapbox / Google / Яндекс / mock до проверки?

## Recommendation

Следующий практический шаг: **Phase 1 + Phase 3 together**.

Почему:

- база без напоминаний не даёт retention;
- напоминания без базы не работают между устройствами;
- это быстрее и полезнее, чем сразу сложная карта или marketplace.

Мини-спринт:

1. Supabase schema + RLS.
2. Auth.
3. Persist pet/passport/social profile.
4. Reminder CRUD.
5. Home screen читает `/api/app/bootstrap` из базы.

