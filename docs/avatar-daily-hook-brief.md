# Псё — avatar daily hook pivot

## Core insight

Daily hook is not tracking. The hook is: **beautifully digitize my own dog and let that avatar live in the app/world**.

The user uploads dog photos from several angles and gets a stylish digital version of the dog. This becomes the persistent identity layer for:

- map presence;
- social discovery;
- dog profile card;
- care/reminders;
- clinics/telemedicine;
- future monetization via avatar styles/settings/animations.

## Product frame

Псё becomes a **digital twin + playful city layer for dogs**, closer to Pokémon Go / Bitmoji / Tamagotchi / social map than a health tracker.

The emotional reason to return:

> “My dog has a cool living avatar, it appears on the map, I can style it, show it, and use it as the center of dog life.”

## MVP reality check

Real 3D reconstruction from a few dog photos is expensive and risky for v0. For web MVP, fake the magic first:

1. Upload 3–5 photos.
2. Show generation flow: “сканируем мордочку”, “собираем окрас”, “готовим аватар”.
3. Produce a stylized avatar card using placeholder/generated assets or selectable dog archetypes.
4. Let user choose style/setting:
   - city walk;
   - neon park;
   - winter coat;
   - space dog;
   - sticker mode.
5. Spawn that avatar on the fake map.

## Vercel MVP v4 scope

- Photo upload UI, local preview only.
- Avatar generation fake/prototype state.
- Avatar style selector.
- Public avatar card preview.
- Map spawn card: dog avatar appears in nearby route/map.
- Dog profile becomes avatar-first, not form-first.

## Out of scope for v4

- True 3D reconstruction.
- Real ML pipeline.
- Real AR/Pokémon Go mechanics.
- Marketplace.
- Vet/telemedicine implementation.

## Product architecture later

Layer 1: Avatar creation and identity.
Layer 2: Map spawn / walk presence.
Layer 3: Public dog card and social discovery.
Layer 4: Care/reminders/clinics as utility around the avatar.
Layer 5: Premium styles, animations, seasonal packs.

## Design implication

The app should feel like:

- “I made my dog into a character”;
- “my dog is on the city map”;
- “this is stylish enough to share”.

Not like:

- health tracker;
- vet CRM;
- diary form;
- generic pet app.
