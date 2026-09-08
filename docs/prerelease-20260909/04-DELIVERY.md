# План реализации, DoR/DoD и выпуск

Это подготовленный backlog, а не выполненная реализация. Ответственный исполнитель по умолчанию — разработчик/агент Псё; приёмка визуального направления — Руслан, техническая — QA-артефакты ниже. Указание ролей не означает, что отдельные люди/агенты уже назначены. Оценки в днях без технического разбора исправлений не обещаем.

## Очерёдность

```
S0: baseline + схема/бэкап + staging
  → S1: атомарность наблюдения/профиля, lifecycle файлов, auth regression
  → S2: общие UI/route-контракты + полный проход наблюдения
  → S3: профиль/документы/уход/привычки/покупки
  → S4: карта/запись/подборки + оба режима Гав/внутренние связи
  → S5: все входы/состояния RC + владелец canary
  → S6: R1 обновлённый сервис поверх действующих возможностей

R2 отдельно: подтверждение предложений места.
R3 отдельно: live agent/search/background work/memory PR29.
```

Разработка ведётся вертикальными срезами. **Полная новая навигация для обычных пользователей не включается, пока из неё достижима старая/недоведённая форма.** Срезы можно проверять локально/staging. Canary целого нового сервиса — после общего интеграционного gate. Если допускается отдельный ранний сценарный выпуск, флаг охватывает всю его цепочку, включая альтернативные входы и результаты; не переключает версию посреди задачи.

Существующие защитные backend-исправления можно поставлять отдельно от оформления после собственной приёмки. Этот документ не запускает ни такой выпуск, ни migration.

## Карточки работ

### B-00 · Baseline и изолированная приёмка — S0

**Ценность:** проверяем один конкретный релиз и умеем вернуться.
**DoR:** c15d067 на обоих aliases подтверждён; PR29 отдельно; согласован список 59 семейств. Источники: `evidence/production-baseline.json`, `02-SURFACES.md`.
**Работа:** зафиксировать immutable deployment id и фактический Telegram menu/main-app URL; снять deployed schema/migration ledger; получить свежий backup БД+Storage и проверить восстановление; изолировать staging, synthetic A/B/A1/A2, выключить отправки/платные провайдеры; отдельные allowed origins.
**DoD:** restore log+checksums/счётчики без приватных строк, staging не пишет в prod, при выключенных провайдерах нет egress, rollback target реально доступен. Не использовать старый receipt как свежий без сверки.
**Проверка:** read-only release/health; SQL/Storage restore в изоляции; тест происхождения запросов. **Зависимости:** нет. **Граница:** никаких секретов в отчёте.

### B-01 · Атомарное наблюдение — S1, блокер

**Ценность:** повтор после сбоя не дублирует/не теряет запись.
**DoR:** F-01 воспроизведён; известны схемы care_mutations/pet_observations, manual note и structured voice paths. API/UI контракт сохранения определён.
**Работа:** объединить mutation receipt и изменение observation атомарным DB command; стабилизировать eventTime/requestId; разобрать create/update/delete/restore и invalid-key cleanup, не только happy-path POST. Voice batch RPC сохранить и проверить совместимость.
**DoD:** injected failure до commit → ноль записей; после commit → повтор возвращает прежний ID/версию; одновременные повторы → один результат; другой payload с тем же ключом →409 без записи; другой owner/pet denied. Удаление и восстановление не теряют receipt. UI сохраняет черновик.
**Проверка:** существующий repro как characterization + новый real Postgres failure/concurrency test, API через две сессии, reload. **Файлы:** `app/api/observations/**`, `lib/server/careHttp.ts`, additive migration/tests, page capture handlers. **Зависимость:** B-00. **Non-goal:** качество распознавания/модели.

### B-02 · Цельное обновление профиля — S1, блокер

**DoR:** определены изменяемые домены и поля, pet ownership, версии, различие private/social discovery; F-02 source trace.
**Работа:** атомарное обновление pets/passport/social либо независимые narrow commands с честным scope; optimistic concurrency; не отправлять полный устаревший профиль при изменении одного поля.
**DoD:** отказ на любом шаге не оставляет частично обновлённый профиль; stale version не затирает другое устройство; после reload значения одинаковы; private change не публикуется автоматически; create idempotency остаётся рабочей.
**Проверка:** SQL failure после pet и после passport; две вкладки/устройства; private/public projection. **Файлы:** profileService, `/api/pets`, profile client/workspace, migration. **Зависимость:** B-00. **Non-goal:** новое совместное владение собакой.

### B-03 · Документ: загрузка, просмотр, удаление — S1/S3, блокер

**DoR:** 4MB/MIME/private bucket и 60s signed URL сверены; задан lifetime operation и политика восстановления файла.
**Работа:** operationId и pending/ready/deleting/failed; устойчивый upload retry; metadata/object consistency; cleanup/reconciliation; открытие с обновлением expired URL; подтверждение удаления и ясное завершение.
**DoD:** разрыв после upload/metadata/Storage delete/DB delete воспроизводится и восстанавливается без duplicate/orphan visible record; 413/415/401/404/503 честны; только owner читает; ссылка не становится постоянным публичным URL; нет обещания отмены необратимого удаления.
**Проверка:** staging Postgres+Storage fault injection, подпись URL и expiry, cross-owner, двойная отправка. **Файлы:** `/api/documents/**`, petDocumentService, DocumentSheet/viewer, operation schema/worker при необходимости. **Зависимость:** B-00. **Non-goal:** OCR/ИИ-разбор содержимого.

### B-04 · Навигация и единый черновик — S2

**DoR:** `01-SERVICE.md` принят как рабочая спецификация; каждому объекту задан дом; старые hashes/deep links перечислены; entityId/requestId/return route определены.
**Работа:** route/view-model adapter, pet-scoped draft, back Telegram/browser/in-app, restore list/camera, active route. Псё может передать исходный текст в настоящий ввод наблюдения; unsupported intent не выдаёт fake результат. Покупка по умолчанию без скрытого дела.
**DoD:** каждый вход открывает один editor/detail; назад возвращает источник и фокус; reload открывает ID; смена pet/login не смешивает данные; late responses отбрасываются; dirty exit предсказуем. Старые поддержанные hashes ведут в соответствующий новый экран, не в мёртвую форму.
**Проверка:** переходная таблица всех SYS/HOME/OBS/WISH входов + Playwright + physical Telegram. **Файлы:** app/page, AppNavigation, capture/profile/journey components. **Зависимости:** B-01/02 contracts, B-06 primitives. **Non-goal:** переписывать все API адреса.

### B-05 · История и результат по ID — S2/S3

**DoR:** различены observationTime/createdTime, типы событий, pagination/search semantics и «запись недоступна».
**Работа:** одна история с typed links; loader/detail по ID; подгрузка/поиск за пределами первых12/20; document/reminder ссылки сохраняют тип и origin.
**DoD:** запись за пределами первой страницы находится и открывается; back сохраняет фильтр/дату/scroll; удалённая/чужая запись не превращается в пустую новую форму; eventTime не съезжает при timezone boundary.
**Проверка:** >100 synthetic записей, старые dates, A1/A2, unowned/deleted ID, reload. **Файлы:** healthTimelineService, observations reads, ProfileMemoryWorkspace, HealthTimelineScreen. **Зависимости:** B-01/B-04. **Non-goal:** сливать доменные данные в одну новую таблицу истории.

### B-06 · Дизайн-система и полное покрытие форм — S2–S4

**DoR:** выбран NarisovanniySANS и grouped main; доказательство commercial web embedding; реальные ограничения фото/полей/данных; 59 строк реестра.
**Работа:** токены/шрифты/контролы/ошибки/results/confirm/empty; scoped theme; перенос всех R1 форм и статусов, а не слой CSS над старой композицией. Паспорт/документ/карта имеют разные представления при общей навигации.
**DoD:** каждое R1 семейство имеет все применимые состояния и screenshot evidence; нет старого Watercolor/legacy editor из нового входа; основной CTA доступен; 320/390/430 + desktop, long strings, 200% zoom, клавиатура/safe-area, no-blur fallback/reduced-motion; обычные фото portrait/landscape/square/no-image/broken. Привычки и settings не забыты.
**Проверка:** 02 реестр → RC screenshot manifest + keyboard walkthrough, сравнение утверждённой композиции. **Файлы:** app/layout/CSS, components/ui/* и целевые экраны. **Зависимости:** согласованные контракты B-04/B-05, не завершение их реализации. Сначала общие примитивы B-06, затем интеграция B-04/B-05, затем полное визуальное покрытие B-06. **Non-goal:** ещё один глобальный override-файл или массовый rewrite backend.

### B-07 · Auth, privacy и доменные мутации — S1–S5

**DoR:** 69 endpoint inventory сгруппирован по service; deployed schema/RLS получены; синтетические identity fixtures, no real external sends.
**Работа:** согласовать bearer/session mismatch policy; IDOR для A/B, pet separation; RLS и service-role filters, invalid-origin/expired auth; публичные projection, block/revoke; namespace guest и cache. Проверить races не только повтор кнопки.
**DoD:** no unauthorized reads/writes; несанкционированный запрос не меняет счётчики данных; публичные страницы не содержат приватные поля даже в HTML; source/provider errors не утечка секретов; actor роли серверные. Все private APIs покрыты матрицей либо явным N/A.
**Проверка:** real staging HTTP+SQL, не regex. **Файлы:** auth/session helpers, API/service policies, SQL tests. **Зависимость:** B-00. **Stop:** любая доказанная cross-owner утечка/запись блокирует выпуск.

### B-08 · Подтверждение места вторым владельцем — R2, не R1

**DoR:** решены статусы proposed/accepted/rejected/withdrawn/superseded; actor permissions; связь snapshot/version; что делать при изменении source/блокировке/закрытии знакомства. Время встречи отдельно, не подразумевается принятием точки.
**Работа:** additive entity lifecycle/API; compare-and-set переходы и audit actor; UI предложено/согласовано/отклонено/изменено.
**DoD:** автор не принимает своё предложение; B принимает только видимую неизменённую версию; повтор/гонка reject/accept имеют один исход; блокировка/изменение источника не оставляет ложную договорённость; обе стороны видят одинаковый state после reload.
**Проверка:** две реальные staging-сессии, SQL concurrency, stale version. **Зависимости:** B-07, существующий meeting proposal. **R1:** окончание «предложение отправлено» работает без этой задачи.

### B-09 · Агент, результаты и память — R3, не R1

**DoR:** gate из PR29: Groq Free + search entitlement подтверждены, foundation migration/recovery/cloud tests пройдены, бюджет/провайдер в разрешённых границах. Источник факта и semantics forget определены.
**Работа:** подключить реальный bounded agent к общей навигации; список фактов/источников, edit/forget; результат save/reopen; graceful quota/cancel; текущие ручные пути всегда доступны.
**DoD:** live fictional query → actual source → explicit save → reopen; два владельца изолированы; cancellation не пишет позже; memory correction/reingestion не воскрешает forgotten; no paid fallback; no fabricated sources; source refresh сохраняет прошлую хорошую версию при ошибке.
**Проверка:** cloud Workflow + actual allowed provider + SQL + UI. **Зависимости:** отдельный PR29 и B-04/B-07. **Не блокирует R1**, если новый агент/память не обещаны и не включены.

### B-10 · Пакет доказательств RC — S5

**DoR:** все R1 slices реализованы в одной неизменяемой RC-сборке; перед QA нет неподтверждённых cherry-picks.
**Работа:** выполнить 05-ACCEPTANCE, qa:local/CI, real two-owner/storage tests, scripted layouts, iOS/Android Telegram. Каждый PASS с revision/command/fixture scope/result; source regex не DB proof.
**DoD:** у всех R1 строк реестра design + frontend + backend + privacy + return/error/reload evidence или согласованный N/A; нет незакрытых blockers, unexplained failures, смешанных старых форм. Любое исправление RC переоткрывает затронутые проверки.
**Зависимости:** B-01–07, B-11. **Non-goal:** выдавать число тестов за UX-приёмку.

### B-11 · Canary, наблюдаемость, rollback — S0/S5

**DoR:** immutable rollback target и действующие aliases verified; auth gate по owner серверный; совместимость схемы n/n-1 известна.
**Работа:** создать/проверить выключатель нового UI по серверно определённому owner, не `?qa=1`; default old until gates. Error/latency/mutation receipts в наблюдаемости без содержимого записей. Сценарный/глобальный kill switch и dual-alias rollback.
**DoD:** on/off не теряет auth/drafts/data, actor не подделывает cohort; old app читает новые additive records; выключение UI не выключает критическую сохранность backend; rollback прогнан в staging, flags и aliases возвращаются согласованно. У журнала ошибок есть проверенный способ чтения.
**Проверка:** staged rollback после создания новыми формами записи/маршрута/документа; снова новый релиз читает их. **Зависимости:** B-00/B-07. **Non-goal:** новый платёжный/notification rollout.

## Общие release gates

### R1 DoR

- Исходник и scope зафиксированы; PR29 не подмешан случайно.
- 59-семейный реестр принят как минимум охвата; у R1 заполнены источники/владельцы/критерии.
- Бэкап/restore/staging и лицензия шрифта готовы; миграции additive + reverse-compatibility reviewed.
- Backend contracts B-01/02/03/07 конкретны и проверяемы.

### R1 DoD / go-no-go

- Все B-01–07/10/11 закрыты требуемыми доказательствами. B-08/09 явно deferred, видимый R1 не обещает их результат.
- На release SHA проходят build/typechecks/tests/contracts/CI и настоящий staging acceptance, а не только historical QA.
- iPhone/Android Telegram: login, keyboard, back, photo, cold start, offline→retry, reload→same result. Если доступа к устройству нет — UNVERIFIED, не PASS.
- Нет ложных «Сохранено», дублей после retry, частично сохранённого профиля и ссылок на несуществующие файлы в проверенных сбоях.
- UI coverage не имеет reachable unknown/old form из новой оболочки. Browser old hashes/public routes проверены отдельно.

## Запуск и откат

1. Перед rollout повторно сверить source/flags/schema/backup; проверить Telegram URL, а не предполагать по имени Vercel alias.
2. Выполнить migrations только после restore/transaction tests; не переключать app до готовности schema.
3. Развернуть точный проверенный SHA, записать immutable deployment id и READY. Сначала server-authenticated owner cohort, не глобальный CSS toggle.
4. Пройти canary задачи реальным аккаунтом владельца с его обычными недеструктивными данными и synthetic test objects с известным cleanup. Не создавать real social sends ради smoke без отдельного явного действия.
5. После canary расширять доступ при отсутствии стоп-сигналов, сравнивая длительность основных операций с baseline на одинаковых условиях. Время наблюдения само по себе не PASS; важны пройденные сценарии и логи.
6. Проверить exact SHA и flags на **обоих** aliases и фактическом Telegram entry. Обновить ledger с результатами.

**Немедленный stop:** подтверждённая cross-owner видимость/запись, потеря или silent overwrite данных, ложный success/дубль при retry, невозможность входа/сохранения, приватное в public resource. Сначала выключить новый UI/cohort или вернуть app на сохранённый immutable deployment для всех aliases; backend safety fix откатывать только если это не возвращает дефект. Additive schema и новые пользовательские записи не удалять. Если старый app не совместим — заранее проверенный roll-forward/kill path, не `db reset`.

**Пока не выполнено:** новый feature switch/canary, свежая restore-проверка, deployed schema audit, physical QA и R1 реализация. Все они задачи, не существующая инфраструктура «по умолчанию».
