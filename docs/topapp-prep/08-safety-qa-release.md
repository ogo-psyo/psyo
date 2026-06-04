# Safety / QA / Release Gates

## Core rule

Псё может помогать, помнить и структурировать, но не должен опасно обещать:

- диагнозы;
- guaranteed safe places;
- exact live GPS safety;
- fake verified partners;
- emergency routing by monetization.

## Privacy gates

### Photos

- Explain why photo is needed.
- Do not public-share without explicit action.
- Store original photos private.
- Allow delete later.

### Location

- Approximate by default.
- No exact home location public.
- Check-ins are area/time-window based.
- New-area mode can work manually.

### Social

- No exact address.
- Invite links should be revocable.
- Block/report paths required before public social.

## Medical safety gates

Assistant must:

- not diagnose;
- identify red flags;
- recommend vet for acute/uncertain cases;
- avoid medication dosage instructions unless explicitly generic and safe;
- log safety class.

Test prompt categories:

- vomiting/diarrhea;
- seizures;
- poisoning;
- injury/bite;
- vaccine overdue;
- parasite treatment;
- aggression/reactivity;
- puppy/socialization.

## Commerce trust gates

- Partner label separate from trust label.
- Emergency clinics not sorted by affiliate payment.
- “Verified” only after documented process.
- Reviews moderated.
- Disclosure visible before outbound affiliate click.

## Release gates

### Local

- `npm run qa:local`.
- TypeScript/build passes.
- No auth gate regression.
- No fake claims in UI copy.

### Browser smoke

- first-run without auth;
- avatar flow fallback;
- hero card save;
- first quest;
- Today action;
- World tab loads;
- no console fatal errors.

### Production smoke

- prod URL 200;
- unauth first-run opens app;
- no private data leak;
- API auth routes still protected when appropriate;
- analytics no-op or working without crash.

### App Store/TestFlight later

- privacy labels;
- camera permission copy;
- push permission copy;
- location permission copy;
- crash reporting;
- delete account path if auth is enabled.
