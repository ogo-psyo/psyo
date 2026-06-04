# Псё — Screen / Service Map

## 1. Screens

### 1.1 Onboarding

Purpose:

- create emotional hook;
- capture minimal dog identity;
- optionally upload/generate avatar;
- avoid long form upfront.

Stages in current code:

- `intro`
- `photo`
- `style`
- `generating`
- `reveal`
- `done`

Primary data:

- local `DogProfile`.
- photo/avatar fields.
- breed/style options.

Services:

- localStorage profile.
- `/api/avatar/generate` optional.

States:

- no photo;
- uploaded photo;
- generating;
- ready;
- provider fallback;
- skip.

### 1.2 Today

Purpose:

- living center / daily home.
- show dog status and one next care step.

Primary data:

- Pet.
- Passport.
- SocialProfile.
- Reminders.
- MapZones.

Services:

- local profile storage.
- `/api/app/bootstrap`.
- `/api/reminders`.
- `/api/reminders/[id]/complete`.
- `/api/reminders/[id]/snooze`.

Components:

- Dog status card.
- Next best care action.
- Care readiness strip.
- Map teaser.
- Passport/memory teaser.
- Reminder groups.
- Assistant teaser.

States:

- empty guest;
- incomplete profile;
- profile ready;
- overdue care;
- no reminders;
- active reminders;
- local/demo mode;
- backend/auth mode.

### 1.3 Passport / Dog

Purpose:

- structured memory about the dog.
- supports assistant, public card, care reminders.

Primary data:

- Pet.
- PetPassport.
- SocialProfile.
- Avatar/local photos.

Services:

- localStorage save.
- `/api/pets`.
- `/api/avatar/generate`.

Sections:

1. Minimum for Today.
2. Breed/size/identity.
3. Health/passport.
4. Behavior/social profile.
5. Hero/photo.

States:

- local-only;
- saving;
- saved;
- auth required;
- backend save error;
- avatar fallback.

### 1.4 Assistant

Purpose:

- answer behavior/care/health/shopping questions with dog context.

Primary data:

- Assistant question.
- Pet/passport/social/reminders context.

Services:

- `/api/assistant`.

Question categories:

- `health_triage`.
- `training`.
- `care`.
- `shopping`.
- `general`.

States:

- empty question;
- loading;
- answer;
- missing context;
- provider fallback;
- auth required/backend mode;
- health red flag.

Safety UX:

- no diagnosis.
- no medications.
- red flags → veterinarian.
- ask for missing facts.

### 1.5 Map

Purpose:

- owner’s care map: safe places, risk zones, clinic/shop/grooming.

Primary data:

- MapZones.
- Places future.

Services:

- `/api/zones`.
- `/api/zones/[id]`.
- `LiveMap` component.

Zone types:

- home area;
- walk route;
- safe place;
- risk zone;
- clinic;
- shop;
- grooming.

States:

- no zones;
- picked point;
- zone form;
- local guest zone;
- backend zone;
- map unavailable;
- privacy explanation.

### 1.6 Things / Wishlist

Purpose:

- track useful dog-related items without making commerce first layer.

Primary data:

- WishlistItem.

Services:

- `/api/wishlist`.
- `/api/wishlist/[id]`.

Categories:

- food;
- treats;
- toy;
- gear;
- health;
- grooming;
- course;
- service;
- other.

States:

- empty;
- wanted;
- bought;
- not suitable;
- high priority;
- auth required/backend mode.

### 1.7 Public Dog Card

Purpose:

- shareable safe summary for other humans.

Data:

- explicit public fields only.
- name, breed label, social rule, bio, area hidden/controlled.

Services:

- `/dog/[slug]` route.
- current query-based `/dog/card?...` flow in UI.
- future `dog_cards` table.

States:

- private;
- unlisted;
- public;
- missing shareable facts.

## 2. Services / API Map

| Service | Route/File | Reads | Writes | Auth |
|---|---|---|---|---|
| Bootstrap | `/api/app/bootstrap` | pet, passport, social, reminders, zones, wishlist | ensure profile | unauth returns empty; auth owner |
| Pets/Profile | `/api/pets` | existing pet | pets, passports, social | auth required if Supabase |
| Reminders | `/api/reminders` | reminders | reminders, reminder_events | auth owner |
| Reminder item | `/api/reminders/[id]` | owned reminder | update/delete | auth owner |
| Complete | `/api/reminders/[id]/complete` | owned reminder | status/event | auth owner |
| Snooze | `/api/reminders/[id]/snooze` | owned reminder | snooze/event | auth owner |
| Zones | `/api/zones` | owner zones | map_zones | auth owner |
| Zone item | `/api/zones/[id]` | owned zone | update/delete | auth owner |
| Wishlist | `/api/wishlist` | owner wishlist | wishlist_items | auth owner |
| Wishlist item | `/api/wishlist/[id]` | owned item | update/delete | auth owner |
| Assistant | `/api/assistant` | context | optional messages future | auth/context dependent |
| Avatar | `/api/avatar/generate` | breed/style/photo | generated url | no private DB write current |

## 3. Screen Dependency Map

```text
Today
 ├─ Pet
 ├─ Passport
 ├─ SocialProfile
 ├─ Reminders
 ├─ MapZones
 └─ Assistant teaser

Passport
 ├─ Pet
 ├─ Passport
 ├─ SocialProfile
 └─ Avatar

Map
 ├─ MapZones
 ├─ Places [future]
 └─ Pet/Social safety context

Assistant
 ├─ Pet
 ├─ Passport
 ├─ SocialProfile
 ├─ Reminders
 └─ Answer safety policy

Things
 ├─ WishlistItems
 └─ Pet context
```

## 4. UX State Matrix

| Screen | Empty | Partial | Ready | Error |
|---|---|---|---|---|
| Onboarding | intro | photo/style selected | reveal/done | generation failed/fallback |
| Today | no pet/profile | incomplete profile | next action + care loop | bootstrap/reminder error |
| Passport | blank form | 1–5 sections filled | saved profile | validation/save error |
| Map | no zones | picked point | zones list/map | map/API error |
| Assistant | no question | context incomplete | answer | provider/API error |
| Things | no items | wanted list | bought/history | API error |

## 5. Design QA Gates

For each screen:

- Is the dog visible/central?
- Is the next useful action obvious?
- Is anxiety reduced, not amplified?
- Is private data protected or clearly scoped?
- Does empty state teach the value?
- Does the screen still work in guest mode?
