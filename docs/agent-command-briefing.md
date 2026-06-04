# Agent Command Briefing — Псё

## Commander view

Псё должен двигаться не как frontend demo, а как продуктовая система для владельца собаки.

Главная цепочка на ближайшие спринты:

> **Passport → Reminders → Today → Assistant actions**

Аватар остаётся catchy onboarding hook. Карта, вишлисты, клиники и ветшопы — важные слои, но они не должны перетягивать фокус раньше ядра.

---

## Product team

### 1. Product Lead

**Роль:** держит product north star и приоритеты.

**Вердикт:** сейчас приложение местами ещё похоже на игрушку/демо, потому что Today, Assistant, Map и Wishlist пока не создают устойчивой пользы.

**P0 ядро:**

1. Паспортичка как контекст собаки.
2. Напоминания как retention loop.
3. Today как командный центр владельца.
4. Assistant v1 как action engine.

**Решения:**

- первый retention loop — care reminders;
- assistant v1 — не общий чат, а 5 безопасных сценариев;
- persistence/auth раньше карты и marketplace;
- уведомления сначала in-app;
- карта в ближайших спринтах — approximate zones, не реальная соцкарта.

---

### 2. Retention / Care Lifecycle

**Роль:** делает так, чтобы пользователь возвращался.

**Главная петля:**

> заполнил профиль → получил пользу сегодня → поставил care-якорь → вернулся по напоминанию → ассистент предложил следующее действие → сохранил в паспорт/напоминание/вишлист.

**Продуктовое правило:** каждый экран должен создавать durable object:

- `Reminder`
- `PetPassport`
- `SocialProfile`
- `AssistantThread`
- `WishlistItem`
- `MapZone`

**Activation:**

- `pet_created`
- 3+ profile fields
- `first_anchor_created`

**Today должен показывать:**

- что важно сегодня;
- ближайшие/просроченные задачи;
- один простой следующий шаг;
- быстрый переход в assistant/reminder.

---

### 3. Backend / Data Architect

**Роль:** превращает демо в настоящий backend.

**Вердикт:** backend scaffold есть, real MVP backend ещё не готов.

**Главные проблемы:**

- нет настоящего auth;
- API пока работает через service role и demo-owner;
- RLS формально есть, но user endpoints его обходят;
- reminders неполные: нет done/snooze/update/delete;
- assistant threads не сохраняются;
- storage для фото/аватаров не подключён.

**Следующий backend sprint:**

1. Supabase Auth + server-side session.
2. User-scoped API вместо demo-owner.
3. Real reminder CRUD.
4. Bootstrap возвращает только данные владельца.
5. Service role оставить только для cron/storage/admin flows.

**Acceptance:**

- пользователь логинится;
- создаёт питомца;
- обновляет паспортичку с другого устройства;
- создаёт/закрывает/snooze reminder;
- `/api/app/bootstrap` отдаёт только его данные;
- RLS реально работает через user JWT.

---

### 4. Safety / Vet-Behavior Reviewer

**Роль:** не дать assistant стать опасным псевдоветеринаром.

**Assistant v1 роль:**

> ассистент владельца собаки для ухода, воспитания, наблюдения, подготовки к специалисту и безопасной маршрутизации.

**Нельзя:**

- ставить диагнозы;
- назначать лекарства/дозировки;
- интерпретировать анализы как врач;
- говорить “точно нормально” при симптомах;
- советовать ждать при красных флагах;
- давать aversive techniques: наказания, удавки, строгачи, шок-ошейники, dominance logic.

**Можно:**

- triage: наблюдать / планово к врачу / срочно;
- красные флаги;
- positive reinforcement;
- чеклисты подготовки к врачу;
- безопасные шаги по поведению;
- эскалация к врачу/кинологу.

**Assistant output должен иметь metadata:**

- `domain`
- `urgency`
- `disclaimer`
- `recommendedNextStep`
- optional `suggestedAction`

---

### 5. Partnerships / Commerce Lead

**Роль:** сделать клиники/ветшопы/вишлисты полезными, а не рекламными.

**Главное правило:** commerce появляется только в контексте задачи владельца.

Хорошие моменты:

- закончился корм;
- пора обработка;
- собака тянет поводок → шлейка/тренировка/кинолог;
- аллергия → фильтр товаров;
- визит к врачу → чеклист и клиника;
- подарочный wishlist.

**Сначала строить:**

1. Wishlist CRUD.
2. Купить снова.
3. Assistant → wishlist suggestion.
4. Vet visit prep.
5. Hardcoded useful collections.

**Нельзя рано:**

- полный marketplace;
- paid ranking клиник;
- ads inside assistant answers;
- brand-first onboarding.

---

## Unified sprint plan

## Sprint 1 — “Псё помнит и возвращает”

### P0

- Supabase Auth.
- User-owned pets/passport/social profile.
- Reminder CRUD:
  - create;
  - update;
  - done;
  - snooze;
  - delete.
- Today screen:
  - today / upcoming / overdue;
  - nearest care task;
  - CTA add reminder.
- Profile completion / missing critical fields.

### P1

- Reminder templates:
  - вакцинация;
  - обработка;
  - корм;
  - лекарства;
  - груминг;
  - тренировка.
- Analytics events:
  - `pet_created`
  - `passport_saved`
  - `reminder_created`
  - `reminder_done`

### P2

- Empty states that explain why each block matters.

---

## Sprint 2 — “Псё советует и превращает советы в действия”

### P0

- Assistant v1:
  - real input;
  - context from pet/passport/social/reminders;
  - safety policy;
  - stored thread/messages.
- Assistant action proposals:
  - create reminder;
  - add wishlist item;
  - update triggers/social profile;
  - recommend vet/trainer escalation.

### P1

- Wishlist CRUD:
  - title;
  - category;
  - reason;
  - priority;
  - status.
- “Купить снова” as recurring care/shopping object.

### P2

- Approximate map zones CRUD:
  - home;
  - walk;
  - risk;
  - clinic/shop;
  - public/private.

---

## Leadership decision

Do **not** build more landing/UI polish now.

Build this sequence:

1. Auth.
2. Reminder CRUD.
3. Today from real data.
4. Assistant v1 with safety and actions.
5. Wishlist as action target.
6. Map zones after retention loop works.

This is the shortest path from prototype to useful product.
