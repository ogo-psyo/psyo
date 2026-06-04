# PRD: Псё — лучший друг питомца и его владельца

## 1. Summary

**Псё** — mobile-first companion app для владельца собаки. Продукт собирает всё важное про пса в один живой центр: состояние собаки сегодня, ближайший заботливый шаг, паспорт/здоровье, прогулочные места и зоны, напоминания, ассистент поведения/ухода, вещи/вишлист и публичная карточка собаки.

Ключевой тезис:

> **Лучший друг питомца и его владельца. Всё про пса — Псё.**

## 2. Problem Statement

Владельцу собаки приходится держать заботу в разных местах:

- прививки/обработки — в памяти, заметках или у ветеринара;
- прогулочные места и зоны риска — в голове;
- поведение/триггеры — объяснять каждый раз заново;
- вещи/покупки — в маркетплейсах и чатах;
- фото/личность собаки — отдельно;
- вопросы “что делать?” — в поиске, чатах или у случайных советчиков.

Из-за этого забота становится фрагментированной: легко забыть срок, перегрузить собаку, потерять контекст или получить небезопасный совет.

## 3. Product Thesis / Positioning

Псё не должен быть:

- сухой ветеринарной CRM;
- generic pastel pet app;
- магазином с собакой сбоку;
- AI-чатом без контекста;
- анкетой на 40 полей.

Псё должен быть:

- живым ежедневным companion для пары “питомец + владелец”;
- полезным уже в guest/local режиме;
- эмоционально тёплым, но практичным;
- safety-first в здоровье, поведении, местах и данных;
- источником одного следующего заботливого действия.

## 4. Goals / Success Criteria

### Product goals

1. Пользователь за 30–60 секунд понимает, что Псё — это “всё про моего пса”.
2. Today screen отвечает на три вопроса:
   - как сегодня моя собака;
   - что важно не забыть;
   - что сделать дальше.
3. Пользователь может начать без регистрации.
4. Приложение сохраняет полезность после первого запуска через reminders/map/assistant.
5. Данные собаки структурируются так, чтобы ассистент и рекомендации были контекстными.

### Observable success signals

- Пользователь создаёт/заполняет минимальный профиль собаки.
- Пользователь добавляет хотя бы одно напоминание.
- Пользователь возвращается в Today screen после первого запуска.
- Пользователь открывает Assistant с конкретным вопросом по собаке.
- Пользователь добавляет хотя бы одно место/зону или понимает смысл карты.

## 5. Non-Goals / Out of Scope

Для ближайшего slice не делаем:

- полноценный native rewrite;
- marketplace/платежи;
- медицинские диагнозы или назначения;
- социальную сеть владельцев;
- сложную мультипитомцевость;
- публичную карту точных GPS-точек;
- агрессивную монетизацию;
- полное redesign всех вкладок сразу.

## 6. Users / Actors

### Primary user

**Владелец собаки** — хочет держать заботу, состояние, места и вопросы по собаке в одном понятном месте.

### Secondary actors

- Друг/партнёр/догситтер — получает публичную карточку/правила собаки.
- Ветеринар/кинолог — не пользователь MVP напрямую, но влияет на safety boundaries.
- Future partner/shop/clinic — потенциальные коммерческие сущности, не core MVP.

### System actors

- Supabase Auth / DB.
- Local storage guest mode.
- Assistant provider / rules fallback.
- Avatar generation provider/fallback.
- Vercel deployment.
- iOS WebView wrapper.

## 7. Core User Stories

1. Как владелец, я хочу открыть Псё и сразу понять состояние собаки сегодня, чтобы не держать всё в голове.
2. Как владелец, я хочу видеть один ближайший заботливый шаг, чтобы не тонуть в списках.
3. Как владелец, я хочу сохранить паспорт и привычки собаки, чтобы быстро объяснить её другим людям.
4. Как владелец, я хочу напоминания по уходу, чтобы не забывать обработки, вакцины, корм, груминг и тренировки.
5. Как владелец, я хочу отмечать безопасные/рискованные места, чтобы прогулки были спокойнее.
6. Как владелец, я хочу спросить ассистента с учётом профиля собаки, чтобы получить не generic-совет.
7. Как владелец, я хочу список вещей/вишлист по потребностям собаки, чтобы не покупать хаотично.
8. Как владелец, я хочу публичную карточку собаки, чтобы делиться правилами знакомства и ухода.

## 8. Proposed Product Shape

### North-star screen: Today

Today — главный экран и продуктовая проверка. Он должен ощущаться как “Псё знает мою собаку”.

Hierarchy:

1. **Dog Status Card**
   - имя собаки;
   - avatar/photo;
   - состояние/контекст дня;
   - короткие chips: обработка, вакцина, знакомства.

2. **Next Best Care Action**
   - один главный шаг;
   - причина/контекст;
   - действие: выполнить / добавить / спросить / перейти.

3. **Care Snapshot**
   - готовность профиля;
   - активные задачи;
   - места/зоны.

4. **Care Map teaser**
   - безопасные места, дом, парк, ветеринар, риск-зоны.

5. **Memory/Passport teaser**
   - возраст, здоровье, привычки, правила.

6. **Assistant teaser**
   - вопрос по поведению/уходу.

7. **Reminders**
   - быстрые добавления;
   - overdue/today/upcoming;
   - done/snooze/delete.

### Supporting tabs

- **Passport / Dog** — профиль, паспорт, здоровье, поведение, герой/аватар.
- **Map** — зоны и места: дом, маршруты, safe/risk, clinic/shop/grooming.
- **Assistant** — контекстные ответы с safety boundaries.
- **Shop / Things** — wishlist, вещи, покупки, причины.
- **Public Dog Card** — shareable card with rules.

## 9. Requirements

### Functional Requirements

#### FR1. Guest mode

- Пользователь может начать без регистрации.
- Local profile persists in localStorage.
- Guest reminders/zones/wishlist may work locally.
- Sign-in later should allow migration path [future].

#### FR2. Dog profile/passport

- Store dog identity, breed/group, age/life stage, weight, size, sex.
- Store health/passport fields: vaccine, parasite, diet, allergies, medication, vet clinic, health notes.
- Store social profile: social mode, temperament, energy, play style, friendliness, triggers, alone time.

#### FR3. Today next action

- Compute one next best action from profile completeness, reminders, overdue care, active tasks.
- Show clear action and CTA.
- Do not show 5 competing CTAs.

#### FR4. Reminders

- Create custom and preset reminders.
- Group as overdue / today / upcoming.
- Support complete, snooze, update, delete.
- Store reminder events for audit/history.

#### FR5. Map zones

- Add zones/places by type.
- Use approximate lat/lng + radius, not exact GPS by default.
- Support safe places, risk zones, clinics, shops, grooming, walk routes, home area.

#### FR6. Assistant

- Answer based on pet/passport/social/reminders context.
- Classify question into care, training, health_triage, shopping, general.
- For health: no diagnosis, red flags → vet.
- If context is missing, say what is missing.

#### FR7. Wishlist / things

- Create item with category, reason, priority, status.
- Tie items to pet.
- Do not make commerce the first product layer.

#### FR8. Public card

- Generate/share public dog card with safe owner-approved facts.
- Avoid leaking private health/location details.

### UX / Design Requirements

- Mobile-first; iPhone shell primary.
- Warm, intelligent, companion-like; not childish.
- First screen must show dog identity and next action above the fold.
- Use friendly microcopy but avoid fake cuteness.
- Empty states must explain the value of adding data.
- Alerts should reduce anxiety, not amplify it.
- Map/location UX must communicate approximate privacy.

### Data / Content Requirements

- Russian-first microcopy.
- Breed assumptions must not invent facts; photo/owner data beats breed stereotypes.
- Health copy must avoid diagnosis/prescription.
- Assistant answers max concise and safety-bounded.

### Operational Requirements

- Vercel production deployment.
- Supabase RLS must protect pet-owned private data.
- Guest/local behavior must not imply cloud persistence.
- QA before deploy: `npm run qa:local`.

## 10. Acceptance Criteria

### Today screen

- [ ] On first meaningful use, user sees dog identity/status card.
- [ ] One clear next action appears above reminder lists.
- [ ] Profile completeness is visible without shaming.
- [ ] Map/passport/assistant are discoverable as supporting systems.
- [ ] Empty states push toward useful setup, not generic onboarding.

### Safety/privacy

- [ ] Unauth bootstrap does not leak private pet data.
- [ ] Wishlist/assistant require auth in backend mode.
- [ ] Map zones are owner-scoped.
- [ ] Public card contains only explicit shareable data.

### Engineering

- [ ] `npm run qa:local` passes.
- [ ] No secrets/env edits.
- [ ] UI slice does not weaken API/auth boundaries.

## 11. Risks / Edge Cases

- Product may sprawl into passport + map + AI + shop without a clear Today anchor.
- Too much “cute pet app” can weaken trust.
- Too much “vet system” can make it cold and scary.
- Assistant can overstep into medical advice; must remain triage/support only.
- Location privacy is sensitive; exact GPS should not be default.
- Guest mode creates migration complexity.
- Avatar generation can distract from daily utility.

## 12. Rollout

### Phase 0 — current MVP baseline

- Web/PWA app.
- iOS WebView wrapper.
- Guest mode.
- Passport/reminders/map/wishlist/assistant basics.

### Phase 1 — Living Companion Today

- Redesign Today as companion-first surface.
- Keep backend unchanged.
- Verify daily use loop.

### Phase 2 — Data-backed care loop

- Better next action ranking.
- Reminder templates.
- Care history.
- Assistant context improvements.

### Phase 3 — Native/TestFlight

- Apple Developer Program.
- TestFlight.
- Push reminders / Live Activity possibilities.

### Phase 4 — monetization experiments

- Smart wishlist/affiliate with disclosure.
- Partner places/clinics only after trust is established.

## 13. Open Questions

1. Is the core wedge Today/companion or map/walk safety?
2. Should guest data be migratable to account in v1?
3. How much avatar/game layer is useful before it becomes toy-like?
4. Do we support multiple dogs in v1 or keep one-dog focus?
5. What is the first paid value: reminders/history, map, assistant, or commerce layer?
