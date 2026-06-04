# Mobile / App Store Plan

## Recommendation

Do not rewrite to React Native now.

Path:

1. **PWA-first** for product iteration.
2. **Capacitor shell** for TestFlight once avatar-first loop is stable.
3. **Expo/RN later** only if native-heavy scenarios are proven.

## Why

Current product direction is still evolving. Rewriting now would slow product discovery. But architecture must be App Store-aware now: guest identity, storage, push, privacy, analytics, crash reporting, native permissions.

## Capacitor readiness checklist

- No auth gate before first value.
- App safe areas tested.
- Camera/photo picker works.
- Share sheet for hero card.
- Push reminders.
- Deep links for dog card/invites.
- Offline/poor network states.
- Sentry/crash reporting.
- Privacy labels prepared.

## App Store requirements

- App icon.
- Screenshots: avatar, hero card, Today, World, Social/clinics.
- Preview video: avatar reveal → world unlock.
- Privacy policy.
- Terms.
- Medical disclaimer.
- Location usage copy.
- Photo usage copy.
- Push permission copy.
- Account deletion path once auth returns.

## Native value for review

If using Capacitor, avoid “thin wrapper” risk by including:

- camera/photo picker;
- share sheet;
- push reminders;
- haptic reveal;
- deep links.

## Not now

- background live location;
- payments;
- AR;
- public social feed;
- native rewrite.
