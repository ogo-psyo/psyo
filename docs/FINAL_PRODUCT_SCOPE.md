# Псё — итоговое состояние проекта и широкий продуктовый скоуп

Дата: 2026-07-01  
Статус: целевая продуктовая карта, шире MVP/RC1.  
Production: `https://pso-mvp-uglanovrms-projects.vercel.app`  
GitHub: `https://github.com/ogo-psyo/psyo`

## 1. Суть продукта

Псё — Telegram Mini App и web companion для владельца собаки. Это не просто паспорт, напоминалка или чат-бот, а персональная операционная система заботы о собаке:

```text
помнит контекст собаки
→ подсказывает, что важно сегодня
→ напоминает вовремя
→ помогает выполнить действие
→ сохраняет историю
→ координирует людей вокруг собаки
→ безопасно делится нужной информацией
```

Главный объект продукта — не пользователь и не карточка, а живая собака со своим профилем, привычками, здоровьем, маршрутом, безопасностью, социальностью, вещами, историей и контекстом семьи.

## 2. Северная звезда

Псё должно дать владельцу ощущение:

- я ничего важного не забуду;
- я понимаю, что делать сегодня;
- вся информация о собаке собрана в одном месте;
- другой человек сможет безопасно помочь с собакой;
- ассистент знает контекст, но не притворяется ветеринаром;
- забота становится регулярной, а не хаотичной.

Ключевой retention loop:

```text
создал собаку
→ заполнил базовый профиль
→ получил первый полезный план
→ получил напоминание
→ выполнил действие
→ увидел историю
→ ассистент предложил следующий шаг
→ сохранил это как напоминание, заметку, вещь или правило
```

## 3. Текущее состояние на 2026-07-01

### Инфраструктура

- Код синхронизирован в org repo `ogo-psyo/psyo`.
- Последний production deploy сделан с коммита `72c8480b2fe840fa840810d37e44a18c0ae6a29a`.
- Vercel production alias: `https://pso-mvp-uglanovrms-projects.vercel.app`.
- `npm run qa:local` проходит из clean clone.
- `npm run qa:prod:smoke` проходит на production.
- Billing, invoices, Telegram notifications, AI provider, uploads и avatar generation выключены флагами до отдельных release gates.

### Реализованная основа

- Next.js 16 / React 19 / TypeScript / App Router.
- Mobile-first app shell.
- Telegram Mini App session validation scaffold.
- Supabase-backed owner/pet foundation.
- Local guest fallback.
- Профиль собаки и паспорт.
- Care reminders CRUD surface.
- Today screen.
- Публичная карточка собаки.
- Legal/support placeholders.
- Map zones scaffold.
- Wishlist scaffold.
- Assistant safety scaffold.
- Internal health endpoint.
- QA contract suite.

Важно: часть поверхностей уже есть как foundation, но не вся целевая функциональность считается production-ready. Этот документ описывает полный целевой scope, а не только готовый RC1.

## 4. Платформы

### Telegram Mini App

Главный production-контур:

- открытие из Telegram bot/menu button;
- server-side validation raw Telegram `initData`;
- псевдонимный `psyo_user_id`, без показа raw Telegram ID;
- HttpOnly app session;
- Telegram reminders;
- Telegram Stars billing;
- bot commands: open app, today, reminders, public card, support;
- Telegram share flows для публичной карточки.

### Web/PWA

Дополнительный контур:

- browser preview;
- installable PWA;
- offline-friendly read mode;
- печать/PDF карточки;
- fallback для людей без Telegram;
- QA/browser mode без production privileges.

### Будущий native wrapper

Опциональный слой:

- iOS/Android wrapper вокруг web app;
- push notifications;
- виджеты ближайшего care action;
- быстрый доступ к публичной карточке.

## 5. Главные модули продукта

## 5.1 Dog Identity / Живой профиль собаки

Цель: создать полный контекст собаки, который питает все остальные функции.

Функциональность:

- имя, фото, аватар;
- порода, возраст, стадия жизни, размер, вес, пол;
- микрочип, документы, паспорт;
- ветклиника, врач, страхование;
- вакцинация, обработки, лекарства;
- питание, аллергии, ограничения;
- характер, триггеры, страхи, правила контакта;
- энергия, обученность, стиль игры;
- alone-time, реакция на собак/людей/детей;
- заметки владельца;
- completeness score;
- версия профиля и история изменений.

Целевая логика:

- профиль не форма, а память собаки;
- каждое поле может превращаться в действие: напоминание, карточку, warning, assistant context, public rule;
- приватные поля никогда не попадают в публичные поверхности без explicit allowlist.

## 5.2 Onboarding / Активация

Цель: за 1-2 минуты дать первую пользу, а не заставить заполнять анкету.

Функциональность:

- Telegram-first start;
- создание первой собаки;
- фото или аватар;
- быстрые bubbles вместо длинной формы;
- выбор правила контакта;
- первый care anchor;
- первый reminder;
- первый safe public card preview;
- demo mode без обещания синхронизации;
- восстановление незавершённого onboarding.

Успешная активация:

- pet created;
- 3+ meaningful profile fields;
- first care reminder created;
- Today показывает следующий шаг;
- public card имеет безопасный preview.

## 5.3 Today / Командный центр владельца

Цель: каждый запуск отвечает на вопрос “что важно сейчас?”.

Функциональность:

- статус собаки на сегодня;
- ближайшее действие;
- overdue/upcoming reminders;
- быстрые действия: добавить дело, открыть памятку, спросить ассистента, отметить выполненным;
- care history;
- profile gaps;
- safety nudges;
- contextual paywall только рядом с реальной пользой;
- weekly/monthly summary;
- режим “я уезжаю / собака с другим человеком”;
- режим “срочно показать памятку”.

Целевая логика:

- Today не должен быть dashboard ради dashboard;
- максимум один главный следующий шаг;
- все обещания должны иметь backend/service evidence.

## 5.4 Reminders / План заботы

Цель: сделать заботу регулярной.

Функциональность:

- создание, редактирование, удаление;
- complete/snooze/reschedule;
- recurring reminders;
- templates: вакцинация, обработка, корм, лекарства, груминг, тренировка, прогулки, вес, ветвизит;
- Telegram notification delivery;
- idempotent completion;
- missed reminders;
- care history;
- календарь на 7/30 дней;
- экспорт `.ics`;
- smart suggestions из профиля;
- assistant-created reminders;
- семейные/опекунские assignments.

Будущая модель:

- `Reminder`;
- `CareEvent`;
- `ReminderDelivery`;
- `CarePlanTemplate`;
- `CareCompletionEvidence`.

## 5.5 Care History / История заботы

Цель: владелец видит не только задачи, но и накопленную заботу.

Функциональность:

- timeline выполненных действий;
- фильтры по категориям;
- отметки симптомов/наблюдений;
- события здоровья;
- прикрепление фото/документов;
- история лекарств и обработок;
- графики веса и активности;
- подготовка отчёта к врачу;
- экспорт owner data.

## 5.6 Public Dog Card / Публичная памятка

Цель: безопасно поделиться тем, что нужно другому человеку.

Сценарии:

- няня/догситтер;
- родственник;
- сосед;
- человек на прогулке;
- ветклиника;
- грумер;
- потерялась собака;
- знакомство с другой собакой.

Функциональность:

- backend-backed public card;
- publish/unpublish lifecycle;
- slug/QR/link;
- safe preview “что увидит другой человек”;
- allowlisted projection;
- print/PDF sitter card;
- Telegram share;
- multiple templates: прогулка, ситтер, вет, lost mode, social intro;
- expiry links;
- view analytics;
- abuse/report controls;
- no private medical notes by default.

Публичные поля только через allowlist:

- имя собаки;
- фото/аватар;
- safe area, не точный адрес;
- правило контакта;
- temperament summary;
- triggers/safety notes;
- owner-approved contact channel;
- emergency instructions, если включены.

## 5.7 Assistant / Ассистент заботы

Цель: не общий чат, а безопасный action engine вокруг конкретной собаки.

Функциональность:

- ответы с учётом профиля, возраста, веса, триггеров, истории и reminders;
- режимы: уход, здоровье, поведение, прогулки, покупки, подготовка к врачу;
- safety triage: наблюдать / планово к врачу / срочно;
- red flags;
- отказ от диагноза и дозировок;
- positive reinforcement только;
- сохранение thread/messages;
- suggested actions:
  - создать reminder;
  - добавить wishlist item;
  - обновить social rule;
  - добавить заметку в паспорт;
  - подготовить vet checklist;
  - создать map zone;
- owner confirmation before write;
- AI provider behind release flag;
- offline/rules fallback.

Запрещено:

- диагнозы;
- лекарства и дозировки;
- “точно нормально” при симптомах;
- aversive training;
- paid recommendations inside medical answers.

## 5.8 Map / Карта собачьего контекста

Цель: карта как память владельца, а не ранняя соцсеть.

Функциональность:

- approximate zones;
- safe places;
- risk zones;
- clinics;
- groomers;
- shops;
- routes;
- potty/water/shade notes;
- private/public visibility;
- radius instead of exact GPS;
- map notes;
- assistant-created zone suggestions;
- lost mode safe area;
- future community layer with moderation.

Будущий публичный слой:

- owner consent;
- moderation;
- trust score;
- reports;
- freshness;
- no exact home location;
- no stalking vector.

## 5.9 Social / Совместные прогулки

Цель: безопасное знакомство собак, а не свайп ради свайпа.

Функциональность:

- social profile;
- compatibility score;
- preferred dog types;
- forbidden triggers;
- meeting rules;
- availability windows;
- approximate area;
- interest/pass;
- request intro;
- owner confirmation;
- block/report;
- group walks;
- playdate history;
- post-walk notes;
- safety boundaries.

Не запускать публично без:

- consent;
- moderation;
- privacy model;
- anti-harassment tools;
- no exact location leakage.

## 5.10 Wishlist / Things / Care Inventory

Цель: список вещей возникает из задач ухода, а не из рекламы.

Функциональность:

- wishlist items;
- categories: food, treats, medicine, grooming, walk gear, training, vet prep, toys;
- reason why item exists;
- priority;
- bought/unsuitable/rebuy status;
- recurring purchases;
- assistant suggestions;
- vet visit prep kit;
- allergy-aware filters;
- “купить снова”;
- partner links only with disclosure;
- paid placement separated from care advice.

## 5.11 Clinics / Services / Partners

Цель: сервисный слой вокруг реальных задач владельца.

Функциональность:

- clinics catalog;
- vet visit checklist;
- groomers;
- trainers;
- dog sitters;
- shops;
- emergency contacts;
- saved trusted providers;
- appointment reminders;
- partner profiles;
- rating/trust signals;
- B2B dashboard in future.

Правило:

- партнёрство не должно ухудшать доверие ассистента;
- care context first, commerce second.

## 5.12 Family / Caregivers

Цель: собака часто живёт не у одного человека, а в маленькой системе людей.

Функциональность:

- owner;
- co-owner;
- caregiver;
- sitter temporary access;
- role-based access;
- task assignment;
- shared care history;
- public/private field visibility;
- temporary links;
- revoke access;
- emergency mode.

## 5.13 Billing / Псё Плюс

Цель: монетизация появляется там, где уже есть регулярная польза.

Free:

- 1 собака;
- ограниченное число active reminders;
- базовая публичная карточка;
- базовый Today;
- ограниченная история.

Plus:

- несколько собак;
- расширенные reminders;
- длинная история;
- PDF/print templates;
- caregiver access;
- advanced assistant actions;
- weekly summaries;
- lost mode;
- расширенные public card templates;
- расширенная карта;
- exports.

Telegram Stars:

- invoice creation only after legal/price approval;
- webhook processing;
- entitlement activation only server-side;
- reconciliation;
- refunds/cancel handling;
- no client callback entitlement activation.

## 5.14 Data, Privacy, Safety

Non-negotiables:

- raw Telegram ID не показывается в UI;
- service role не попадает в browser;
- public card только через allowlist;
- private health notes не сериализуются в public HTML/API;
- owner-scoped routes защищены;
- IDOR tests обязательны перед широким запуском;
- exact home location не публикуется;
- AI не ставит диагнозы;
- billing нельзя включать без legal/owner gate.

Обязательные будущие функции:

- export data;
- delete account/dog;
- revoke public links;
- audit log for caregiver access;
- backup/restore procedure;
- incident runbook.

## 6. Целевая архитектура

```text
Telegram Mini App / Web PWA
→ App Shell
→ BFF route handlers
→ Service layer
→ Supabase Auth + Postgres + RLS
→ Telegram Bot / Notifications / Stars
→ Optional AI provider
→ Partner/catalog providers
```

Ключевые сервисы:

- `IdentityService`;
- `ProfileService`;
- `TodayService`;
- `ReminderService`;
- `CareHistoryService`;
- `AssistantService`;
- `PublicCardService`;
- `MapZoneService`;
- `SocialMatchingService`;
- `WishlistService`;
- `EntitlementService`;
- `NotificationService`;
- `CaregiverService`;
- `ExportPrivacyService`.

## 7. Целевые сущности

Core:

- `Owner`;
- `TelegramIdentity`;
- `Pet`;
- `PetPassport`;
- `SocialProfile`;
- `Reminder`;
- `CareEvent`;
- `AssistantThread`;
- `AssistantMessage`;
- `PublicDogCard`;
- `MapZone`;
- `WishlistItem`;
- `Entitlement`;
- `Subscription`;
- `CaregiverAccess`;
- `NotificationDelivery`.

Future:

- `Provider`;
- `Clinic`;
- `Trainer`;
- `Groomer`;
- `ProductCatalogItem`;
- `PartnerOffer`;
- `WalkGroup`;
- `CompatibilitySignal`;
- `LostModeEvent`;
- `DocumentAsset`;
- `AuditEvent`.

## 8. Analytics

Activation:

- `mini_app_opened`;
- `telegram_session_connected`;
- `pet_created`;
- `photo_added`;
- `first_profile_fields_completed`;
- `first_reminder_created`;
- `today_first_action_completed`;

Retention:

- `reminder_received`;
- `reminder_completed`;
- `care_history_viewed`;
- `assistant_action_saved`;
- `weekly_summary_opened`;

Sharing:

- `public_card_previewed`;
- `public_card_published`;
- `public_card_shared`;
- `public_card_opened`;
- `public_card_revoked`;

Monetization:

- `plus_limit_seen`;
- `stars_invoice_created`;
- `subscription_activated`;
- `subscription_cancelled`;

Safety:

- `assistant_red_flag_shown`;
- `public_card_blocked_missing_safe_fields`;
- `caregiver_access_revoked`;
- `social_report_submitted`;

## 9. Release Layers

### Layer 1 — Foundation

- GitHub/Vercel discipline;
- QA gates;
- Telegram session validation;
- profile/passport foundation;
- Today visible loop;
- public card preview;
- billing disabled.

### Layer 2 — Real Care Loop

- durable reminders;
- Telegram delivery;
- complete/snooze/edit/delete;
- care history;
- Today prioritization.

### Layer 3 — Safe Sharing

- backend public card;
- publish/unpublish;
- PDF/print;
- caregiver temporary links;
- privacy allowlist tests.

### Layer 4 — Assistant Actions

- stored threads;
- safe answer metadata;
- create reminder/wishlist/profile note from assistant;
- vet/behavior escalation.

### Layer 5 — Plus / Stars

- server-side entitlements;
- Telegram Stars payments;
- limits;
- reconciliation;
- support/legal ready.

### Layer 6 — Social + Map + Partners

- social matching;
- public/community map;
- moderation;
- partner catalog;
- service discovery.

## 10. Final Product Promise

Псё в полном виде — это:

- паспорт собаки;
- ежедневный центр заботы;
- умные напоминания;
- история ухода;
- безопасная публичная памятка;
- ассистент с действиями;
- карта собачьего мира;
- социальные прогулки;
- wishlist и покупки из контекста ухода;
- family/caregiver coordination;
- Telegram-native billing and notifications;
- privacy-first pet data platform.

Коротко:

```text
Псё — это место, где собака становится понятной, забота регулярной, а владелец спокойнее.
```
