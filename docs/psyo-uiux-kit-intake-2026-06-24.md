# Псё — UI/UX Kit Intake

Source: `psyo_frontend_uiux_kit---9ceaebe5-9bbb-473a-8323-fc34601f9b15.md`, received 2026-06-24.

## Intake stance

The kit is a design and product-reference source, not an executable migration plan.

Current DB, entities, API boundaries, auth/privacy rules, and project-level `AGENTS.md` stay authoritative. Visual guidance can be adapted directly. Scenario, persistence, dependency, or data-model differences become backlog tasks before implementation.

## Design brief

Surface: Telegram Mini App / mobile web.
Audience: dog owners who need a calm, useful pet companion in Telegram.
Job: create a trusted dog profile/passport, support daily care, and open monetizable actions.
Mood: Warm Companion / Calm Operating System.
Density: balanced, mobile-first.
Risk: production-facing; privacy and payment implications.
Proof: build, QA gates, mobile screenshots, and service-contract review.

## Adopt Now

- Cream/mint art direction, soft glass, tactile surfaces, calmer botanical gradients.
- Stronger design tokens for color, radii, shadow, motion, and semantic status colors.
- Motion stance: tap feedback, screen enter, list stagger, bottom-sheet spring, reduced-motion required.
- Telegram haptics mapping for buttons, tabs, save, error, and presence actions.
- Five-state screen discipline: loading, empty, content, error, permission required.
- Public-card privacy rules: no exact address, owner phone, precise geo, chip, vet clinic, or full medical history by default.
- Performance rules: lazy map, no map on main, avoid heavy infinite blur/shadow animation.
- Copy tone: warm, short, useful, no bureaucracy, no excessive pet baby-talk.

## Adapt To Current App

Current app has:

- Next.js App Router under `app/`, not `src/app`.
- CSS token system in `app/globals.css`, not Tailwind.
- Leaflet map, not MapLibre.
- Existing service contracts: `ProfileService`, `TodayService`, `ReminderService`, `AssistantService`, `AvatarService`, `MapZoneService`, `WishlistService`, `ReadinessService`.
- Existing DB/entity frame: `Pet`, `PetPassport`, `SocialProfile`, `Reminder`, `ReminderEvent`, `MapZone`, `WishlistItem`, future `AssistantThread`, future `PublicDogCard`.

Recommended adaptation:

- Fold kit colors into current CSS variables instead of switching to Tailwind.
- Build local component slices only where they reduce complexity; do not introduce shadcn/Radix/Motion as a broad rewrite.
- Keep Leaflet for MVP unless map requirements exceed current implementation.
- Translate kit screens to current tabs:
  - Registration / знакомство -> existing onboarding.
  - Главный -> current Today.
  - Профиль питомца -> current Profile.
  - Карта -> current Map.
  - Вопросы и ответы -> current `nearby`/assistant decision is unresolved and should be product-backlogged.
  - Заметки -> new scenario, backlog.
  - Публичная карточка -> existing `/dog/[slug]` / print/share route.

## Scenario Differences To Backlog

These should not be silently implemented as UI-only changes:

1. Notes as a first-class screen/entity.
   - Current closest state: health notes and completed reminders.
   - Needed: `Note` or `PetHistory` entity, list/create/update/delete API, privacy policy, UI route/tab decision.

2. Mood / daily metrics.
   - Kit mentions mood, food, water, walk minutes.
   - Current DB does not have `PetHistory` / daily metric records.
   - Needed: daily history entity, enum/status model, retention rules.

3. Q&A / assistant as catalog + persisted answers.
   - Current app has assistant route and future thread/message schema.
   - Kit implies searchable categories and reusable Q&A content.
   - Needed: decide if this is assistant chat, FAQ content, or both.

4. Map marker model.
   - Kit uses `MapMarker` types: safe, danger, place, dog_area.
   - Current DB uses `MapZone` types: home_area, walk_route, safe_place, risk_zone, clinic, shop, grooming.
   - Needed: mapping table or enum expansion if public/community markers appear.

5. Public community / local nearby dog layer.
   - Kit mentions local community; current `nearby` is a UI placeholder.
   - Needed: presence entity, privacy model, approximate location policy, matching/invite workflow.

6. Payments / Plus subscription.
   - Kit does not define payment entities.
   - Needed: product package, entitlement model, Telegram Stars invoice flow, subscription state, refund/expiration handling.

7. QR / physical tag flow.
   - Current share/print exists; no order/payment/logistics.
   - Needed: digital premium passport first; physical tag later as partner/payment flow.

## Dependency Differences

Do not install without explicit approval:

- Tailwind CSS / shadcn/ui / Radix broad migration.
- `motion`.
- `@telegram-apps/sdk-react`.
- TanStack Query, Zustand, React Hook Form, Zod.
- MapLibre / react-map-gl replacement.
- Vercel Analytics/Speed Insights.

Reason: current stack is intentionally smaller; dependencies change bundle, design architecture, QA surface, and maintenance cost.

## First Safe Implementation Slices

1. Token alignment
   - Update current CSS variables toward cream/mint/botanical tokens.
   - Keep existing app structure.
   - Verify: `npm run qa:local` + mobile screenshots.

2. Component surface cleanup
   - Normalize `SoftCard`, bottom nav, button, chips, empty/error states inside current CSS.
   - No new dependency.

3. Motion/haptics wrapper
   - Add tiny local haptic helper using existing `window.Telegram.WebApp`.
   - Add CSS-only pressed states and reduced-motion checks.

4. Public card privacy hardening
   - Turn kit privacy rules into QA checks for public-card copy/data.

5. Monetization UX skeleton
   - Add non-payment UI only: premium passport/Plus teaser and entitlement copy.
   - Payment API implementation waits for explicit product/payment decision.

## Immediate Non-Goals

- Full folder restructure to `src/`.
- Tailwind/shadcn rewrite.
- MapLibre migration.
- New DB entities before backlog review.
- Actual Telegram Stars payments before package/entitlement design.
- Public nearby/community persistence before privacy design.

