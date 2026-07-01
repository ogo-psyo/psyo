# Псё — Screen Specification

## Screen Inventory

| Screen | User job | Primary entities | Read | Write/actions | UX rules |
|---|---|---|---|---|---|
| Onboarding Intro | Understand value fast | DogProfile draft | local profile | start flow, open demo, manual fill | One promise: passport + care loop, no technical status |
| Onboarding Photo | Add dog recognition anchor | DogProfile.photos, avatarImageUrl | local file | upload photo, skip | Photo is optional; no dead end |
| Onboarding Minimum | Create first useful card | DogProfile.socialMode, dogName | draft profile | choose social rule, set name, generate/reveal | Bubbles over forms; safe default is “сначала спросить” |
| Onboarding Reveal | Confirm profile exists | local Pet identity | draft profile | finish to Today/Profile, open print card | Must create local `backendPetId` before exit |
| Today | Know what matters now | Pet, Passport, Social, Reminder, Zone, Wishlist | bootstrap/local state | create reminder, complete, snooze, open PDF/share, go to map/assistant/profile | Dog + next care action first; status details collapsed |
| Profile | Build dog memory | Pet, Passport, SocialProfile | local/Supabase profile | update bubbles/fields, save card, upload/generate avatar | Progressive disclosure; quick bubbles before long text fields |
| Assistant | Ask with dog context | Pet context, reminders, future AssistantThread/Message | profile/reminder context | ask question, use preset prompts | No diagnosis; context first; answer must mention uncertainty/red flags |
| Map | Remember approximate places | MapZone | zones | create/update/delete safe/risk/clinic/shop/grooming zone | Approximate only; no exact public GPS |
| Things | Keep care/gear list | WishlistItem | wanted/bought items | add, mark important, bought, delete | Useful list, not marketplace until value is proven |
| Public Card / Print | Share safe dog info | public-safe dog subset, future DogCard | query-backed card today | preview, share, print/PDF | Preview before share; print wording honest |
| Auth / Session | Persist private state | Profile, session, Telegram session | Supabase session, Telegram initData | magic link, sign out | User copy, no HMAC/raw IDs in UI |

## Screen State Matrix

| Screen | Empty | Partial | Ready | Error |
|---|---|---|---|---|
| Today | Demo/local prompt + first reminder CTA | Missing profile fields + nearest care task | Dog status + care list + share shortcuts | Telegram session error collapsed into status panel |
| Profile | Name + bubbles | Missing fields chips | Card preview + print/share | Save/auth failure as human copy |
| Assistant | “Need context” helper | Cautious generic answer | Context-aware answer | Provider fallback/rules answer |
| Map | Add first safe/risk place | Existing zones list | Map + zone actions | Map unavailable still allows text save |
| Things | Suggested first items | Wanted list | Bought history + wanted list | API failure keeps local draft if guest |

## UX Quality Rules

- Every visible block must answer a user question: “что это даёт владельцу сейчас?”
- Technical implementation names stay out of screen copy.
- No screen should start with status infrastructure unless there is an error.
- If a screen needs more than one card of explanation, it should become progressive disclosure.
- Owner-sensitive data is opt-in for share/print.
