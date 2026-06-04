# Псё — Information Model

## 1. Domain Concept

Псё models a relationship system:

```text
Owner ← cares for → Pet
Pet has → Identity / Passport / Social profile / Care loop / Places / Things / Memory / Assistant context
```

## 2. Entity Groups

### 2.1 Identity / Ownership

#### Profile / Owner

Source table: `profiles`

Fields:

- `id` — auth user id.
- `display_name`.
- `created_at`.

Relationships:

- owns many `pets`.

Privacy:

- owner-only.

#### GuestProfile [future/prep]

Source table: `guest_profiles`

Purpose:

- local/guest identity bridge before account.

Fields:

- `id`.
- `local_key_hash`.
- `migrated_to_user_id`.
- `migrated_at`.
- `created_at`.

Open decision:

- whether v1 migrates local guest data to auth account.

### 2.2 Pet Core

#### Pet

Source table: `pets`

Fields:

- `id`.
- `owner_id`.
- `name`.
- `species = dog`.
- `breed_id`.
- `breed_group_id`.
- `custom_breed`.
- `sex`.
- `life_stage`.
- `weight_kg`.
- `avatar_url`.
- `photo_urls`.
- `public_slug`.
- `created_at` / `updated_at`.

UI/local fields also include:

- `age`.
- `size`.
- `coatType`.
- `colorMarks`.
- `bio`.
- `neighborhood`.
- `selectedStyle`.
- `avatarSource`.
- `avatarImageUrl`.

Relationships:

- belongs to Owner.
- has one Passport.
- has one SocialProfile.
- has many Reminders, MapZones, WishlistItems, AssistantThreads, DogCards.

### 2.3 Passport / Health

#### PetPassport

Source table: `pet_passports`

Fields:

- `pet_id`.
- `microchip`.
- `vet_clinic`.
- `vet_contact`.
- `diet`.
- `allergies`.
- `medication`.
- `health_notes`.
- `vaccine_status`: `actual | due_soon | overdue | unknown`.
- `parasite_status`: `actual | needs_reminder | overdue | unknown`.
- `updated_at`.

UX principle:

- Passport should feel like memory/support, not a medical burden.

Safety:

- Health notes are private.
- Assistant must not diagnose from these fields.

### 2.4 Social / Behavior

#### SocialProfile

Source table: `social_profiles`

Fields:

- `pet_id`.
- `social_mode`: `ok | ask_first | calm_dogs_only | do_not_approach | known_only`.
- `temperament`.
- `energy_level`.
- `play_style`.
- `trainability`.
- `child_friendly`: `yes | careful | no | unknown`.
- `dog_friendly`: `yes | careful | no | unknown`.
- `cat_friendly`: `yes | careful | no | unknown`.
- `triggers[]`.
- `alone_time_note`.

UX use:

- Today chips.
- Assistant context.
- Public dog card safety rules.
- Map/risk decisions.

### 2.5 Care Loop

#### Reminder

Source table: `reminders`

Fields:

- `id`.
- `pet_id`.
- `type`: `vaccine | parasite | medication | grooming | food | training | vet | custom`.
- `title`.
- `due_at`.
- `recurrence`: `none | daily | weekly | monthly | quarterly | yearly`.
- `status`: `active | done | snoozed`.
- `created_at` / `updated_at`.

Derived UI groups:

- `overdue`.
- `today`.
- `upcoming`.
- `done/history`.

#### ReminderEvent

Source from code: `reminder_events` is used by API.

Purpose:

- audit/history of created/updated/deleted/done/snoozed events.

Fields implied:

- `reminder_id`.
- `event_type`.
- `payload`.

### 2.6 Map / Places

#### MapZone

Source table: `map_zones`

Fields:

- `id`.
- `pet_id`.
- `type`: `home_area | walk_route | safe_place | risk_zone | clinic | shop | grooming`.
- `title`.
- `approximate_lat`.
- `approximate_lng`.
- `radius_meters`.
- `note`.
- `created_at`.

Privacy:

- owner-only.
- approximate by default.
- never exact home GPS in public surfaces.

#### Place [future]

Source table: `places`

Fields:

- `id`.
- `type`: `park | safe_walk | risk_zone | clinic | emergency_clinic | vet_pharmacy | pet_shop | grooming | training | pet_friendly_place`.
- `title`.
- `address`, `phone`, `website`.
- approximate lat/lng.
- `trust_level`.
- `partner_status`.
- `tags[]`.
- `source_note`.
- `last_verified_at`.

### 2.7 Things / Wishlist / Commerce

#### WishlistItem

Source table: `wishlist_items`

Fields:

- `id`.
- `pet_id`.
- `title`.
- `category`: `food | treats | toy | gear | health | grooming | course | service | other`.
- `reason`.
- `url`.
- `priority`: `low | medium | high`.
- `status`: `wanted | bought | not_suitable`.
- `created_at` / `updated_at`.

Product rule:

- Commerce is supporting layer, not first impression.

### 2.8 Assistant

#### AssistantThread

Source table: `assistant_threads`

Fields:

- `id`.
- `pet_id`.
- `kind`: `training | care | health_triage | shopping | travel | general`.
- `title`.
- `created_at` / `updated_at`.

#### AssistantMessage

Source table: `assistant_messages`

Fields:

- `id`.
- `thread_id`.
- `role`: `user | assistant | system`.
- `content`.
- `created_at`.

Current MVP note:

- Assistant route currently answers using live context and may not persist full threads in UI yet.

### 2.9 Avatar / Public Cards

#### AvatarJob [future]

Fields:

- `id`.
- `owner_id` / `guest_profile_id` / `pet_id`.
- `style_id`.
- `status`.
- `provider`.
- `failure_reason`.
- `cost_cents`.
- timestamps.

#### AvatarAsset [future]

Fields:

- `asset_type`: `reference_photo | avatar_image | hero_card_png | thumbnail`.
- storage info.
- moderation status.
- visibility.

#### DogCard [future/current public route]

Purpose:

- shareable dog identity/safety card.

Fields:

- `pet_id` / `guest_profile_id`.
- `avatar_asset_id`.
- `title`.
- `subtitle`.
- `traits[]`.
- `style_id`.
- `visibility`: `private | unlisted | public`.
- `public_slug`.

### 2.10 Notifications / Devices [future]

#### PushDevice

Fields:

- `owner_id` or `guest_profile_id`.
- `platform`: `web | ios | android`.
- `token`.
- `enabled`.

Use:

- reminders.
- care check-ins.
- low-noise nudges.

## 3. Relationships

```text
Profile 1 ── * Pet
Pet 1 ── 1 PetPassport
Pet 1 ── 1 SocialProfile
Pet 1 ── * Reminder
Pet 1 ── * MapZone
Pet 1 ── * WishlistItem
Pet 1 ── * AssistantThread ── * AssistantMessage
Pet 1 ── * DogCard
Pet 1 ── * AvatarAsset
Place 1 ── * PlaceReport
PartnerProfile 1 ── * AffiliateEvent
```

## 4. Derived Concepts

### DogStatus

Derived from:

- Pet identity.
- Social profile.
- Passport statuses.
- Reminder urgency.
- Recent care events [future].

Used on:

- Today hero.
- Assistant context.
- Public card summary.

### NextBestCareAction

Derived priority:

1. missing minimal profile;
2. overdue health/care reminder;
3. due today reminder;
4. no reminder exists;
5. ask assistant / plan enrichment;
6. map/place suggestion.

### CareReadiness

Derived from profile checklist:

- name;
- age/size;
- vaccines;
- parasite care;
- social rule;
- energy.

### PlaceTrust

Derived from:

- user-added zone;
- curated place;
- user report;
- partner status;
- verification age.

## 5. Ownership / Privacy Matrix

| Entity | Default visibility | Owner scope | Public capable? | Notes |
|---|---:|---:|---:|---|
| Profile | private | yes | no | auth user only |
| Pet | private | yes | partial | public card explicit only |
| Passport | private | yes | no | health-sensitive |
| SocialProfile | private | yes | partial | social rule can be public |
| Reminder | private | yes | no | care schedule private |
| MapZone | private | yes | no | approximate only |
| Place | public/curated | n/a | yes | no private owner data |
| WishlistItem | private | yes | possible future | commerce caution |
| AssistantThread/Message | private | yes | no | sensitive behavior/health context |
| DogCard | private/unlisted/public | owner | yes | explicit share surface |
| AvatarAsset | private/signed/public | owner | yes | moderation needed |

## 6. Screen ↔ Entity Matrix

| Screen | Primary entities | Secondary entities |
|---|---|---|
| Onboarding | Pet, AvatarAsset/local avatar | BreedCatalog |
| Today | Pet, PetPassport, SocialProfile, Reminder, MapZone | WishlistItem, Assistant |
| Passport | Pet, PetPassport, SocialProfile | AvatarAsset, DogCard |
| Map | MapZone, Place | Pet, SocialProfile |
| Assistant | AssistantThread/Message, Pet context | Reminder, Passport, SocialProfile |
| Things | WishlistItem | Pet, Passport/Social context |
| Public Card | DogCard, Pet public fields | AvatarAsset |

## 7. Data Gaps / Next Model Work

- Care history/events beyond reminders.
- Mood/status check-ins.
- Walk sessions.
- Relationship/family member roles.
- Guest → auth migration.
- Assistant memory consent and retention.
- Place curation provenance.
