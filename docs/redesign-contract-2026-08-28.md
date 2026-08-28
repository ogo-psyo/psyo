# Псё: контракт коррекции редизайна — 2026-08-28

## Цель

Собрать один service-wired интерфейс по цепочке:

`Ploof reference → два утверждённых макета Псё → production-сущности и сценарии`.

`/design-v3` и flat beige `editorial.css` не являются визуальным авторитетом.
Production не меняется без отдельного подтверждения владельца.

## Терминальное условие

- пять основных разделов выглядят и работают как одна система;
- все отображаемые данные либо сохраняются через канонический сервис, либо явно
  обозначены как локальный черновик;
- нет недостижимых mobile-only/desktop-only продуктовых действий;
- основные сценарии имеют normal, empty, loading, error, permission и recovery
  состояния по смыслу соответствующей сущности;
- `npm run qa:local`, focused scenario tests, 320/390 mobile и desktop visual smoke
  проходят на отдельном preview;
- production не затронут.

## Визуальный авторитет

1. Ploof/1st-Pouf — материальность, округлая типографика, крупные цветовые поля.
2. Мятный макет Псё — спокойные вторичные карточки и cushion-depth.
3. Салатовый editorial-макет Псё — композиция Today, сильная иерархия и один CTA.
4. `PRODUCT.md`, сервисные контракты и текущая инфомодель — фактический контент,
   приватность, lifecycle и честность состояний.

## Единая визуальная система

- canvas `#F4FFF7`;
- surface `#FAFFFB`;
- mint `#CBFEDB`;
- selected mint `#B6FDCD`;
- care signal `#3DF881`;
- action `#07814D`;
- ink `#06472F`;
- destructive/error `#DD617C`.

Russo One используется для `Псё`, короткого screen title и одного focal headline.
Nunito используется для body, labels, controls и navigation. Lime обозначает
ближайшее действие, active navigation и success. Coral не является декором.

## Канонический граф поверхностей

### Primary navigation

`Всё / Псё / Карта / Гав / Вещи`.

### Вторичные поверхности

- Всё → первое/ближайшее дело, план заботы, наблюдение, ассистент, история;
- Псё → профиль, образ, постоянные факты, документы, здоровье, привычки,
  памятка, privacy/settings/legal/support;
- Карта → просмотр, прогулка, маршрут, опасность, сохранённое, share/revoke;
- Гав → live, знакомство, анкета, запросы, приглашение, report/block;
- Вещи → список, добавление, bought/not suitable, delete/restore;
- Ассистент — один глобальный sheet, а не отдельный параллельный экран.

Любая вторичная поверхность обязана иметь mobile entry point, Back и сохранение
подтверждённых данных.

## Канонический словарь

- `Pet` → собака;
- `Reminder` → дело в плане;
- `ReminderEvent` → история дела;
- `PetObservation` → наблюдение;
- `PetHabit` → привычка (повторяемое действие);
- стабильные особенности поведения → характер/правила общения, не привычки;
- `WishlistItem` → вещь;
- `PublicDogCard` → памятка;
- `SocialDiscoveryProfile` → видимость в Гав;
- `WalkSignal` → Гав на прогулку;
- `MapZone` → место/опасность;
- `MapRoute` → маршрут.

## P0 закрытия до preview

1. Убрать конфликт тем: один token/component layer без каскада `!important`.
2. Empty Today предлагает добавить первое дело, а не сообщает о завершении.
3. Вернуть mobile-доступ к плану, памятке, privacy/settings/legal/support и
   destructive flows.
4. Один активный Profile, Assistant, Nearby и Health flow; удалить мёртвые
   render branches после переноса нужных действий.
5. Social invite завершается в активном Гав flow.
6. Не обещать persistence полям, которых нет в `ProfileService`; неизвестные enum
   не отправляются серверу.
7. Все mutable drafts и map-route storage изолированы по `petId`.
8. Bootstrap не возвращает soft-deleted observations.
9. Убрать health/product рекомендации, которые не принадлежат проверенному
   knowledge-service.
10. Добавить reachability и multi-dog isolation в обязательный QA-контур.

## Отдельный domain backlog

Эти пункты нельзя выдавать за design-only исправление:

- round-trip для дополнительных полей профиля либо их окончательное исключение;
- edit/archive lifecycle привычек;
- канонический контракт Social Discovery и Map Route services;
- recoverability policy для routes/documents;
- guest → authenticated migration;
- server-owned публичная памятка без зависимости от local-only полей.

До реализации backlog интерфейс должен честно скрывать или маркировать
недоступное действие, а не имитировать готовность.

## Acceptance gate

- 320/390: empty activation, Today, профиль, план, карта, Гав, вещи, памятка,
  settings/legal/support доступны без deep link;
- один главный CTA на экран;
- profile save → reload сохраняет каждое отображаемое persisted-поле;
- Dog A draft/map route не появляется у Dog B;
- social invite: valid/expired/error/accept/reject;
- assistant error виден внутри sheet, success только после успешной mutation;
- browser Back закрывает sheet/detail либо возвращает на parent;
- automated crawl не находит недостижимые или дублирующие активные реализации;
- visual side-by-side выполняется с двумя утверждёнными макетами, не с
  `/design-v3`.
