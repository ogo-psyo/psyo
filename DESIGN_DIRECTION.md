# Псё — Design Direction

## Product thesis

**Лучший друг питомца и его владельца.**

Псё = всё про пса.

Это не анкета, не ветеринарная CRM, не магазин и не просто AI-чат. Это живой центр отношений между человеком и собакой: состояние, забота, память, прогулки, безопасность, вещи, вопросы и маленькие ежедневные действия.

## Core promise

> Открываешь Псё — и сразу понимаешь, как сегодня твоя собака, что важно не забыть, где ей безопасно, и что сделать дальше.

## Product personality

- Дружелюбный, но не сюсюкающий.
- Умный, но не холодный.
- Заботливый, но не тревожный.
- Живой, но не игрушечный.
- Полезный каждый день, а не только при проблеме.

## Design principle

**Companion-first, utility underneath.**

Первый слой — живая связь с собакой: имя, состояние, настроение, следующий заботливый шаг.
Второй слой — полезные системы: паспорт, карта, напоминания, ассистент, вещи.

## Primary UI hierarchy

1. **Dog status** — кто собака сегодня: имя, состояние, контекст дня.
2. **Next best care action** — один ближайший полезный шаг.
3. **Care map** — прогулки, зоны, места, безопасность.
4. **Memory/passport** — здоровье, привычки, заметки, история.
5. **Assistant** — объясняет поведение и помогает принять решение.
6. **Things/wishlist** — что купить/подготовить, когда это реально нужно.

## What to avoid

- Не делать из Псё сухую вет-карту.
- Не превращать в generic pastel pet app.
- Не делать всё вокруг AI-чата.
- Не начинать с магазина/commerce.
- Не перегружать владельца анкетами.
- Не делать “милоту” вместо пользы.

## Art direction target

Working direction:

**Living Field Guide**

A living working notebook about one dog, with:
- editorial utility and oversized, decisive hierarchy;
- an off-white paper base with black line and type;
- one focal care action instead of a dashboard of equal cards;
- semantic color fields: sage, lime, blue, lilac, coral, yellow and pink;
- simple line illustrations and real dog identity as the emotional layer;
- calm mobile composition and a true wide-screen workspace on desktop.

## Imported UI/UX kit alignment

The 2026-08-28 reference set defines the visual direction:

- Ploof warmth and pet-first illustrations;
- Auro air and restrained translucent utility where spatial context needs it;
- Habitz semantic colors;
- Hygge stacked information rows;
- Woset/Apollo typography and black line work;
- Bluf-scale bold gestures used only for focal states.

Use this as design language, not as a dependency mandate. Current DB/domain
contracts stay more important than reference-screen scenarios.

## Design sprint next slice

Redesign only the real Today screen first:

- app header;
- next care action;
- care loop/progress;
- map teaser;
- assistant teaser;
- bottom navigation.

Verification goal:

> If the Today screen does not feel like “лучший друг питомца и владельца”, do not proceed to the rest of the app.

## UX/UI design kit contract

Art direction: **Living Field Guide**. Псё говорит как спокойный помощник владельца, а не как админка, инженерный статус или витрина технологий.

Component rules:

- One primary action per surface. Secondary actions stay visually quieter.
- Bottom navigation keeps the full owner workspace visible: `Главная`, `План`, `Ассистент`, `Рядом`, `Карта`, `Памятка`, `Профиль`.
- Surfaces are flat paper fields with 18 to 28 px radii; shadows never carry hierarchy.
- Chips describe owner meaning: `уход`, `спокойно`, `примерное место`, not internal states or raw enums.
- Touch targets stay at least 44 px. Visual QA must fail on overflow and small controls.
- Public card copy never exposes exact address, raw status, database terms, debug labels or service names.

Copy rules:

- Use “Пиши, сокращай” discipline: short sentences, one thought per line, active verbs.
- Prefer owner language: `дело`, `план ухода`, `памятка`, `место`, `портрет`, `Демо без входа`.
- Do not show technical words in primary UI: `backend`, `Supabase`, `magic-link`, `payload`, `session`, `raw`, `DEMO`, `GPS`, `Avatar`.
- Error copy names the next step, not the implementation failure.
- Loading states use the ellipsis character: `Думаю…`, `Отправляю…`.
