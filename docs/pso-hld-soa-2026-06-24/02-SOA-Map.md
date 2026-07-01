# Псё — SOA Map

## Domains

| Domain | Responsibility | Main code/data |
|---|---|---|
| Identity | Telegram session, email auth, owner boundary | `lib/server/auth.ts`, `lib/server/telegram.ts`, `/api/telegram/session` |
| Dog Profile | Pet core, passport, social profile, public card source | `pets`, `pet_passports`, `social_profiles`, `/api/pets` |
| Care Loop | Reminders, due actions, snooze/done/delete | `reminders`, `reminder_events`, `/api/reminders/*` |
| Places | Approximate safe/risk/clinic/shop/grooming zones | `map_zones`, `LiveMap`, `/api/zones/*` |
| Assistant | Dog-context care/training answers with safety limits | `/api/assistant`, future `assistant_threads/messages` |
| Things | Wishlist for food/gear/health/grooming/services | `wishlist_items`, `/api/wishlist/*` |
| Share/Export | Public dog card, print/PDF, Telegram share | `/dog/[slug]`, `DogCardActions`, `publicCardHref` |
| Quality Gates | Build/release safety and UX overload prevention | `scripts/qa/*`, `npm run qa:local` |

## Entity Ownership

- Profile owns many Pets.
- Pet owns one Passport and one SocialProfile.
- Pet owns many Reminders, MapZones, WishlistItems, AssistantThreads and PublicDogCards.
- AssistantThread owns many AssistantMessages.
- Public export must only use a safe subset chosen by the owner.
