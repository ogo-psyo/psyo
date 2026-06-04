# HLD: Псё — High-Level Design

## 1. System Context

```text
User / iPhone / Browser
        ↓
Next.js App Router UI
        ↓
Client state + localStorage guest profile
        ↓
API Routes / Server Auth Boundary
        ↓
Supabase Auth + Postgres/RLS
        ↓
External providers: Assistant / Avatar / Vercel / optional places data
```

## 2. Current Stack

- Frontend: Next.js 16, React 19, TypeScript.
- App shell: `app/page.tsx`.
- Visual system: `app/globals.css`.
- Components: `GeneratedAvatar`, `LiveMap`.
- Backend: Next API routes under `app/api/*`.
- Data: Supabase Postgres + RLS.
- Auth: Supabase Auth; guest fallback via localStorage.
- Deployment: Vercel.
- Native wrapper: iOS WKWebView shell points to production URL.

## 3. Architectural Principles

1. **Companion-first UI, privacy-first backend.**
2. **Guest/local start, cloud persistence after auth.**
3. **API routes own private data access.**
4. **RLS protects owner-scoped entities.**
5. **Map uses approximate places/zones by default.**
6. **Assistant is bounded by safety rules and context.**
7. **Avatar is hook, not core dependency.**

## 4. Major Modules

### 4.1 UI Shell

Responsibilities:

- onboarding;
- tab navigation;
- Today screen;
- Passport/profile forms;
- Assistant UI;
- Map UI;
- Wishlist UI;
- local guest behavior.

Key files:

- `app/page.tsx`
- `app/globals.css`
- `components/GeneratedAvatar.tsx`
- `components/LiveMap.tsx`

### 4.2 Local Profile Storage

Responsibilities:

- preserve guest profile;
- store uploaded/local avatar data URL;
- provide demo/local fallback.

Key files:

- `lib/profileStorage.ts`
- `lib/data.ts`

### 4.3 API Boundary

Responsibilities:

- validate auth;
- enforce owner scope;
- map UI profile values to DB enums;
- isolate Supabase access;
- return safe JSON contracts.

Routes:

- `/api/app/bootstrap`
- `/api/pets`
- `/api/reminders`
- `/api/reminders/[id]`
- `/api/reminders/[id]/complete`
- `/api/reminders/[id]/snooze`
- `/api/zones`
- `/api/zones/[id]`
- `/api/wishlist`
- `/api/wishlist/[id]`
- `/api/assistant`
- `/api/avatar/generate`

### 4.4 Supabase Data Layer

Core tables:

- `profiles`
- `pets`
- `pet_passports`
- `social_profiles`
- `reminders`
- `map_zones`
- `wishlist_items`
- `assistant_threads`
- `assistant_messages`

Preparation/future tables:

- `guest_profiles`
- `avatar_jobs`
- `avatar_assets`
- `dog_cards`
- `places`
- `place_reports`
- `dog_friendships`
- `partner_profiles`
- `affiliate_events`
- `push_devices`
- `moderation_reports`

### 4.5 Assistant Service

Responsibilities:

- classify question;
- build context from pet/passport/social/reminders;
- answer safely;
- use provider/fallback.

Safety rules:

- no diagnosis;
- no medication prescription;
- red flags → veterinarian;
- if data missing, say what is missing;
- no invented pet facts.

### 4.6 Avatar Service

Responsibilities:

- turn uploaded/reference data into avatar prompt;
- use OpenAI if available;
- fallback to Pollinations image URL;
- keep avatar as identity/hook, not blocker.

### 4.7 Map/Places Service

Current:

- owner-scoped `map_zones`.
- approximate lat/lng/radius.

Future:

- public/curated `places`.
- partner/clinic/shop metadata.
- place reports/moderation.

## 5. Data Flow: App Bootstrap

```text
App loads
  ↓
Load localStorage profile
  ↓
Check Supabase session
  ↓
GET /api/app/bootstrap
  ↓
If unauth: return empty private state
If auth: return first owned pet + passport + social + reminders + zones + wishlist
  ↓
UI merges backend fields with local avatar/style state
```

## 6. Data Flow: Save Pet Profile

```text
User fills Passport/Profile
  ↓
Guest mode: save local profile only
Auth mode: POST /api/pets
  ↓
API validates owner/auth
  ↓
Upsert pets + pet_passports + social_profiles
  ↓
Return pet id
  ↓
Reload bootstrap
```

## 7. Data Flow: Reminder Loop

```text
Today next action / quick add
  ↓
POST /api/reminders or local guest reminder
  ↓
Group reminders: overdue / today / upcoming
  ↓
Complete / Snooze / Delete via API or local state
  ↓
Reminder events stored in backend mode
```

## 8. Data Flow: Assistant

```text
User asks question
  ↓
UI sends question + auth headers
  ↓
/api/assistant loads owned pet context
  ↓
Classify: health_triage / training / care / shopping / general
  ↓
Rules answer + provider answer if available
  ↓
Return concise safety-bounded advice
```

## 9. Trust & Privacy Boundaries

### Protected data

- private pet profile;
- passport/health notes;
- reminders;
- zones/map data;
- wishlist;
- assistant history.

### Public data

Only explicitly shared public dog card fields, e.g. name, social rule, public bio, owner-approved traits.

### Red lines

- no unauth private bootstrap leak;
- no direct UI bypass of RLS/API owner scope;
- no exact location by default;
- no medical diagnosis.

## 10. Deployment / Runtime

- Production: Vercel alias `https://pso-mvp-uglanovrms-projects.vercel.app`.
- iOS shell uses WKWebView and loads production URL.
- Production deploy requires explicit approval and post-check.

## 11. Quality Gates

- `npm run check` for build/typecheck.
- `npm run qa:local` before deploy.
- Targeted API smoke for auth/privacy changes.
- Production smoke: `/` returns 200; new CSS/UI assets present.

## 12. Future HLD Decisions

1. Guest → auth migration strategy.
2. Push notification architecture.
3. Multi-dog support.
4. Places curation/admin workflow.
5. Assistant history persistence and consent.
6. Native app vs WebView wrapper split.
