# Псё — roadmap реализации Production P0

Статус: draft for owner decisions and subagent handoff  
Дата: 2026-08-13  
Канонический источник: `docs/PSYO_FINAL_PRD.md`, baseline `origin/main`  
Baseline Git SHA: `5bdbbf721eda277b7b82172e0221fd643b440489`  
Owner decisions after baseline: случка / вязка — пример сценария matching внутри `рядом`, не отдельный модуль; базовый `рядом` и matching входят в первую production-версию; после взаимного согласия открывается Telegram-чат; первые города — Москва и Санкт-Петербург; Псё создаёт и модерирует официальные городские чаты и объединяет их в официальную Telegram-папку.
Current PRD SHA-256: `7838a7d11730ed3e8c062a4740e158f809e19b2a25d85cf129647849fcaaeb6e`

## 1. Правила исполнения

1. Канонический PRD имеет приоритет над `IMPLEMENTATION.md`, HLD, tracker и старыми roadmap.
2. Production P0 ограничен §19 строками 721–738 и связанными privacy/NFR/release-инвариантами.
3. Beta и Later не попадают в P0 скрыто или «заодно».
4. Каждая задача обязана ссылаться на `Rxx`, иметь проверяемый outcome и команду/evidence проверки.
5. Статус `done` разрешён только после runtime-проверки. Наличие файла, route или source-marker не доказывает готовность.
6. Неопределённое PRD решение получает статус `DECISION`; субагент останавливается, а не выбирает за владельца продукта.
7. Никаких production writes, Telegram-отправок, Stars-транзакций или включения risky flags без отдельного разрешения.

## 2. Зафиксированный scope

### Production P0

- Telegram Mini App / web shell;
- валидная Telegram session и owner-only доступ;
- одна или несколько собак без смешения данных;
- `всё`, `псё`;
- базовые карточки, напоминания, tracking, wishlist;
- базовая карта без рискованного публичного слоя;
- базовый `рядом` и matching для знакомства, прогулки, социализации и случки / вязки;
- privacy controls, legal/support foundation;
- QA/smoke gates.

### Не P0

- Beta: расширенные карточки и matching, публичные маршруты, групповые прогулки, партнёрские места, расширенный wishlist, assistant actions, Telegram notifications.
- Later: community map, live presence, AI-agent actions, Stars/Plus, B2B, native wrapper, physical products.

Следствие: существующие billing/AI/social заготовки остаются выключенными и не являются частью P0 acceptance.

## 3. Traceability index

| ID | Требование | Scope | Release outcome |
|---|---|---|---|
| R01–R03 | Собака как core object; external viewer только по явному share; private by default | P0/foundation | Все данные pet/owner scoped; внешняя видимость только explicit |
| R04–R11 | IA, Telegram auth, admin, multi-dog, onboarding, activation | P0 | Новый Telegram-owner проходит создание pet → care action → card preview → restore |
| R12–R15 | Basic card и living profile | P0 | Safe allowlist, preview, owner-managed link; профиль active pet |
| R16–R20 | Tracking и `всё` | P0 | Быстрая запись, история, один главный next action |
| R21–R22 | Basic/private map и visibility layers | P0; public layers Beta/Later | Private map работает, public/community выключены |
| R23–R30 | Basic wishlist, reminders, privacy, legal/support | P0 | Owner-scoped CRUD, revoke/delete semantics, legal/support reachable |
| R31 | Nearby/matching, включая случку / вязку как пример сценария | P0 basic; Beta expanded/group | Реальный opt-in matching входит в P0; не выделять случку в отдельный модуль |
| R32–R37 | Partners, assistant, остальной Beta/Later bundle | Beta/Later | Не включать в P0 |
| R38–R42 | Free/Plus/Stars | Later | Flags off; отдельный billing release gate |
| R43–R47 | Metrics, NFR, P0 QA и risky-module gates | Cross-cutting | Поведенческие gates и честный health/readiness |

Полная детализация требований берётся непосредственно из `docs/PSYO_FINAL_PRD.md`; субагент не заменяет её пересказом этого документа.

## 4. Доказанный baseline и разрывы

### Уже есть

- Next.js/React/TypeScript shell, Telegram SDK и v1 Telegram session route.
- Server-side `initData` verification, signed HttpOnly app cookie, Telegram identity → owner bridge.
- Supabase schema, 9 migrations, owner-scoped API foundation.
- UI/API scaffolds для pets, reminders, observations, dog cards, wishlist, zones/map.
- GitHub CI с `npm run qa:local`.
- Strict production smoke прошёл на release `5bdbbf7`.

### Release-critical gaps

1. Authenticated onboarding: `saveOnboardingCarePlan()` не сохраняет pet перед первым reminder; `createReminder()` блокируется без `backendPetId`.
2. Navigation: `AppNavigation` содержит `Сегодня/План/Памятка/Профиль`; `карта` и `вещи` не имеют гарантированного primary path. Каноническая IA не реализована.
3. Нет real Telegram fixture и двухвладельческого E2E; source-contract тесты не доказывают RLS/IDOR/runtime isolation.
4. Нет UI для добавления второй собаки после onboarding.
5. Reminders: date-only UX, recurrence semantics не реализована, complete/snooze не доказаны idempotent.
6. Tracking UI покрывает лишь часть PRD types и не даёт edit/delete, хотя API существует.
7. Cards: нет authenticated lifecycle E2E publish → read → regenerate/revoke → old URL 404.
8. Wishlist и private map не доказаны в reachable/authenticated flow.
9. Map Telegram-cookie read нуждается в runtime-проверке; shared map link revoke отсутствует.
10. Нет понятного server-side data deletion flow и consent persistence.
11. Legal/support страницы остаются черновиками.
12. Playwright core-loop не входит в CI; нет real Telegram WebView iOS/Android evidence.
13. Risky public/social endpoints не везде принудительно закрыты feature flags.
14. Нет измеримого performance gate, built-client secret scan и logging/privacy contract.

## 5. Dependency roadmap

```text
W0 Scope lock + owner decisions + safe fixtures
  ├─> W1-A Telegram identity/runtime isolation harness
  ├─> W1-B Authenticated onboarding activation
  └─> W1-C App shell/navigation
          ↓
W2 Persisted P0 core
  ├─> Multi-dog
  ├─> Reminders
  ├─> Tracking
  ├─> Cards/privacy
  ├─> Wishlist
  ├─> Private map
  └─> Basic рядом/matching
          ↓
W3 Composition
  ├─> всё: one next action
  ├─> псё: living profile/history/actions
  └─> privacy/data lifecycle + legal/support
          ↓
W4 Authenticated P0 journey + device/release evidence
```

`app/page.tsx` монолитен; несколько UI-агентов не работают в нём параллельно. Backend/test work можно распараллеливать, UI merge идёт последовательно либо после отдельной extraction-задачи без изменения поведения.

## 6. Backlog для субагентов

### PSYO-00 — Source lock и документационные конфликты

- Требования: все Rxx; scope control.
- Файлы: `docs/PSYO_FINAL_PRD.md`, `docs/PSYO_PRD_IMPLEMENTATION_TRACKER.md`, `IMPLEMENTATION.md`, этот roadmap.
- Сделать: добавить в tracker явный source SHA; исправить P0/Beta/Later классификацию; убрать утверждения, расходящиеся с фактической навигацией/production readiness.
- Не делать: не менять PRD и не принимать open decisions.
- Acceptance: ни notifications, ни billing/Plus, ни social matching не названы P0; текущие статусы подтверждены code/runtime evidence.
- Verify: review diff + `rg -n "P0|Beta|Later|notifications|Stars|Plus|рядом" docs IMPLEMENTATION.md`.

### PSYO-01 — Behavioral Telegram identity and isolation harness

- Требования: R06, R08, R09, R28, R44–R46.
- Владение: `scripts/qa/`, test fixtures; production code только при найденном дефекте.
- Сделать: secret-safe real-initData runner; HttpOnly cookie assertion; no raw ID; owner A/B IDOR; dog A1/A2 isolation across bootstrap and CRUD; isolated cleanup.
- Не делать: не логировать initData/token; не писать в production; не отправлять Telegram messages.
- Acceptance: fresh succeeds; tampered/expired/no-user fail; A не читает/пишет B; A1/A2 не смешиваются.
- Verify: existing synthetic initData check + new integration command with two authorized isolated fixtures.
- Stop: нет двух test owners/fixtures или тест требует production data.

### PSYO-02 — Authenticated onboarding and activation

- Требования: R05–R07, R10–R11.
- Файлы: `components/onboarding/CoreOnboarding.tsx`, `app/page.tsx`, `app/api/v1/pets/route.ts`, pet/reminder APIs, focused tests.
- Сделать: для owner с zero pets создать pet через BFF до reminder; сохранить contact rules; создать first care/reminder; показать card preview и privacy meaning; восстановить незавершённый onboarding после reload.
- Не делать: email login, invited caregivers, notification delivery.
- Acceptance: real Telegram owner проходит zero-pet → activation; reload возвращает pet/reminder и корректную onboarding stage.
- Verify: behavioral test из PSYO-01 + browser journey.

### PSYO-03 — Canonical shell/navigation

- Требования: R04–R05, R44.
- Файлы: `components/app/AppNavigation.tsx`, app shell/types, navigation contract/browser tests.
- Сделать: привести labels/order и reachable routes к PRD; `всё` и `псё` рядом; plan/card/legal/support оставить secondary surfaces.
- Не делать: не реализовывать public routes, live presence, public ratings, partners или групповые прогулки в P0.
- Acceptance: все разрешённые P0 surfaces достижимы в Telegram-sized viewport; browser preview честно обозначен.
- Acceptance: `рядом` является рабочим P0 route, а не заглушкой; точная функция определяется PSYO-15.

### PSYO-15 — Basic `рядом` and matching

- Требования: R03, R09, R31, R43, R45–R47.
- Файлы: social profile/schema, `app/api/social/**`, `рядом` UI, privacy/feature flags, behavioral tests.
- Сделать: explicit opt-in discoverability для каждой active pet; approximate area only; scenario selection `знакомство / прогулка / социализация / случка или вязка`; private explainable compatibility; mutual contact request; переход в Telegram-чат только после взаимного согласия; discovery официальных чатов Псё для Москвы и Санкт-Петербурга и официальной Telegram-папки; правила, жалобы и moderation surface; owner/pet isolation; block/report/revoke visibility.
- Не делать: exact/live location, public rating, automatic contact disclosure, group walks, public community feed, medical/genetic guarantee.
- Acceptance: два opted-in владельца получают explainable match; hidden pet never appears; request/accept/reject/block flow works; Telegram contact opens only after mutual consent; city community discovery is city-scoped; no raw Telegram ID or exact geo leaks; mating remains scenario value, not separate module.
- Decision dependencies: D1 minimum required matching fields. До внешнего создания чатов нужны утверждённые правила, назначенный moderator и отдельное разрешение на external action.

### PSYO-04 — Multi-dog creation and isolation

- Требования: R09, R43, R46.
- Файлы: pet creation UI/BFF, bootstrap, active-pet state, behavioral tests.
- Сделать: добавить вторую собаку; явное переключение active pet; отдельные profile/cards/reminders/items/routes/social params; owner/pet isolation tests.
- Не делать: не вводить Free/Plus limit до D2.
- Acceptance: A1/A2 data and public links never cross; selection survives reload; owner B cannot access either.

### PSYO-05 — Basic reminders

- Требования: R25–R27, R46.
- Файлы: `app/api/reminders/**`, reminders UI/domain, migrations only if contract requires, tests.
- Сделать: create/edit/repeat/reschedule/snooze/complete/history; exact/flexible/approximate representation; retry-safe mutations; pet relation and supported optional links.
- Не делать: Telegram notifications (Beta).
- Acceptance: authenticated CRUD/reload/history; duplicate retry does not duplicate completion effects; cross-owner/pet negative tests.
- Decision dependency: D3 — recurrence completion model; D4 — что именно означает `basic reminders`, если весь §14 не входит P0.

### PSYO-06 — Basic tracking

- Требования: R16–R18, R46.
- Файлы: observations API/UI/bootstrap/profile timeline/tests.
- Сделать: доступные PRD basic types; quick create; short note/templates/return previous; edit/delete; surface in `всё`, `псё`, card/history where applicable.
- Не делать: photo attachments, voice, AI recommendations.
- Acceptance: authenticated CRUD/reload and pet/owner isolation; one-tap path preserved.

### PSYO-07 — Basic cards privacy lifecycle

- Требования: R02–R03, R12–R13, R28–R29, R46.
- Файлы: `app/api/dog-cards/route.ts`, `lib/server/publicDogCard.ts`, `app/dog/[slug]/page.tsx`, card UI/tests.
- Сделать: explicit preview/allowlist; authenticated publish/read; regenerate/revoke; old link 404; enforce public-sharing kill switch; adversarial sensitive-field test.
- Не делать: premium card split, lost mode, expanded scenarios/version history.
- Acceptance: address/contact/medication/docs/internal notes never appear unless a future explicit requirement changes projection; external viewer cannot edit.

### PSYO-08 — Basic wishlist

- Требования: R23–R24, R28, R46.
- Файлы: wishlist API/UI/bootstrap/tests.
- Сделать: reachable pet-scoped basic CRUD, core fields already supported by contract, privacy/isolation tests.
- Не делать: partner picks, commerce, expanded sharing/repeat purchases unless explicitly classified.
- Acceptance: create/update/delete/reload for active pet; no owner/pet leakage.

### PSYO-09 — Basic private map

- Требования: R21–R22, R28–R29, R45–R47.
- Файлы: zones/map APIs, map UI, geo projection, share/revoke path, flags/tests.
- Сделать: reachable private places/routes; verify Telegram-cookie owner read; keep risky public layer off; revoke shared link if link sharing remains P0; enforce public-map/social kill switches.
- Не делать: moderation, public routes, community map, live presence, matching.
- Acceptance: private data stays private; approximate external projection only; revoked link no longer resolves; disabled risky API returns honest blocked state.
- Decision dependency: D1 map/nearby boundary.

### PSYO-10 — `всё`: one next action

- Требования: R18–R20.
- Depends: PSYO-05, 06, 08, 09.
- Файлы: `lib/today.ts`, Today UI/components, focused tests.
- Сделать: aggregate existing P0 signals and render exactly one primary next action, with secondary context.
- Не делать: invent clinical scoring or AI prioritization.
- Decision dependency: D5 — precedence when signals conflict. Until then implement only deterministic cases directly implied by status/time.
- Acceptance: test matrix proves one primary action for empty, overdue, due, observation, profile-gap, item/map cases after D5.

### PSYO-11 — `псё`: living profile

- Требования: R14–R15, R18.
- Depends: PSYO-04, 06.
- Файлы: profile/passport/social UI, `profileService`, bootstrap/tests.
- Сделать: active-pet identity, parameters, temperament/contact/triggers/habits, health/nutrition/notes, history and links to P0 actions; dictionaries + free text.
- Не делать: document upload/storage until D6; no medical diagnosis.
- Acceptance: save/reload all agreed fields; active-pet isolation; relevant fields link to existing P0 action.

### PSYO-12 — Privacy, consent and data lifecycle

- Требования: R03, R28–R29, R45–R46.
- Depends: PSYO-04, 07, 09 and D7.
- Сделать: persist privacy/legal consent; understandable confirmed deletion flow; owner-scoped delete; link revocation; no sensitive logs; built-client secret scan.
- Не делать: choose retention/recovery/legal policy.
- Decision dependency: D7 deletion scope and retention/recovery policy.
- Acceptance: behavioral tests prove selected delete scope and zero cross-owner effect; client bundle contains no service-role secret/raw Telegram ID.

### PSYO-13 — Legal/support foundation

- Требования: R30, R46.
- Файлы: legal/support pages and configuration.
- Сделать: integrate owner/legal-approved texts and real support contact; remove draft/TBD labels only after approval.
- Не делать: write legal policy on behalf of owner.
- Decision dependency: D8.
- Acceptance: approved pages reachable in prod; support path works; version/date visible.

### PSYO-14 — NFR and release matrix

- Требования: R43–R47.
- Depends: all P0 slices.
- Сделать: CI behavioral suite; 390×844 + desktop loading/empty/error states; accessibility; owner A/B and A1/A2; card/map/wishlist privacy; real Telegram WebView manual evidence; strict prod smoke after deploy approval; readiness report by service.
- Не делать: mark external LLM, payments, public map/social/partners/emergency ready.
- Decision dependency: D9 measurable performance threshold; D10 analytics event schema/privacy/vendor if analytics is included now.
- Acceptance: every §22 P0 gate has command/evidence; failures block release; service readiness distinguishes disabled, partial, ready.

## 7. Safe execution waves

| Wave | Parallel work | Serial merge / exit criterion |
|---|---|---|
| W0 | PSYO-00; owner decisions; fixtures | Scope locked; blockers named |
| W1 | PSYO-01 backend/tests; PSYO-02 backend; PSYO-03 shell | Authenticated zero-pet activation and reachable shell |
| W2A | PSYO-04 backend; PSYO-05 API; PSYO-06 API; PSYO-07 API/tests | Two-owner/two-dog runtime isolation green |
| W2B | PSYO-08 API; PSYO-09 API/flags; PSYO-15 social backend/tests; UI work serialized | All P0 CRUD and basic matching persistent and reachable |
| W3 | PSYO-10, 11 sequential UI; PSYO-12 backend/tests; PSYO-13 content | Full owner journey and privacy lifecycle green |
| W4 | PSYO-14 only | PRD §22 evidence complete; explicit deploy approval; prod smoke green |

Recommended subagent concurrency: one UI agent, one backend/domain agent, one QA/security agent. No two agents edit `app/page.tsx` concurrently.

## 8. Owner decisions — do not infer

| ID | Decision | Blocks |
|---|---|---|
| D1 | Какие поля обязательны для базовой совместимости? | PSYO-15 |
| D2 | До Later-биллинга сколько собак разрешено бесплатно? | PSYO-04 |
| D3 | Recurring reminder: completion advances the same row or creates a new occurrence? | PSYO-05 |
| D4 | Весь §14 обязателен в P0 или для `basic reminders` задаётся подмножество? | PSYO-05 |
| D5 | Приоритет `всё`: overdue reminder vs observation/health signal vs profile gap | PSYO-10 |
| D6 | P0 `псё`: document fields only или загрузка/хранение файлов? | PSYO-11 |
| D7 | Data deletion: pet, account, оба; retention/recovery policy | PSYO-12 |
| D8 | Approved privacy/terms/support contact and wording | PSYO-13 |
| D9 | Числовой порог «быстрого первого экрана» | PSYO-14 |
| D10 | Нужна ли P0 analytics реализация сейчас; event schema, consent/retention/vendor | PSYO-14 |

Остальные открытые вопросы PRD — premium cards, LLM/provider, public moderation, lost mode, telemedicine/emergency, monetization timing, physical products — не блокируют P0. Matching fields и contact mechanics теперь блокируют PSYO-15, потому что базовый `рядом` перенесён в P0 решением владельца продукта.

## 9. Definition of Done для любого handoff

- Указаны Rxx и точный scope/non-goals.
- Есть до изменения падающий behavioral test или воспроизводимый runtime defect.
- Реализация owner/pet scoped и не обходит RLS через клиент.
- `npm run qa:local` зелёный.
- Релевантный behavioral/integration test зелёный.
- Для UI проверены Telegram viewport, loading/empty/error и keyboard/focus basics.
- Tracker обновлён доказательством, а не заявлением.
- Production deploy/smoke выполняются только отдельным release handoff после согласования.

## 10. Первый пакет передачи

До ответов D1–D10 безопасно отдать только:

1. PSYO-00 — выравнивание документации без продуктовых решений.
2. PSYO-01 — test harness/fixtures, если предоставлены безопасные test identities.
3. PSYO-02 — исправление zero-pet authenticated onboarding до pet persistence; contact/privacy/card части ограничены уже точными требованиями PRD.
4. PSYO-07 — behavioral card lifecycle и enforcement существующего kill switch, без premium/lost mode.

PSYO-15 нельзя отдавать до D1: без решения contact mechanics и обязательных matching fields агент будет вынужден придумать продукт за владельца.

После D1–D10 roadmap превращается в исполняемый backlog без decision placeholders.
