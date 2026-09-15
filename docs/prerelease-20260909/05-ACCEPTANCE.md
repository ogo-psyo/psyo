# Матрица приёмки: что именно доказываем

Статусы этой версии: **SPEC** — спроектировано, не прогнано на новой реализации; **SOURCE** — просмотр кода; **FIXTURE** — исполнение с подменённым транспортом; **LIVE-READ** — read-only production. **PASS-RC нигде не выставлен**: релизной реализации нового дизайна ещё нет.

## Уровни доказательства

1. Source contract/regex: нужный обработчик/элемент существует, не доказывает поведение.
2. Component/service fixture: логика на synthetic входах, не RLS/реальная БД.
3. Real staging HTTP+SQL+Storage: независимые A/B, реальные constraints/concurrency/storage; не поведение физического WebView.
4. RC browser/device UX: визуал, поля, keyboard/back/reload, память пользователя о контексте.
5. Canary/production: конкретные aliases/revision/flags/проверенные user journeys и отсутствие стоп-сигналов.

Предыдущие 158 тестов относятся к PR29 и предыдущей реализации, 48 layout-проверок — к локальному прототипу. Не складывать их в «206 проверок релиза».

## Набор сквозных проверок (все пока SPEC для нового релиза)

| ID | Задача и ветки | Ожидаемое доказательство | Покрывает |
|---|---|---|---|
| A-01 | Telegram cold start, expired session, browser guest, auth restoration | Auth result + правильный petId; нет private data в guest; retry возвращает нужный draft | SYS-01/02/03, HOME |
| A-02 | Создать собаку, ответ потерян, повтор; переключить A1→A2 во время загрузки | Один petId, поздний ответ не перезаписывает A2; нет случайного active pet | SYS-02/03 |
| A-03 | «Хочу отметить состояние» и текст с фактом из четырёх входов | Одна форма, blank vs prefilled корректны; source/eventTime сохранены | OBS-01/04, HOME-01 |
| A-04 | Ввести текст, открыть показатели, неверная дата, keyboard, назад/выйти | Нет вынужденных «нормальных» показателей; dirty draft не теряется молча | OBS-01/04, B-04/06 |
| A-05 | Запись: отказ до commit, после insert, после commit, два одинаковых запроса одновременно | Ноль либо один domain ID, устойчивый replay receipt; изменённый payload409; counter до/после | OBS-04, F-01 |
| A-06 | Голос: denied/unsupported/silence/limit/429/network; распознанный кандидат подтвердить/отклонить | Микрофон реально остановлен; ручной ввод доступен; непроверенное не сохранено как факт | OBS-02/03 |
| A-07 | Запись после reload, глубокого входа, через историю за пределами первой страницы | Тот же ID; correct observedAt timezone; back восстанавливает выбор/scroll | OBS-05/07 |
| A-08 | Edit/delete/restore; другое устройство изменило/удалило запись | Нет resurrection/duplicate; clear conflict/expired restore; actor owner | OBS-05/06 |
| A-09 | Создать дело с exact/flexible/approximate, повтор; исправить дату/период | Формы новой системы, контракт времени очевиден; сохранённые данные совпадают | CARE-01/02 |
| A-10 | Дважды завершить повторное дело, перенести, удалить, открыть историю | Одна отметка и один следующий повтор; series/current semantics; delivery OFF не обещает уведомление | CARE-03/04/05 |
| A-11 | Привычка daily/weekly, граница периода, повтор отметки, edit/archive | Target/checkins согласованы после reload, error не считается выполнением | HAB-01/02/03 |
| A-12 | Карта без геолокации, с denied/manual; search empty vs error vs quota | Можно выбрать район; поздний результат не перезаписывает новый query; attribution/приватность сохранены | MAP-01/02 |
| A-13 | Место → save; два устройства меняют подборку с общим местом | CAS конфликт/replay не теряет другое изменение; map/list совпадают; duplicate save idempotent | MAP-03/04 |
| A-14 | Две остановки из подборки + точка карты; reorder/remove/undo; calculation fail | Один черновик; stale line помечена; manual vs calculated честны; source names/IDs сохранены | MAP-05/06 |
| A-15 | Запись прогулки: background, pause, stale GPS, пропуск сигнала, reload | Нет выдуманного соединения gap, сохранён корректный duration/source; незавершённое восстанавливается по контракту | MAP-07 |
| A-16 | Route save response lost → reload → edit → GPX/share/revoke/delete | Один ID; same geometry/stop order/gaps; old link реально недоступен после revoke | MAP-08/09 |
| A-17 | Создать опасную зону/место, изменить visibility, удалить/undo | Точка/радиус верны; публичная проекция не раскрывает private/coarse data | MAP-10 |
| A-18 | Гав оба режима, район denied/manual, анкета без фото/с разными фото, swipe/scroll | CTA доступен; swipe не отправляет; empty filtered != error; состояние сбоя не теряет старую выдачу | GAV-01/02/04 |
| A-19 | Свой сигнал → duplicate publish → edit/expire/complete/cancel | Один активный сигнал, время/радиус проверены сервером; истёкший не выглядит активным | GAV-03 |
| A-20 | Анкета publish/hide; A→B request; A пытается принять свой request; B принимает/отклоняет | Только допустимые actor transitions; reject/cancel/expired/closed отображаются; no self acceptance | GAV-05/06 |
| A-21 | Invite self/expired/gone; missing verified contact; block/report/retry | Нет private contact до допуска; Block немедленно ограничивает связь/предложения | GAV-07/08 |
| A-22 | Accepted connection → own source preview → changed source → send; retry | Fingerprint mismatch409; повтор одного ID не дублирует; R1 не показывает «место согласовано» | GAV-09 |
| A-23 | Документ MIME/size/cancel, upload response loss, metadata fault, expired URL, delete midway | Lifecycle исправляется; no orphan visible item/duplicate; A/B deny; no raw signed URL в логах | DOC-01/02/03 |
| A-24 | Паспорт/характер изменять на двух устройствах; fault after one table update | Atomic outcome или domain-specific success, optimistic conflict, private не публикуется | PRO-01/02 |
| A-25 | Фото portrait/landscape/square/HEIC/no-image/broken; generation fail; activate/rollback | Существующее активное фото не теряется; согласие/flags; приватный оригинал не публичен | PRO-03 |
| A-26 | Публичная карточка: whitelist preview/publish/revoke; anonymous direct link | Нет private fields в HTML/API/metadata; отозванный доступ действительно закрыт | PRO-04, SYS-06 |
| A-27 | Покупка без даты, с явным планом, edit/bought/delete/restore и связь с делом | Без даты нет reminder; связанная команда атомарна, no duplicate; связи сохраняются/разрываются явно | WISH-01/02/03 |
| A-28 | Settings/logout/delete account/delete pet/remove local | Разный scope, confirmations, partial cleanup retry; старые cookies/URLs не дают удалённые данные | SYS-04/05 |
| A-29 | Все старые hashes, tab/back/browser/Telegram, public/admin/design-v3/support/legal | Нет бесконтрольного legacy form, deep links mapped; admin отдельно; no giant blanket redirect | SYS-06/07/08, B-04/06 |
| A-30 | Все 69 API: anonymous/A/B/A1/A2, invalid Origin, mismatched session/bearer, deleted IDs | Чужие ресурсы не доступны и не меняются; явный N/A для public/health/cron, а не пропуск | B-07 |
| A-31 | R2 proposal accepted/rejected/withdrawn/superseded и конкурентный ответ | Один результат, version+actor+pair validated; время отдельно | GAV-10 — deferred R2 |
| A-32 | R3 actual source query, save result, cancel race, edit/forget/reingest, quota | Actual provider evidence + SQL + UI, no paid fallback; deleted preference не восстанавливается | AGT-01/02/03 — deferred R3 |
| A-33 | Rollback new RC→old→new after saving real staging objects | Additive data читаются в обе стороны, auth/flags/aliases соответствуют; no DB rollback destruction | B-11 |

## Формы, промежуточные и конечные состояния — общий обязательный набор

Для каждой строки 02-SURFACES: first use, empty, populated; invalid/valid/dirty; saving; success (что и где сохранено); definite failure; unknown result; retry; concurrent edit; no permission; deleted/unavailable; cancellation/unsaved exit; reopen/reload. Фокус/клавиатура и основной CTA проверяются не только на чистой форме. Пустая выдача, истёкшая сессия и ошибка сервера — разные состояния.

Конечный экран не обязан быть отдельной страницей «Готово»: допустимо состояние того же объекта. Но результат должен быть видимым, стабильным и доступным после возврата; transient toast недостаточен.

## Визуальная приёмка

Матрица viewport: 320/390/430px + desktop; keyboard open/closed; 200% zoom; длинное имя/текст/ошибка; portrait/landscape фото; без blur; reduced motion. Physical Telegram: iOS и Android, BackButton/keyboard/safe-area, повторный запуск и обновление старого WebView. Это отдельные пункты отчёта; эмуляция браузера не помечается физическим устройством.

Дизайн сверяется с NarisovanniySANS-концептом: воздух вокруг связанной группы, не дыра посередине; читаемые поля; единый материал кнопок; отсутствие розовой заливки/старого сине-зелёного слоя; нет одинаковых карточек на все сущности. Не скрывать незавершённые разделы ради красивого screenshot.

## Формат доказательства на каждый PASS-RC

`testId, surfaceId, releaseSHA, environment, ownerFixtureScope, device/browser, preconditions, steps, expected, observed, evidencePath, performedAt, status, knownLimits`.

В artefact можно сохранять synthetic entityId/requestId. Не сохранять private owner data, cookies/initData, ключи или пользовательский текст. Отчёт проверок и исходник должны относиться к одной версии.
