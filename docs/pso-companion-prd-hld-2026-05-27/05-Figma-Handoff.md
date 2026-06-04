# Псё — Figma Handoff Structure

## 1. Figma file structure

Recommended pages:

1. `00 Product Thesis`
2. `01 PRD`
3. `02 HLD`
4. `03 Information Model`
5. `04 Screen-Service Map`
6. `05 Today Screen Slice`
7. `06 Components`
8. `07 States / QA`

## 2. Frames to create

### 00 Product Thesis

Frame: `Pso / Product Thesis`

Content:

- “Лучший друг питомца и его владельца”
- “Псё = всё про пса”
- core promise
- product personality
- what to avoid

### 01 PRD Summary

Frame: `PRD / Decision Summary`

Sections:

- Problem
- Goals
- Non-goals
- Primary users
- Core stories
- Acceptance criteria

### 02 HLD

Frame: `HLD / System Overview`

Diagram:

```text
User/iPhone → Next.js UI → API routes → Supabase/RLS
                  ↓             ↓
             localStorage   Assistant/Avatar providers
```

### 03 Information Model

Frame: `Information Model / ERD`

Major entity clusters:

- Owner/Profile
- Pet core
- Passport
- Social profile
- Care loop
- Map/places
- Wishlist
- Assistant
- Avatar/public card
- Future notification/partner systems

### 04 Screen-Service Map

Frame: `Screen-Service Map`

Rows:

- Onboarding
- Today
- Passport
- Assistant
- Map
- Things
- Public Card

Columns:

- Purpose
- Entities
- APIs/services
- States
- Risks

### 05 Today Screen Slice

Frame: `Today / Living Companion OS`

Components:

- Dog status card.
- Next care action.
- Care snapshot.
- Map teaser.
- Passport/memory teaser.
- Reminder groups.
- Assistant teaser.
- Bottom nav.

### 06 Components

Component set:

- `DogStatusCard`
- `NextCareAction`
- `CareMetricChip`
- `ReminderCard`
- `MapZoneCard`
- `PassportFactChip`
- `AssistantPromptCard`
- `WishlistItemCard`
- `PublicDogCard`
- `BottomNav`

### 07 States / QA

State frames:

- guest empty;
- incomplete profile;
- profile ready;
- overdue reminder;
- no zones;
- assistant missing context;
- health red flag;
- public card safe share.

## 3. Visual direction

Working art direction:

**Living Companion OS**

- warm iOS-native surfaces;
- dog identity first;
- soft but structured cards;
- no generic SaaS dashboard;
- no childish pet-game UI;
- no cold vet CRM.

## 4. Implementation handoff notes

Existing files:

- `app/page.tsx` — screen logic and tabs.
- `app/globals.css` — visual system.
- `components/GeneratedAvatar.tsx` — dog avatar.
- `components/LiveMap.tsx` — map.
- `lib/data.ts` — local dog profile taxonomy.
- `lib/domain.ts` — backend domain types.

Verification:

- `npm run check`
- `npm run qa:local`

Deployment:

- only with explicit approval.
