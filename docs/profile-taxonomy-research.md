# Profile taxonomy research — Псё

## Решение, которое улучшаем

Профиль питомца не должен быть огромной породной анкетой. Он должен поддерживать два сценария:

1. **эмоциональный вход** — аватар, имя, образ, карточка;
2. **долгий якорь владельца** — здоровье, поведение, рутина, документы, безопасное знакомство.

## Ключевой вывод

Порода важна, но не должна быть главным способом описания питомца. Рабочая структура профиля:

- **Identity** — имя, фото, порода/группа, внешний вид;
- **Body** — возраст/life stage, пол, размер, вес, шерсть;
- **Behavior** — темперамент, энергия, игра, обучаемость, триггеры;
- **Social compatibility** — дети, собаки, кошки, одиночество, как подходить;
- **Care / health** — вакцинация, паразиты, аллергии, лекарства, питание, следующая дата;
- **Documents** — микрочип, ветклиника, назначения/заметки;
- **Location privacy** — район/примерная зона, без точного GPS.

## Почему так

### 1. Пород много, поэтому нужен уровень “breed group”

- AKC группирует породы в 7 групп: Hound, Working, Sporting, Terrier, Toy, Non-Sporting, Herding.
- FCI использует 10 групп: shepherd/cattle, pinscher/schnauzer/molossian, terriers, dachshunds, spitz/primitive, scent hounds, pointing dogs, retrievers/flushing/water, companion/toy, sighthounds.

Для продукта лучше не копировать кинологическую классификацию буквально, а сделать UX-группы, понятные владельцу:

- Метис / не знаю;
- Мини / той;
- Компаньоны;
- Охотничьи / спортивные;
- Рабочие / охранные;
- Пастушьи;
- Терьеры;
- Гончие / борзые;
- Шпицы / примитивные.

**Confidence: medium-high.** Основано на официальных классификациях AKC/FCI, адаптировано под UX.

### 2. Health profile должен быть не “медкартой”, а memory layer

WSAVA выделяет core/non-core вакцинацию и рекомендует учитывать риск конкретного животного. AAHA life stage guidelines подчёркивают life stage + lifestyle risk assessment как основу профилактики.

Для MVP достаточно не медицинской детализации, а владельческих статусов:

- вакцинация: актуально / скоро нужно / просрочено / не знаю;
- обработка от паразитов: актуально / поставить напоминание / просрочено / не знаю;
- аллергии;
- лекарства;
- следующая дата;
- ветклиника;
- заметки для врача.

**Confidence: medium.** Это не ветеринарная система, но правильно отражает owner-facing профилактику.

### 3. Behavior важнее “темперамента породы”

Породные ожидания полезны как подсказка, но поведение конкретной собаки важнее: реакция на детей/собак/кошек, триггеры, одиночество, стиль игры. Это напрямую влияет на безопасность знакомства и ежедневную пользу.

**Confidence: medium.** Подтверждается ветеринарно-поведенческими источниками и здравым UX: социальная карта без таких полей рискованна.

## Продуктовая рекомендация

В UI не показывать всё как длинную анкету. Делать progressive disclosure:

1. **Hook flow:** фото → имя → группа породы → порода → стиль → avatar.
2. **Profile essentials:** возраст, размер, шерсть, короткое био, район.
3. **Anchors:** здоровье, поведение, рутина, документы.
4. **Later:** AI prompts и напоминания используют заполненные поля.

## Source notes

- AKC: breed groups and breed pages include group, personality, health, grooming and breed-standard context.
- FCI: official breed nomenclature lists 10 groups.
- WSAVA vaccination guidelines: core/non-core vaccination and risk-based recommendations.
- AAHA canine life stage guidelines: life stage and lifestyle/safety assessment as preventive-care frame.

## Implemented in v0.2

- Added `BreedGroupId` and expanded common breed catalog.
- Added profile categories: body, behavior, social compatibility, care/health, documents.
- Added anchor cards: Health, Behavior, Routine, Documents.
- Kept avatar hook first; deeper fields come after the visual reward.
