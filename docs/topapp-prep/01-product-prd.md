# PRD: Псё Top App — Avatar-first Digital Dog World

## 1. Summary

Псё должен перейти от утилитарного MVP к эмоциональному продукту: пользователь сначала создаёт аватар/героя своей собаки и получает эндорфиновый вау-момент, затем раскрывает приложение как цифровой мир собаки: забота, память, карта, друзья, клиники, магазины и сервисы.

## 2. Problem Statement

Владелец собаки любит конкретного друга, а не абстрактного “питомца”. Большинство pet-приложений стартуют с формы, календаря, медицинской анкеты или маркетплейса. Это полезно, но эмоционально плоско и легко заменяется заметками, календарём, картами и маркетплейсами.

Псё должно выигрывать за счёт связки:

- эмоциональная идентичность собаки;
- ежедневная практическая польза;
- локальный dog-specific мир;
- социальность и сервисы как расширение мира.

## 3. Goals / Success Criteria

### Goals

- Дать первый вау за 60–90 секунд: avatar/hero card.
- Показать, что Псё — не генератор картинок, а “мир собаки”.
- Перевести пользователя к первому полезному действию: факт, care-loop, место, вопрос.
- Подготовить архитектуру под analytics, avatar storage, guest migration, world/places, social, commerce.
- Сохранить no-auth first run.

### Success criteria

- `avatar_completed / onboarding_started >= 60%` в первых тестах.
- `hero_card_saved / avatar_completed >= 70%`.
- `first_quest_completed / hero_card_saved >= 45%`.
- D1 возвращение измеряется и не теряется из-за отсутствия auth.
- Все critical actions имеют события аналитики.
- Нет fake claims: “проверено”, “диагноз”, “live GPS” без реального процесса.

## 4. Non-Goals / Out of Scope

- Полный React Native rewrite.
- Public social graph.
- Live GPS tracking.
- Marketplace payments.
- Медицинские диагнозы.
- Автоматическая партнёрская сортировка клиник.
- External paid setup без отдельного подтверждения.

## 5. Users / Actors

- Владелец собаки, который эмоционально привязан к своему другу.
- Новый пользователь без аккаунта.
- Возвращающийся владелец, который хочет care reminders и карту.
- В будущем: клиника/магазин/грумер как partner actor.
- Оператор/модератор мест и отзывов.

## 6. User Stories

1. Как владелец, я хочу создать красивого героя своей собаки, чтобы почувствовать “это мой друг в приложении”.
2. Как владелец, я хочу начать без регистрации, чтобы не терять эмоциональный импульс.
3. Как владелец, я хочу выбрать стиль аватара, чтобы карточка отражала характер собаки.
4. Как владелец, я хочу после аватара увидеть “мир” собаки, чтобы понять масштаб приложения.
5. Как владелец, я хочу один первый квест, чтобы не утонуть в функциях.
6. Как владелец, я хочу Today с главным шагом дня, чтобы Псё помогал, а не требовал внимания.
7. Как владелец в новом районе, я хочу понять, где безопасно гулять и где клиника рядом.
8. Как владелец, я хочу найти совместимых друзей-собак без раскрытия точного адреса.
9. Как владелец, я хочу видеть товары/клиники по контексту заботы, а не рекламу.
10. Как пользователь, я хочу понимать, что мои фото, гео и здоровье собаки не используются небезопасно.

## 7. Proposed Solution

### Entry flow

1. Emotional landing inside app.
2. Photo upload or skip.
3. Style picker: Мультгерой / Игровая карточка / Стикер.
4. Generation waiting with narrative progress.
5. Hero card reveal.
6. Unlock cards: Забота / Карта / Друзья / Вещи.
7. First quest.

### Product layers

- Avatar-first identity is the first screen.
- Care OS is the daily utility core.
- World Map is dog-context spatial layer.
- Social is compatibility-first, not social feed-first.
- Commerce is trusted help, not advertising.

## 8. Requirements

### Functional

- Guest-first onboarding.
- Local persistence for hero/onboarding state.
- Event tracking wrapper.
- Avatar job abstraction even before async backend is implemented.
- Hero card model.
- First quest model.
- World unlock model.

### UX / Design

- No auth gate before first hero.
- No long form before reward.
- Fallback must preserve emotion.
- One dominant CTA per onboarding screen.
- Russian copy only.
- Touch targets >=44px.

### Data

- `guest_profile_id` or equivalent.
- `avatar_assets`, `avatar_jobs`.
- `dog_cards`.
- `analytics_events` or external analytics event map.
- Later: places, trust levels, friend compatibility.

### Operational

- PostHog/Sentry can be disabled safely when keys absent.
- No external provider is required for local dev.
- All generated assets must have owner/guest linkage before public sharing.

## 9. Implementation Notes / Decisions

- PWA remains canonical runtime now.
- Capacitor is preferred for TestFlight after activation loop is validated.
- Supabase remains backend; add migrations as draft first.
- Avoid provider lock-in for avatar generation: define `AvatarJob` contract.
- Keep guest mode, but design guest → account migration now.

## 10. Testing / Acceptance Criteria

- `npm run qa:local` passes.
- First-run flow can be completed without auth.
- User can get hero card with photo or skip.
- No UI copy says “Supabase”, “magic link”, “diagnose”, “verified clinic” without process.
- Analytics calls no-op without key.
- Privacy copy visible before photo/geolocation/social sharing.

## 11. Risks / Edge Cases

- Avatar generation latency/cost.
- Bad photo/fallback kills emotion.
- Guest data loss after login.
- Medical overclaiming.
- Location privacy.
- Commerce trust loss.
- App Store review rejects thin wrapper later.

## 12. Rollout / Migration

1. Implement local-only avatar-first flow.
2. Add analytics no-op wrapper + event taxonomy.
3. Add storage/job backend behind feature flag.
4. Add guest migration contract.
5. Add Capacitor only after web flow is stable.

## 13. Open Questions

- Which image provider is primary for avatar generation?
- Do we store original user photos or only generated assets?
- Which city/geography is first for curated places?
- What is the first App Store name/subtitle variant?
