# Backend: источник истины, риски и контракт готовности

Аудируемая версия: c15d067aacccff7199e297a988e8557f1e14a995. Оба адреса production подтвердили её read-only проверкой 09.09.2026 (`evidence/production-baseline.json`). PR29/98785bf — отдельная невыпущенная ветка. Наличие файла миграции в git не доказывает её применение в базе.

## 1. Подтверждённые находки и границы доказательств

Приоритет «блокирует R1» означает условие выпуска обновлённого сценария, а не заявление о подтверждённом production-инциденте. **Уязвимость доступа к чужим данным этим аудитом не доказана.** Не представлять статический просмотр как полный security-аудит.

| ID | Приоритет | Находка и источник | Доказательство / влияние | Решение / критерий |
|---|---|---|---|---|
| F-01 | Блокирует запись R1 | `app/api/observations/route.ts:171`, `lib/server/careHttp.ts:35`: claim → insert observation → finish claim → при исключении abort claim | Выполнен неизменённый route + helper с транспортной инъекцией: первая попытка 500 при 1 сохранённой строке; тот же ключ/тело повторно 201, строк стало 2. `evidence/observation-fault-result.json`. Не live DB | B-01: запись+receipt в одной транзакции; повтор возвращает тот же ID. Сбой после commit/до HTTP ответа, конкурентный повтор, перезапуск worker, иной payload на том же ключе |
| F-02 | Блокирует профиль R1 | `lib/server/profileService.ts:54`: pets.update затем параллельно passport/social upsert | По коду возможен частичный профиль, если один дочерний запрос падает. Метод вызывается `app/api/pets/route.ts:31`. Создание через отдельный RPC уже существует — не смешивать с обновлением | B-02: atomic update или явный ограниченный patch по домену с доказанной семантикой. Успех нельзя показывать при частичном сохранении. Добавить expectedVersion/конфликт двух устройств |
| F-03 | Блокирует документы R1 | `app/api/documents/route.ts:39` и `[id]/route.ts:45`: upload объекта → insert metadata; remove объекта → delete metadata | Upload без стабильного ключа/ID; повтор после потерянного ответа создаёт новый UUID. При ошибке metadata вставки cleanup best-effort. При delete storage success/DB failure остаётся запись о отсутствующем файле. Подтверждено анализом порядка запросов, не live fault test | B-03: устойчивый upload/delete workflow: operation ID, pending/ready/deleting/failed, возобновление и reconciliation; повтор не создаёт дубль/осиротевшие файлы. Не пытаться сделать Storage+SQL одной фиктивной транзакцией |
| F-04 | Блокирует обещание из PNG | `/api/social/requests/[id]/meeting`, миграция `20260907012000_social_meeting_proposals.sql` | Есть preview/send/get, fingerprint и доступность источника. Нет поля состояния/команды принятия предложения вторым владельцем. `accepted` у match request — принятие знакомства, не места | R1 заканчивается «предложение отправлено». B-08/R2 вводит отдельное состояние с автором, получателем и версией предложения |
| F-05 | Блокирует новую память/агента | PR29 `app/api/agent/*`, `READINESS.md`, `GROQ.md` | Production не содержит foundation endpoints/schema. Ветка проверена локально ранее, Free/Search entitlement и cloud execution не подтверждены | B-09/R3 отдельно. Ни textarea из макета, ни наличие ключа не означают живую память/поиск |
| F-06 | Блокирует цельный UI R1 | `app/page.tsx:723`/`:759`/`:775`; вкладки + journeyDetail + отдельные состояния в компонентах | Глобальная история хранит tab/detail, не entityId/draftId/источник формы; глобальный resetScroll. Есть локальные хорошие возвраты карты, но не общий контракт | B-04: единая навигация/контекст по объекту и тесты всех входов. Не утверждать, что весь back уже сломан: проблема покрытия/архитектурного различия |
| F-07 | Блокирует полноту истории R1 | `app/page.tsx:2395`, `ProfileMemoryWorkspace.tsx:160`–`:188`, `GET /observations` limit/date filters | Локальные срезы 12/20; profile history и health — разные представления. Макет поиска по всей истории не доказан текущим API/клиентом | B-05: определённый диапазон/пагинация/поиск и detail по ID, eventTime не заменять createdAt |
| F-08 | Блокирует смешение стилей | `app/layout.tsx:4`–`:13`, старые `WatercolorScreen` в page:4480/4622/4701/4724 | Десять global CSS импортов и разные оболочки внутренних экранов. Ещё один CSS override не закрывает их поведение | B-06: общие primitives и scoped theme, таблица достижения каждой поверхности, remove old only after consumer check |
| F-09 | Блокирует ложные обещания | Read-only `/api/internal/health` на обоих aliases | Notifications/billing/paywall/new invoices OFF; uploads/avatar/public sharing ON. Это состояния флагов, не функциональная приёмка | R1 сохраняет конфигурацию; никакой попутной активации. Отдельный admission gate для внешних/платных провайдеров |
| F-10 | Требует проверки перед R1 | `socialHttp.ts:8` vs `observations/route.ts:96`, `documents/route.ts:21` | Social явно отвергает несовпадающие bearer/cookie principals; другие просмотренные routes выбирают bearer ?? cookie. Это различие политики, не доказанный IDOR | B-07: зафиксировать единый principal contract, проверить anonymous/A/B, mixed credentials, invalid Origin, service-role filtering. Не переписывать auth без этого контракта |
| F-11 | Блокирует преждевременное «QA пройдено» | `scripts/qa/check-profile-memory-production-contract.mjs:1`, `scripts/qa/vitest/route-characterization.test.ts:1` | Часть «контрактных тестов» — regex наличия текста/CSS, часть — mock Supabase. Они не проверяют RLS/SQL concurrency/Storage/WebView | B-10: отделить source tests, service fixtures, реальные DB/API, физический Telegram. Счётчик тестов не критерий релиза |
| F-12 | Блокирует публикацию нового шрифта до выяснения | `output/pso-naris-home/README.md` в workspace, источник fonts-online.ru/fonts/narisovanniysans | Настоящий файл использован в локальном макете; разрешение на commercial web embedding не зафиксировано | B-06: сохранить источник/лицензию, подготовить webfont. Не менять выбранный шрифт без явного дизайнерского решения |

F-01 не исправлен в этом аудите. F-02/F-03 нуждаются в воспроизведении на изолированной БД/Storage до приёмки исправления. Нельзя назвать «безопасным сохранением» одну лишь блокировку кнопки.

## 2. Контракты данных по сервисам

| Сервис / объект | Source of truth и владелец | API / идентичность | Инварианты и состояния |
|---|---|---|---|
| IdentityService | Подписанная app session + owner bridge; Supabase bearer legacy | `/api/v1/session/telegram`, `/api/telegram/session`, `/api/v1/session/logout`, bootstrap | Нельзя доверять клиентскому ownerId/initDataUnsafe. Session expired ≠ пустая база. Auth restoration возвращает к черновику, не сохраняет его анонимно |
| ProfileService | pets + pet_passports + social_profiles, owner_id через pet | `/api/pets`, `/api/v1/pets`, `/api/app/bootstrap` | create ID replay; selected pet scoped; update atomic; private/public различны; delete scope явный; не смешивать двух владельцев |
| Observation/HealthService | pet_observations (+ care_mutations / ingestion metadata), pet_id | `/api/observations`, `/:id`, `/:id/restore`, `/extract`, `/voice`, `/api/health` | Слова владельца/источник/observedAt отдельно; draft→confirmed→stored→deleted/restored. Structured ingestion не должен плодить повторные факты. История не копирует строки |
| ReminderService | reminders + reminder_events + care_mutations; delivery/jobs отдельно (deployed schema snapshot — gate) | `/api/reminders`, `/:id`, `/complete`, `/snooze`, `/history` | Completion+next repeat+event+receipt атомарны; timezone, DST/период, duplicate callback. Доставка отдельна от completed. Использовать имеющиеся SQL функции после staging verification |
| HabitService | pet_habits + habit_checkins, pet ownership | `/api/habits`, `/:id`, `/:id/checkins` | active→archived; checkin stable ID/key; период/цель не создаёт reminder автоматически. Контракт undo не придумывается UI |
| MapService | map_libraries document+revision; map_routes; map_zones | `/api/map/library`, `/features`, `/features/:id`, `/search`, `/walking`, `/zones` | Сохранение library использует revision CAS; сохранить механизм. Route planned/recorded различны; path gaps сохраняются; public/coarse projections explicit |
| SocialService | social_discovery_profiles, social_walk_signals, social_match_requests, blocks/reports/invites | `/api/social/*` | Роли sender/recipient; только получатель принимает отклик; expire/close/block; проверенный контакт; нет real transition из кнопок demo |
| Meeting proposal | social_meeting_proposals, snapshot+fingerprint, accepted connection | `/api/social/requests/:id/meeting` | Автор preview→send; unique proposal ID; изменённый/удалённый источник недоступен. Нет recipient-confirmation lifecycle в c15d067 |
| DocumentService | pet_documents + private Storage pet-documents | `/api/documents`, `/:id` | Metadata ready только с доступным object; signed URL 60s, refresh after expiry. MIME/size checks; owner gating; delete reconciled. Не сохранять signed URL как постоянный документ |
| AvatarService | avatar identity/assets/jobs + private Storage; public projection отдельно | `/api/v1/pets/:petId/avatar/*`, legacy `/api/avatar/*` | draft asset ≠ active; consent; fail preserves active; rollback; no-image; upload≤8MB по UI требует сверки реального сервиса. Отключённый provider не фальшивый success |
| WishlistService | wishlist_items; optional linked reminder | `/api/wishlist`, `/:id`, `/:id/restore` | wanted/bought, recoverable delete; linked purchase uses existing atomic RPC; stable optional plannedFor; не создавать лишнее дело из простой покупки |
| PublicCardService | Только whitelist projection с публикацией/отзывом | `/api/dog-cards`, `/dog/:slug`, map/share | Истечение/отзыв/удаление; HTML/API не раскрывают приватные поля. Закрыть старый публичный ресурс при revoke, не только убрать ссылку из UI |
| AssistantService current | Server response/context, существующие команды | `/api/assistant`, recommendations domain outcome routes | Действие только по явному выбору; domain ID реальный; нет обещания универсальной мутации всех объектов |
| AgentService future | PR29 threads/runs/events/artifacts/memory/source revisions | `/api/agent/*`, internal knowledge-refresh | queued/running/completed/failed/cancelled; admission budgets; bounded search; cancel/write race; forget source exclusion; no paid fallback. Не часть R1 |

Полный механический реестр: `evidence/api-inventory.csv` — 69 файлов/99 exports. Маркеры auth/idempotency — **подсказки поиска, не вердикт защищённости**: правила могут жить в helper/RPC, и отсутствие слова не доказывает отсутствие защиты.

## 3. Единый ответ мутации (проектируемый)

Логический контракт, адаптируемый к существующим DTO, без обязательного массового переименования API:

```
request: operation + requestId + petId + entityId? + expectedVersion? + payload
success: entityId + version/updatedAt + persistedScope + replayed + actual state
failure: code + retryable + requestId + fieldErrors? + currentVersion?
```

Команда определяется намерением, не кнопкой. Нельзя использовать один requestId после изменения тела. После timeout сначала подтвердить receipt или безопасно повторить тем же ID. Клиентский in-flight guard дополнителен, не заменяет server uniqueness/transaction.

Конфликт данных с другого устройства → сохранить локальный черновик, перечитать актуальную версию, дать сравнение/повтор. Не делать скрытый last-write-wins для полного паспорта. Удалённый объект не «восстанавливается» повтором старой формы. Гость хранит локально с отдельным namespace; auth-запрос не падает молча в guest mode.

## 4. Что сохраняем, а не переписываем

Существующие owner checks, typed contracts, atomic care/wishlist RPC, CAS map library, coarse map projection, snapshot fingerprint/blocked connection checks, avatar draft activation, recoverable delete, consent и feature flags. Хорошие механизмы требуют regression, не замены ради нового вида.

Не строить универсальный CRUD backend для всех сущностей. Разделять мутации по сервисам, общий слой только для auth/ошибок/idempotency-transport и UI-состояний.

## 5. Приватность и эксплуатация

Перед R1: A/B/anonymous по каждому endpoint, SQL RLS/service-role paths, pet A1/A2, deleted resource, stale signed URL, mixed principals и wrong origin. Production-записи не используются как destructive fixtures. Логи содержат correlationId/operation/status/duration/версию, но не тексты состояния, контакты, initData, signed URL или ключи. Нужны счётчики failed/unknown saves, duplicate replay/conflict, auth failures, Storage cleanup debt и длительность операций.

Этот документ — не независимый пентест и не итоговая backend-приёмка. Полный проход по staging с реальной БД ещё предстоит.
