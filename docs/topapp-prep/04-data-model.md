# Data Model Prep

Цель: подготовить модель данных под avatar-first digital dog world, не ломая текущие `pets`, `pet_passports`, `social_profiles`, `reminders`, `map_zones`, `wishlist_items`.

## Existing core

- `profiles`
- `pets`
- `pet_passports`
- `social_profiles`
- `reminders`
- `map_zones`
- `wishlist_items`
- `assistant_threads/messages`

## New domains

### Guest / Migration

`guest_profiles`
- local anonymous identity before auth;
- migration state;
- prevents losing hero/card before login.

Fields:
- `id`
- `local_key_hash`
- `migrated_to_user_id`
- `migrated_at`
- `created_at`

### Avatar / Hero

`avatar_jobs`
- status machine for generation.

`avatar_assets`
- generated images/cards;
- style, provider, storage path, moderation status.

`dog_cards`
- shareable hero card metadata;
- public/private visibility.

### World / Places

`places`
- clinics, shops, parks, groomers, safe places.

`place_sources`
- website/manual/user/partner/open data.

`place_verifications`
- verification records and trust status.

`place_reports`
- user reports: risk, wrong data, closed, safety issue.

### Social

`dog_friendships`
- friend/invite relationship between dogs.

`compatibility_signals`
- explainable compatibility factors.

`checkins`
- privacy-safe approximate presence.

### Commerce / Partners

`partner_profiles`
- clinic/shop/groomer partner metadata.

`affiliate_events`
- outbound commerce tracking with disclosure.

### Notifications

`push_devices`
- device tokens.

`notification_deliveries`
- reminder/push history.

### Moderation / Safety

`moderation_reports`
- social/place/review/report moderation queue.

`assistant_safety_events`
- health/medical safety classification log without raw sensitive text.

## RLS principles

- User-owned dog data owner scoped.
- Guest data not server-trusted until migration/auth.
- Public dog cards explicit allowlist only.
- Places can be public read, but reports/reviews owner scoped.
- Partner status never implies quality status.

## Draft migration

See: `supabase/migrations/20260508100000_topapp_preparation_schema.sql`.
