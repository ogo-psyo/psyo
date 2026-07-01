# Псё — Entity Specification

## Entity Catalog

| Entity | Domain | Owner | Key fields | Lifecycle | Privacy |
|---|---|---|---|---|---|
| Profile | Identity | auth user | id, display_name, created_at | created on auth, owns pets | private owner row |
| TelegramSession | Identity | Telegram user / app session | psyoUserId, firstName, username, authDate | derived from signed initData | pseudonymous; raw Telegram ID not shown in UI |
| GuestProfile | Identity/Profile | browser device | DogProfile in localStorage | exists before auth, can be replaced by Supabase state | device-local, lost on browser cleanup |
| Pet | Dog Profile | Profile | name, breed, lifeStage, sex, weight, avatarUrl, publicSlug | create/update from Profile screen | private except safe public card subset |
| PetPassport | Dog Profile | Pet | microchip, vetClinic, diet, allergies, medication, healthNotes, vaccineStatus, parasiteStatus | upsert with Pet | private; owner controls export |
| SocialProfile | Dog Profile | Pet | socialMode, temperament, energy, playStyle, friendly flags, triggers, aloneTime | upsert with Pet | public card may expose only chosen safe summary |
| Reminder | Care Loop | Pet | type, title, dueAt, recurrence, status, snoozedUntil, completedAt | create, complete, snooze, update, delete | private care data |
| ReminderEvent | Care Loop | Reminder | event_type, payload, created_at | emitted on create/update/snooze/complete/delete | private audit/history |
| MapZone | Places | Pet | type, title, note, approximate_lat/lng, radius_meters | create, update, delete | approximate only; exact GPS avoided |
| WishlistItem | Things | Pet | title, category, reason, url, priority, status | wanted → bought/not_suitable or deleted | private unless explicitly shared later |
| AssistantThread | Assistant | Pet | kind, title, createdAt, updatedAt | created when persisted assistant is enabled | private conversation context |
| AssistantMessage | Assistant | Thread | role, content, metadata | appended to thread | private; safety metadata future |
| AvatarAsset | Media/Profile | Pet | source, generated URL/data, prompt, style | uploaded/generated/fallback | avoid long-term external photo storage in MVP unless explicit |
| PublicDogCard | Share/Export | Pet/Owner | safe subset: name, breed, bio, social rule, area, updatedAt | preview/share/print; DB-backed future | opt-in, no exact location/contact by default |

## Current vs Target

| Area | Current | Target |
|---|---|---|
| Public card | Query-backed `/dog/card?...` route | DB-backed `dog_cards` with owner-selected fields and revocation |
| Assistant | Rules/Pollinations answer, optional DB context | Thread persistence + action proposals + red-flag safety metadata |
| Avatar | Upload/local data URL + generation endpoint | Asset table/storage with explicit retention policy |
| Telegram identity | Pseudonymous session endpoint | Optional account linking between Telegram and Supabase profile |
| Reminders | In-app CRUD + local guest fallback | Telegram notifications / cron delivery after consent |

## Domain Boundaries

- Identity should not know dog-care semantics.
- Dog Profile owns stable dog facts and public-safe summaries.
- Care Loop owns time-based tasks and return triggers.
- Places owns approximate geospatial notes, never exact public location.
- Assistant reads context and proposes actions; it should not silently mutate entities.
- Share/Export reads safe subsets; it must not expose full private passport by default.
