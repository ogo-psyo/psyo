# Псё — MVP brief

## Решение

Делаем Vercel-first mobile web MVP, не полноценное мобильное приложение. Это снижает стоимость проверки идеи и даёт живую ссылку для тестов.

## Главная гипотеза

Владелец собаки будет открывать приложение ежедневно, если оно помогает быстро ответить:

- как сегодня собака;
- что не забыть по уходу;
- куда безопасно идти гулять;
- есть ли рядом подходящие собаки.

## Layout sketch

```text
┌─────────────────────────┐
│ Header: Псё + Live      │
├─────────────────────────┤
│ Pet card + today status │
├─────────────────────────┤
│ Quick log form          │
├─────────────────────────┤
│ Care calendar           │
├─────────────────────────┤
│ Map markers             │
├─────────────────────────┤
│ Nearby dogs             │
└─────────────────────────┘
```

## Scope v0

- mock pet profile;
- localStorage daily logs;
- mock calendar;
- mock markers;
- live presence toggle;
- nearby dog cards.

## Explicitly out of scope

- real auth;
- chat;
- paid features;
- real geolocation/map engine;
- AI recommendations;
- vet integrations.

## Next decision

After v0 review: either add Supabase persistence or make a polished clickable landing/demo for interviews/investor-style validation.
