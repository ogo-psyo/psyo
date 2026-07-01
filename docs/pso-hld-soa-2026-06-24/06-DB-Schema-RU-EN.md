# Псё — DB schema / сущности RU-EN

| RU сущность | EN entity / table | Домен | Назначение | Ключевые поля | Связи | Privacy / доступ |
|---|---|---|---|---|---|---|
| Профиль владельца | `Profile` / `profiles` | Identity | Приватная запись владельца, зеркало `auth.users` | `id`, `display_name`, `created_at` | `profiles.id` → `auth.users.id`; 1:N с `pets` | Только владелец через RLS |
| Собака | `Pet` / `pets` | Dog Profile | Базовая identity собаки | `id`, `owner_id`, `name`, `species`, `breed_id`, `breed_group_id`, `sex`, `life_stage`, `weight_kg`, `avatar_url`, `photo_urls`, `public_slug` | N:1 к `profiles`; 1:1 с `pet_passports`, `social_profiles`; 1:N с reminders/zones/wishlist/assistant | Приватно; публично только safe subset |
| Паспорт собаки | `PetPassport` / `pet_passports` | Dog Profile | Здоровье, уход, вет/питание заметки | `pet_id`, `microchip`, `vet_clinic`, `vet_contact`, `diet`, `allergies`, `medication`, `health_notes`, `vaccine_status`, `parasite_status` | 1:1 к `pets` по `pet_id` | Приватно; экспорт только вручную |
| Социальный профиль | `SocialProfile` / `social_profiles` | Dog Profile | Как знакомиться и как вести себя рядом с собакой | `pet_id`, `social_mode`, `temperament`, `energy_level`, `play_style`, `trainability`, `child_friendly`, `dog_friendly`, `cat_friendly`, `triggers`, `alone_time_note` | 1:1 к `pets` | Частично может попадать в публичную карточку |
| Напоминание | `Reminder` / `reminders` | Care Loop | Задача ухода с датой и статусом | `id`, `pet_id`, `type`, `title`, `due_at`, `recurrence`, `status`, `created_at`, `updated_at` | N:1 к `pets`; 1:N к `reminder_events` | Приватно |
| Событие напоминания | `ReminderEvent` / `reminder_events` | Care Loop | История действий по напоминанию | `id`, `reminder_id`, `event_type`, `payload`, `created_at` | N:1 к `reminders` | Приватно, audit/history |
| Место / зона | `MapZone` / `map_zones` | Places | Примерные безопасные/рискованные/сервисные места | `id`, `pet_id`, `type`, `title`, `approximate_lat`, `approximate_lng`, `radius_meters`, `note`, `created_at` | N:1 к `pets` | Только approximate; точный GPS не публикуем |
| Вещь / список нужного | `WishlistItem` / `wishlist_items` | Things | Корм, амуниция, лекарства, груминг, сервисы | `id`, `pet_id`, `title`, `category`, `reason`, `url`, `priority`, `status`, `created_at`, `updated_at` | N:1 к `pets` | Приватно; share позже отдельным opt-in |
| Тред ассистента | `AssistantThread` / `assistant_threads` | Assistant | Сессия диалога по собаке | `id`, `pet_id`, `kind`, `title`, `created_at`, `updated_at` | N:1 к `pets`; 1:N к `assistant_messages` | Приватно |
| Сообщение ассистента | `AssistantMessage` / `assistant_messages` | Assistant | Сообщения пользователя/ассистента/системы | `id`, `thread_id`, `role`, `content`, `created_at` | N:1 к `assistant_threads` | Приватно; нужна safety metadata в target |
| Telegram-сессия | `TelegramSession` / no table yet | Identity | Псевдонимная привязка Telegram Mini App | `psyoUserId`, `firstName`, `username`, `authDate` | Derived from signed `initData`; future link to `profiles` | Raw Telegram ID не показываем в UI |
| Гостевой профиль | `GuestProfile` / `localStorage` | Identity / Dog Profile | Локальный режим до входа | `DogProfile`, reminders draft, zones draft, wishlist draft | Может быть перенесён в `profiles/pets` позже | Только на устройстве, теряется при очистке браузера |
| Аватар / медиа | `AvatarAsset` / target table | Media | Фото/генерация аватара собаки | `id`, `pet_id`, `source`, `url`, `prompt`, `style`, `created_at` | N:1 к `pets` | Нужна явная retention policy |
| Публичная карточка | `PublicDogCard` / target `dog_cards` | Share / Export | Безопасная карточка для людей / печати / PDF | `id`, `pet_id`, `slug`, `fields`, `is_active`, `updated_at`, `revoked_at` | N:1 к `pets` | Только owner-selected safe subset |

## Статусы и enum

| Поле | Значения | RU meaning |
|---|---|---|
| `pets.species` | `dog` | Сейчас только собаки |
| `pet_passports.vaccine_status` | `actual`, `due_soon`, `overdue`, `unknown` | Актуально / скоро нужно / просрочено / неизвестно |
| `pet_passports.parasite_status` | `actual`, `needs_reminder`, `overdue`, `unknown` | Актуально / поставить напоминание / просрочено / неизвестно |
| `social_profiles.social_mode` | `ok`, `ask_first`, `calm_dogs_only`, `do_not_approach`, `known_only` | Можно знакомиться / сначала спросить / только спокойные / не подходить / только свои |
| `reminders.type` | `vaccine`, `parasite`, `medication`, `grooming`, `food`, `training`, `vet`, `custom` | Тип заботы |
| `reminders.status` | `active`, `done`, `snoozed` | Активно / готово / отложено |
| `map_zones.type` | `home_area`, `walk_route`, `safe_place`, `risk_zone`, `clinic`, `shop`, `grooming` | Дом / маршрут / безопасно / риск / клиника / магазин / груминг |
| `wishlist_items.category` | `food`, `treats`, `toy`, `gear`, `health`, `grooming`, `course`, `service`, `other` | Категория вещи |
| `wishlist_items.status` | `wanted`, `bought`, `not_suitable` | Нужно / куплено / не подходит |
| `assistant_threads.kind` | `training`, `care`, `health_triage`, `shopping`, `travel`, `general` | Тип диалога |

## Что есть сейчас / что target

| Entity | Сейчас | Target |
|---|---|---|
| `profiles` | Supabase Auth mirror | Account linking Telegram ↔ email/auth |
| `pets` | Есть в schema/API | Multi-pet позже, сейчас один основной pet |
| `pet_passports` | Есть в schema/API | Расширить документами/контактами только opt-in |
| `social_profiles` | Есть в schema/API | Основа public card и безопасных знакомств |
| `reminders` | Есть CRUD + local fallback | Telegram reminders после согласия |
| `reminder_events` | В API события пишутся, в базовой schema нужен явный table check в миграциях | История ухода и analytics без лишней персонализации |
| `map_zones` | Есть CRUD | Модерация/репорты для публичных мест позже |
| `wishlist_items` | Есть CRUD | Shareable wishlist / partner layer позже |
| `assistant_threads/messages` | Schema есть, persistence частично | Полная thread history + safety metadata |
| `dog_cards` / `PublicDogCard` | Пока query-backed route | DB-backed card with revocation and field controls |
