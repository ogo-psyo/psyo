# Псё: текущая кодовая база и полный PRD продукта

Дата: 2026-06-29  
Статус документа: продуктово-инженерный бриф для дальнейшей разработки, не только MVP.  
Production alias: `https://pso-mvp-uglanovrms-projects.vercel.app`

## 1. Назначение документа

Этот MD фиксирует две вещи:

1. Что уже есть в текущей кодовой базе `pso-mvp`: архитектура, экраны, модели, API, QA-гейты и ограничения.
2. Каким должен быть широкий продуктовый scope Псё как полноценного цифрового инструмента для владельцев собак: профиль, care-loop, публичная карточка, социализация, карта, AI-ассистент, wishlist и B2B-интеграции.

Документ намеренно разделяет **фактическое состояние кода** и **целевой продукт**. Это важно: UI не должен обещать пользователю готовность тех слоёв, которые ещё не имеют persistence, privacy, moderation, delivery или QA.

## 2. Короткое описание продукта

Псё — mobile-first Telegram Mini App / web companion для владельца собаки. Продукт объединяет:

- живой профиль собаки;
- напоминания и трекер ухода;
- историю и визуализацию прогресса;
- публичную карточку собаки в цепляющем, виральном формате;
- сервис социализации и совместных прогулок;
- личную и публичную карту собачьего цикла;
- AI-ассистента по уходу, который знает контекст профиля;
- wishlist и партнёрские интеграции с ветклиниками, кормами, аксессуарами, грумингом и сервисами.

Главная продуктовая идея: **собака как живой центр заботы**, а не анкета, CRM, магазин или чат-бот. Пользователь должен быстро понять: что важно сегодня, что уже сделано, что нужно сделать дальше, с кем можно гулять, где безопасно, что купить/проверить и как поделиться профилем собаки с людьми вокруг.

## 3. Текущая кодовая база

### 3.1 Стек

- Framework: Next.js 16, App Router.
- UI: React 19, TypeScript, client-heavy shell в `app/page.tsx`.
- Styling: глобальная CSS-система в `app/globals.css`.
- Backend: Next route handlers в `app/api/*`.
- Auth/session: Supabase Auth, Telegram Mini App session cookie, подготовленный слой Better Auth за флагом.
- Data: Supabase Postgres + RLS, guest fallback через `localStorage`.
- Map: Leaflet через `components/LiveMap.tsx`.
- Deployment: Vercel production.
- QA: `npm run qa:local` + набор контрактных проверок в `scripts/qa`.

### 3.2 Основные директории

| Путь | Роль |
|---|---|
| `app/page.tsx` | Главный клиентский shell: onboarding, Today, Assistant, Socialization, Map, Calendar, Profile. |
| `app/globals.css` | Визуальный язык, mobile shell, responsive rules, стили вкладок и карточек. |
| `app/api/*` | BFF/API: bootstrap, pets, reminders, wishlist, zones, assistant, avatar, auth, Telegram. |
| `app/dog/[slug]/page.tsx` | Публичная карточка собаки через query params / share route. |
| `components/GeneratedAvatar.tsx` | Визуальный аватар собаки. |
| `components/LiveMap.tsx` | Карта и примерные зоны. |
| `components/watercolor.tsx` | UI primitives для экранов. |
| `lib/data.ts` | Клиентская модель профиля, каталог пород, опции, defaults. |
| `lib/domain.ts` | Domain types: Pet, Passport, SocialProfile, Reminder, MapZone, WishlistItem, AssistantThread. |
| `lib/copy.ts` | Human-copy форматтеры, защита от raw enum/status labels. |
| `lib/readiness.ts` | Модель readiness для внутренних/QA состояний. |
| `lib/server/*` | Supabase, auth, app session, Telegram owner, Better Auth helpers. |
| `packages/contracts/index.ts` | Shared DTO/problem contracts для v1/BFF. |
| `supabase/schema.sql` и `supabase/migrations/*` | DB schema, RLS, migrations. |
| `scripts/qa/*` | Contract checks и smoke scripts. |
| `docs/*` | HLD, DoR, release runbook, audit, product notes. |

### 3.3 Текущие экраны

#### Onboarding

Файлы: `app/page.tsx`, `lib/data.ts`, `lib/profileStorage.ts`.

Сейчас:
- ввод имени;
- загрузка фото;
- выбор визуального стиля;
- demo mode;
- создание локального guest pet id;
- переход в Today.

Ограничения:
- onboarding ещё не полноценный multi-step product activation с измерением funnel;
- фото может оставаться локальным, если upload/storage выключены;
- Telegram-first создание owner/pet зависит от auth/session состояния.

#### Today

Файлы: `app/page.tsx`, `lib/copy.ts`, `lib/readiness.ts`.

Сейчас:
- hero card собаки;
- ближайший шаг;
- быстрые действия: профиль/карта/ассистент;
- care history;
- contextual Plus gate;
- поддержка reminders и profile completion.

Ограничения:
- Today engine пока простой: нет полноценного приоритизатора care/safety/social/context;
- нет визуальной аналитики прогресса за недели/месяцы;
- Telegram reminder delivery ещё не полноценный production loop.

#### Calendar / Care Plan

Файлы: `app/page.tsx`, `app/api/reminders/*`, `supabase/schema.sql`.

Сейчас:
- календарная сетка;
- активные/выполненные дела;
- CRUD-ish reminders;
- complete/snooze/delete/edit;
- экспорт дела в `.ics`;
- guest mode и Supabase mode.

Ограничения:
- recurrence есть в модели, но не раскрыта как полноценный scheduler;
- нет фоновых jobs для доставки;
- care events/history частично завязаны на reminders, а не на отдельную полноценную timeline model;
- нет визуализации прогресса по категориям ухода.

#### Profile / Passport

Файлы: `app/page.tsx`, `lib/data.ts`, `app/api/pets/route.ts`, `lib/server/profileService.ts`.

Сейчас:
- имя, порода, возраст/стадия, размер, пол, вес;
- health/passport fields: microchip, vet clinic, diet, allergies, medication, health notes, vaccine/parasite status;
- social fields: temperament, energy, play style, trainability, friendliness, triggers, alone time;
- avatar/photo fields;
- profile completion ring.

Ограничения:
- multi-pet пока не оформлен как полноценный UX;
- нет rich medical document storage;
- нет caregiver/family access;
- приватность полей публичной карточки требует строгого allowlist.

#### Public Dog Card

Файлы: `app/dog/[slug]/page.tsx`, `app/dog/[slug]/DogCardActions.tsx`, `app/page.tsx`.

Сейчас:
- публичная карточка через query params;
- humanized display для social modes;
- правила контакта;
- шаринг.

Ограничения:
- public card ещё не полноценная backend-backed entity;
- нет publish/unpublish lifecycle;
- нет analytics virality loop;
- нужен строгий privacy allowlist для любых публичных данных;
- нет набора визуальных шаблонов/форматов как stable product surface.

#### Socialization

Файлы: `app/page.tsx`, `app/globals.css`, `scripts/qa/check-ux-surface-contract.mjs`.

Сейчас:
- вкладка `Социализация`;
- карточки собак;
- теги;
- совместимость;
- правила знакомства;
- действия `Пропустить` / `Интересно`;
- QA-гейт запрещает в этом блоке `readiness`, `status`, `PNG`, `export`, `download`, raw enum tokens.

Ограничения:
- deck пока локальный/mock, не real matching service;
- нет профилей других владельцев из backend;
- нет consent, moderation, blocking/reporting;
- нет гео/радиуса, availability, групповых прогулок;
- нет messaging/contact handoff.

#### Map

Файлы: `components/LiveMap.tsx`, `app/page.tsx`, `app/api/zones/*`, `lib/domain.ts`.

Сейчас:
- Leaflet map;
- личные зоны: safe place, risk zone, clinic, shop, grooming, walk route;
- approximate lat/lng + radius;
- CRUD-ish zones;
- guest и Supabase режимы.

Ограничения:
- нет публичного слоя community map;
- нет moderation и доверия к публичным отметкам;
- нет routing/trails;
- нет pet-friendly catalog provider;
- нет privacy controls для точности гео.

#### Assistant

Файлы: `app/api/assistant/route.ts`, `app/page.tsx`, `supabase/schema.sql`.

Сейчас:
- UI вопроса;
- context-aware rules answer;
- health/training/care/shopping/general classifier;
- safety baseline: не ставить диагнозы, не назначать лекарства, красные флаги к ветеринару;
- optional Pollinations provider behind flag;
- persistence assistant threads/messages при authenticated petId.

Ограничения:
- ответы пока не связаны с action engine;
- нет long-term assistant memory per pet beyond thread inserts;
- нет tool calls для создания reminders/wishlist/map events из ответа;
- нет vet-grade triage protocol;
- AI provider не должен быть включён без QA/safety release gate.

#### Wishlist / Shop

Файлы: `app/page.tsx`, `app/api/wishlist/*`, `supabase/schema.sql`.

Сейчас:
- wishlist items: title, category, reason, url, priority, status;
- suggestions from profile context;
- owner-scoped API;
- guest fallback.

Ограничения:
- нет marketplace/catalog;
- нет partner attribution;
- нет commerce trust model;
- нет subscriptions/rebuy;
- нет интеграций с клиниками, кормами, аксессуарами;
- нет разграничения editorial recommendation vs paid placement.

### 3.4 Data model сейчас

Фактические core entities:

- `profiles`
- `telegram_identities`
- `pets`
- `pet_passports`
- `social_profiles`
- `reminders`
- `map_zones`
- `wishlist_items`
- `assistant_threads`
- `assistant_messages`

Дополнительно в migrations присутствуют заделы под:

- reminder events / hardening;
- avatar/preparation jobs;
- subscriptions/entitlements;
- topapp preparation;
- Better Auth tables: `user`, `session`, `account`, `verification`.

### 3.5 API inventory сейчас

| Endpoint | Назначение | Статус |
|---|---|---|
| `GET /api/app/bootstrap` | Собрать user/pet/passport/social/reminders/zones/wishlist для app shell. | Реализован, owner-bound. |
| `POST /api/pets` | Создать/обновить pet profile + passport/social. | Реализован. |
| `GET/POST /api/reminders` | Список/создание reminders. | Реализован. |
| `PATCH/DELETE /api/reminders/[id]` | Редактирование/удаление reminder. | Реализован. |
| `POST /api/reminders/[id]/complete` | Отметить дело выполненным. | Реализован. |
| `POST /api/reminders/[id]/snooze` | Отложить дело. | Реализован. |
| `GET/POST /api/zones` | Личные map zones. | Реализован. |
| `PATCH/DELETE /api/zones/[id]` | Обновить/удалить zone. | Реализован. |
| `GET/POST /api/wishlist` | Wishlist items. | Реализован. |
| `PATCH/DELETE /api/wishlist/[id]` | Обновить/удалить wishlist item. | Реализован. |
| `POST /api/assistant` | Context-aware assistant answer. | Реализован с safety/rules mode. |
| `POST /api/avatar/generate` | Avatar generation/fallback. | Есть, gated. |
| `POST /api/avatar/upload` | Upload photo. | Есть, gated. |
| `POST /api/telegram/session` и `/api/v1/session/telegram` | Telegram initData/session. | Реализовано. |
| `/api/auth/[...all]` | Better Auth handler. | Подготовлен, gated DB URL. |
| `GET /api/internal/health` | Health/env flags. | Реализован. |
| `GET /api/billing/entitlements` | Entitlements skeleton. | Реализован, billing gated. |

### 3.6 QA и release gates

Основная команда:

```bash
npm run qa:local
```

Состав:

- `next build`;
- env contract;
- auth redirect source;
- readiness contract;
- v1 BFF contract;
- RC1 foundation;
- design concept contract;
- prod risk gates;
- UX surface contract;
- human copy contract.

Ключевые guardrails:

- raw enum/status labels не должны выходить в UI;
- technical readiness/service labels не должны торчать в пользовательских экранах;
- Today first viewport должен оставаться product-centric;
- Socialization tab не должен снова стать export/status/PNG/tech screen.

### 3.7 Текущие основные ограничения

- Полноценный Better Auth слой не включён без direct Postgres URL.
- Telegram reminder delivery loop ещё не production-complete.
- Public card не backend-backed с publish/unpublish lifecycle.
- Socialization/deck пока mock/local, не real matching service.
- Public/community map отсутствует.
- Partner integrations отсутствуют.
- Plus/billing/Stars закрыты release gate.
- AI provider должен оставаться под safety/QA флагом.

## 4. PRD: полноценный Псё

### 4.1 Summary

Псё должен стать ежедневным цифровым инструментом владельца собаки: один живой центр, где собран профиль собаки, забота, история, социализация, карта, рекомендации, покупки и безопасный AI-контекст.

Продукт не должен быть “ещё одной анкетой” или “чатом с советами”. Его ценность — в связке:

```text
профиль собаки
-> персональный care-loop
-> история и прогресс
-> публичная карточка
-> социализация и прогулки
-> карта мира вокруг собаки
-> AI и партнёрские действия в контексте
```

### 4.2 Problem Statement

Владельцу собаки сложно держать в голове:

- даты обработок, вакцин, груминга, корма, визитов;
- особенности поведения, триггеры, правила знакомства;
- историю ухода и прогресс;
- безопасные/опасные места рядом;
- кому и как объяснить, как обращаться с собакой;
- с кем можно гулять и социализироваться;
- какие товары/сервисы действительно нужны конкретной собаке;
- как задавать вопросы AI так, чтобы он учитывал реальный контекст.

Сейчас эти данные размазаны между заметками, календарём, чатами, памятью владельца, ветеринарными документами, картами, маркетплейсами и случайными советами. Псё собирает это в один dog-centered tool.

### 4.3 Product Principles

- Собака в центре, сервисы вокруг.
- Mobile-first и Telegram-first.
- Один следующий полезный шаг важнее десяти карточек.
- Пользовательский UI не показывает внутреннюю техническую кухню.
- Приватность по умолчанию: точный адрес, телефон, microchip, ветданные и точная гео не публикуются.
- AI не ставит диагнозы и не заменяет ветеринара/кинолога.
- Коммерция должна быть объяснимой: почему рекомендация появилась и является ли она партнёрской.
- Социализация строится на consent, safety и совместимости, а не на случайном “лайк/матч”.

### 4.4 Users / Actors

#### Primary users

- Владелец одной собаки.
- Владелец нескольких собак.
- Новичок, который плохо понимает регулярный care-cycle.
- Опытный владелец, которому важны история, точность и удобство.
- Владелец тревожной/реактивной/особенной собаки.

#### Secondary users

- Член семьи / co-owner.
- Dog sitter / друг на прогулке.
- Кинолог / тренер.
- Ветеринар / ветклиника.
- Грумер.
- Владельцы собак рядом для прогулок.

#### Business / integration actors

- Ветклиники.
- Производители корма.
- Магазины аксессуаров.
- Сервисы груминга.
- Догситтеры/выгульщики.
- Страховые/health plans, если появятся.

### 4.5 Goals / Success Criteria

#### Activation

- Пользователь создаёт профиль собаки за 1-2 минуты.
- В первый session пользователь ставит первое reminder/care action.
- Пользователь понимает, зачем возвращаться завтра/через неделю.

#### Retention

- У пользователя появляется регулярный care-loop: reminders, completion, history.
- Псё показывает прогресс и историю без ощущения “надо заполнять CRM”.
- Возврат происходит через Telegram reminders, assistant prompts, social/map events.

#### Sharing / Growth

- Публичная карточка выглядит достаточно цепляюще, чтобы её хотелось отправить.
- Карточка безопасно объясняет другим людям, как контактировать с собакой.
- У карточки есть viral loop: получатель может создать свою карточку.

#### Socialization

- Пользователь находит совместимых собак/владельцев для прогулок.
- Матч строится на правилах знакомства, триггерах, энергии, размере, районе и целях.
- Есть безопасный путь от интереса к совместной прогулке.

#### Map

- Владелец видит личные места: маршруты, тихие зоны, риски, клиники, магазины.
- Публичный слой помогает находить pet-friendly места и сигналы сообщества.
- Точная гео не раскрывается без явного consent.

#### AI

- AI отвечает с учётом профиля, истории, reminders, триггеров, wishlist и мест.
- AI умеет превращать ответ в action: reminder, wishlist item, map note, profile update suggestion.
- Health/safety ответы не нарушают ветеринарные границы.

#### Commerce / Integrations

- Wishlist превращается в контекстный слой рекомендаций.
- Партнёрские предложения не ломают доверие.
- Ветклиники/корма/аксессуары интегрируются как полезные действия вокруг care-cycle.

### 4.6 Non-Goals

- Не строить ветдиагностику вместо врача.
- Не делать marketplace первым экраном.
- Не публиковать чувствительные данные без явного allowlist.
- Не делать social dating без moderation/block/report/consent.
- Не подменять owner judgement автоматическими AI-решениями.
- Не обещать production billing, reminders или AI, пока нет release evidence.

## 5. Product Scope

### 5.1 Профиль собаки и паспорт

#### Ценность

Профиль — источник контекста для всех остальных слоёв: reminders, AI, карта, социализация, публичная карточка, wishlist и партнёрские рекомендации.

#### Требования

- Поддержка нескольких собак.
- Identity: имя, фото, аватар, порода/тип, возраст, размер, вес, пол, стерилизация.
- Health/passport: вакцины, обработки, лекарства, аллергии, питание, ветклиника, заметки, документы.
- Behavior/social: энергия, темперамент, trainability, play style, friendliness, triggers, alone time, правила знакомства.
- Privacy controls per field:
  - private only;
  - visible to family/caregiver;
  - visible on public card;
  - usable for matching without direct display.
- Profile completeness не как “анкета”, а как мягкая подсказка следующего полезного шага.

#### Acceptance Criteria

- Пользователь может создать минимальный профиль без длинной анкеты.
- Все raw enums в UI форматируются человеческим русским copy.
- Public card получает только allowlisted поля.
- AI получает контекст без раскрытия приватных полей наружу.

### 5.2 Напоминания, трекер и визуализация прогресса

#### Ценность

Псё должен стать памятью ухода: что сделать, что сделано, как меняется ритм заботы.

#### Требования

- Reminder types:
  - вакцина;
  - обработка от паразитов;
  - лекарства;
  - груминг;
  - корм;
  - тренировка;
  - ветеринар;
  - кастомное дело.
- Recurrence:
  - one-off;
  - daily/weekly/monthly/quarterly/yearly;
  - flexible intervals;
  - templates by dog profile.
- Actions:
  - complete;
  - snooze;
  - reschedule;
  - skip with reason;
  - add note/photo/document.
- Care history:
  - timeline;
  - category filters;
  - streaks without guilt mechanics;
  - progress by category;
  - upcoming risk markers.
- Visualization:
  - weekly/monthly care rhythm;
  - completion rate;
  - overdue load;
  - protection status;
  - training/calmness observations;
  - age/weight trends later.
- Telegram delivery:
  - reminder notification;
  - complete/snooze from Telegram;
  - idempotent callbacks;
  - timezone handling;
  - quiet hours.

#### Acceptance Criteria

- Reminder lifecycle works end-to-end: create -> deliver -> complete/snooze -> history.
- Completion creates durable care event.
- Visual progress never shames user; it suggests the next useful action.
- Telegram retries are idempotent.

### 5.3 Публичная карточка собаки

#### Ценность

Карточка нужна для шаринга, прогулок, догситтера, грумера, друзей, социализации и роста продукта.

#### Требования

- Backend-backed `PublicDogCard` entity.
- Publish/unpublish.
- Safe allowlist:
  - имя;
  - фото/аватар;
  - порода/тип;
  - характер;
  - правила контакта;
  - триггеры в мягком формате;
  - район на уровне “примерно”, если разрешено;
  - ссылку на Псё.
- Strictly private:
  - exact address;
  - phone unless explicitly enabled;
  - microchip;
  - vet contact;
  - full health history;
  - precise location;
  - owner id/session data.
- Визуальные форматы:
  - прогулочная карточка;
  - “как со мной знакомиться”;
  - story/post/poster;
  - кинологический safe profile;
  - premium kennel / club style.
- Viral loop:
  - “создать карточку своей собаки”;
  - preview before publish;
  - share to Telegram;
  - image/meta tags for rich previews.

#### Acceptance Criteria

- Public route не может раскрыть приватное поле.
- Любой public share можно выключить.
- Карточка понятна незнакомому человеку за 5 секунд.
- Карточка выглядит как продуктовая фича, не как экспортный техно-конструктор.

### 5.4 Социализация и совместные прогулки

#### Ценность

Собакам и владельцам нужны не абстрактные лайки, а безопасные совместимые контакты: по темпераменту, энергии, размеру, району, триггерам и правилам знакомства.

#### Требования

- Social profile:
  - цели: прогулка, игра, спокойная параллельная прогулка, тренировка, puppy socialization;
  - availability;
  - район/радиус;
  - правила контакта;
  - triggers;
  - preferred dog size/energy;
  - known limitations.
- Matching:
  - compatibility score with explanation;
  - safety warnings;
  - owner-controlled visibility;
  - no exact location by default.
- UX:
  - swipe deck;
  - profile cards;
  - “Пропустить” / “Интересно”;
  - saved candidates;
  - invite to walk;
  - first-walk safety checklist.
- Trust & Safety:
  - report/block;
  - moderation queue;
  - consent before chat/contact;
  - anti-spam/rate limit;
  - underage/unsafe content policy if needed.

#### Acceptance Criteria

- Socialization screen never shows raw service statuses or enums.
- Пользователь понимает, почему матч подходит или не подходит.
- Нельзя открыть точную гео другого владельца без consent.
- Есть безопасный fallback: параллельная прогулка, дистанция, stop rules.

### 5.5 Карта: личный и публичный слой

#### Ценность

Карта должна отвечать не “где я”, а “что вокруг важно для собачьего цикла”.

#### Личный слой

- Домашняя зона.
- Любимые маршруты.
- Тихие места.
- Риск-зоны:
  - самокаты;
  - шумные перекрёстки;
  - агрессивные собаки;
  - стекло/мусор;
  - перегрев/лед/реагенты.
- Ветклиники.
- Груминг.
- Зоомагазины.
- Pet-friendly места.
- Notes per dog.

#### Публичный слой

- Community-submitted places.
- Pet-friendly venues.
- Verified clinics/shops.
- Temporary alerts.
- Route recommendations.
- Ratings/labels, but with moderation and abuse controls.

#### Privacy

- Approximate location by default.
- Precision levels:
  - hidden;
  - neighborhood;
  - approximate radius;
  - exact only for private owner use.
- Public submissions decoupled from owner exact identity where possible.

#### Acceptance Criteria

- Личная карта работает без раскрытия публичного местоположения.
- Публичные места проходят moderation/trust layer.
- AI и reminders могут ссылаться на места, но не раскрывают точные координаты.

### 5.6 AI-ассистент

#### Ценность

AI должен быть не “общим чатиком про собак”, а контекстным помощником:

- знает профиль;
- видит ближайшие reminders;
- учитывает историю;
- понимает триггеры;
- может предложить action;
- соблюдает health/safety boundaries.

#### Режимы

- Care loop: что сделать сегодня/на неделе.
- Health triage без диагноза.
- Behavior/training guidance.
- Socialization prep.
- Shopping/wishlist reasoning.
- Map-aware walk planning.
- Caregiver handoff: что сказать догситтеру.

#### Requirements

- Context builder:
  - profile summary;
  - health/social snapshot;
  - active reminders;
  - recent care events;
  - map context;
  - wishlist;
  - user question.
- Safety policy:
  - no diagnosis;
  - no medication prescription;
  - red flags -> vet urgent;
  - uncertainty admission;
  - no invented profile facts.
- Action engine:
  - create reminder;
  - add wishlist item;
  - draft public card text;
  - suggest profile field update;
  - save observation;
  - add map note.
- Memory:
  - assistant threads;
  - per-pet summaries;
  - owner-approved durable facts.

#### Acceptance Criteria

- AI answer cites the profile facts it used in human language.
- Any high-risk health answer contains escalation guidance.
- Any action requires confirmation before writing.
- AI cannot leak private profile data into public card/social/map without explicit user action.

### 5.7 Wishlist и интеграции

#### Ценность

Wishlist — мост между “что собаке нужно” и “где это купить/получить”, но без превращения Псё в рекламный мусор.

#### Wishlist requirements

- Manual wishlist.
- AI-suggested wishlist from context.
- Rebuy reminders:
  - корм;
  - обработка;
  - лекарства;
  - расходники;
  - grooming supplies.
- Categories:
  - food;
  - treats;
  - toys;
  - gear;
  - health;
  - grooming;
  - courses;
  - services.
- Item states:
  - wanted;
  - bought;
  - not suitable;
  - recurring;
  - partner offer available.
- Explanation:
  - why suggested;
  - based on which profile facts;
  - partner/paid label if applicable.

#### Partner integrations

- Ветклиники:
  - appointment booking links;
  - vaccine/reminder templates;
  - clinic profile;
  - verified badge.
- Производители корма:
  - feeding plan;
  - rebuy cycle;
  - intolerance/allergy warnings;
  - sampling/coupon offers.
- Аксессуары:
  - size-aware recommendations;
  - safety gear;
  - seasonal items.
- Груминг:
  - breed/coat-based schedule;
  - booking link;
  - before/after notes.
- Dog services:
  - dog sitter;
  - walker;
  - trainer;
  - daycare.

#### Trust requirements

- Paid placement label.
- No hidden health claims.
- No recommendations contradicting allergies/health notes.
- User can dismiss/suppress categories.
- Partner data cannot write into pet profile without consent.

### 5.8 Monetization / Plus

Potential paid value:

- multi-pet;
- long care history;
- family/caregiver access;
- advanced visualizations;
- reminder delivery and smart schedules;
- premium public card templates;
- socialization boosts with safety constraints;
- AI action history;
- partner discounts;
- export/print/PDF;
- vet/groomer handoff packs.

Billing must remain behind release gate until:

- pricing is approved;
- terms/support are ready;
- payment reconciliation is server-side;
- refund/expiration states exist;
- entitlement checks are enforced server-side.

## 6. Information Architecture

### Primary navigation

1. Сегодня
2. План заботы
3. Профиль
4. Социализация
5. Карта
6. Ассистент
7. Вещи / Wishlist

Current app may keep fewer bottom tabs, but the product model should distinguish these domains internally.

### Suggested domain services

- `IdentityService`
- `PetProfileService`
- `CarePlanService`
- `CareHistoryService`
- `PublicCardService`
- `SocialMatchingService`
- `MapPlaceService`
- `AssistantContextService`
- `WishlistService`
- `PartnerIntegrationService`
- `EntitlementService`
- `NotificationService`
- `TrustSafetyService`

## 7. Target Data Model Additions

Current entities are a good base, but full product needs more durable models.

### New / expanded entities

- `pet_documents`
- `care_events`
- `care_templates`
- `notification_jobs`
- `public_dog_cards`
- `public_card_templates`
- `social_visibility_settings`
- `social_candidates`
- `social_matches`
- `walk_invites`
- `user_blocks`
- `reports`
- `public_places`
- `place_reports`
- `place_moderation_events`
- `partner_profiles`
- `partner_offers`
- `product_catalog_items`
- `wishlist_recommendations`
- `assistant_context_snapshots`
- `assistant_action_suggestions`
- `family_members`
- `caregiver_access_grants`
- `entitlements`
- `billing_events`

### Privacy-sensitive fields

Must be private by default:

- exact home location;
- phone/email;
- microchip;
- vet contact;
- medication;
- full health notes;
- precise walk routes;
- owner identity;
- raw Telegram IDs;
- assistant private threads.

## 8. UX / Design Requirements

- App opens into dog-centered Today, not auth/debug/status.
- Every screen has:
  - empty state;
  - content state;
  - loading state;
  - error/recovery state;
  - permission/privacy state when relevant.
- No raw enum/status/service copy in user UI.
- Socialization must feel like profiles and safe matching, not a report panel.
- Public card must be visually ownable and shareable.
- Map must separate personal/private and public/community layers.
- Wishlist/partners must be quiet and contextual, not marketplace-first.
- AI must show confidence/limits through copy, not technical labels.

## 9. Safety, Privacy, Moderation

### Health safety

- No diagnosis.
- No medication prescribing.
- Emergency/red flags escalation.
- Vet advice boundary visible in health contexts.
- Audit prompts/responses for high-risk categories.

### Social safety

- Consent before contact.
- Report/block.
- Moderation queue.
- No exact location by default.
- Safe first walk guidance.

### Public sharing

- Field allowlist.
- Preview before publish.
- Easy unpublish.
- No precise location or sensitive health fields.

### Partner/commercial trust

- Paid labels.
- No hidden targeting.
- No unsafe claims.
- User control over recommendation categories.

## 10. Implementation Roadmap

### Phase 1: Stabilize current product core

- Keep current UI clean from tech/status surfaces.
- Finish Telegram-first owner/pet persistence.
- Harden reminder CRUD and care history.
- Make public card backend-backed with allowlist.
- Keep QA gates strict.

### Phase 2: Care loop and progress

- Add `care_events`.
- Add recurrence scheduler.
- Add Telegram notification jobs.
- Add progress visualization.
- Add weekly/monthly care summary.

### Phase 3: Public card and growth

- Public card entity.
- Publish/unpublish.
- Card templates.
- Rich previews.
- Viral create-your-card loop.
- Privacy QA.

### Phase 4: Socialization

- Social visibility settings.
- Candidate profiles.
- Compatibility engine.
- Swipe deck from backend.
- Invite flow.
- Block/report/moderation.

### Phase 5: Map platform

- Personal map polish.
- Public place model.
- Moderation.
- Pet-friendly catalog.
- Temporary hazards.
- Route layer.

### Phase 6: AI action layer

- Context snapshots.
- Assistant thread UX.
- Action suggestions with confirmation.
- Reminder/wishlist/map/profile write actions.
- Safety eval set.

### Phase 7: Wishlist and partner integrations

- Wishlist recommendations.
- Partner profiles/offers.
- Vet/food/accessory integrations.
- Trust labels.
- Offer analytics.

### Phase 8: Plus / monetization

- Entitlements enforced server-side.
- Pricing and legal.
- Payment provider / Telegram Stars.
- Reconciliation.
- Support/refund flows.

## 11. Acceptance Criteria for Full Product

- A new user creates a dog profile and first reminder in under 2 minutes.
- User receives and completes a reminder through Telegram.
- Today shows progress and one next useful action.
- Public card can be published/unpublished and never leaks private fields.
- Socialization recommends compatible dogs with explanations and safety controls.
- Map supports private zones and moderated public places.
- AI answers with profile context and can propose confirmed actions.
- Wishlist suggestions are explainable and respect health/profile constraints.
- Partner content is labelled and user-controllable.
- QA catches raw enums, technical labels, privacy leaks, and unsafe health/social flows.

## 12. Open Questions

- Какой рынок первичный: Россия/Telegram-only или шире?
- Делать ли socialization как core activation или как second-wave retention?
- Нужен ли полноценный chat/messaging между владельцами или сначала Telegram handoff?
- Какой уровень клинической ответственности допустим для вет-интеграций?
- Какие партнёрские категории запускать первыми: корм, клиники, аксессуары, груминг?
- Какая monetization модель: Plus, partner commission, B2B SaaS, hybrid?
- Нужно ли хранить документы/фото медкарты в первом полном релизе?

## 13. Immediate Engineering Notes

- Не смешивать публичную карточку и социализацию с PNG/export tooling в основном пользовательском flow.
- Не расширять social/map без privacy model.
- Не включать AI provider без safety eval.
- Не включать billing без server-side entitlement enforcement.
- Не ослаблять RLS/owner checks ради demo UX.
- Поддерживать `npm run qa:local` как минимальный release gate.

