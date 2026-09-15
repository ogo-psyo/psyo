# API → сервис → экран → проверка

Механический реестр c15d067: 69 route-файлов и 99 HTTP method exports, включая destructured GET/POST Better Auth. Таблица связывает каждый обработчик с семейством UI/операций; **она не доказывает, что все guard/RLS уже корректны**. Для каждого приватного обработчика требуется A-30, для мутаций — failure/retry/race тесты соответствующего домена из раздела 05. Точный payload/DTO сохраняется до отдельного review изменения.

Экспорты auth handler делегируют внутренние действия библиотеке; 99 exports не равно 99 бизнес-операциям. RPC/таблицы/маркеры в CSV извлечены статически, транзитивные helper зависимости допроверяются при реализации.

| Endpoint | Методы | Сервис | UI/состояния | Граница проверки |
|---|---|---|---|---|
| `/api/admin/auth/owners` | GET | Administration | SYS-08 | privileged, excluded from consumer UI; требуется staging evidence |
| `/api/app/bootstrap` | GET | Identity/Bootstrap | SYS-01/04 | session, bearer or explicit anonymous contract; требуется staging evidence |
| `/api/assistant` | POST | AssistantService (existing) | HOME-01–03 | owner/pet, bounded context; not PR29 agent; требуется staging evidence |
| `/api/auth/[...all]` | GET,POST | Identity/Bootstrap | SYS-01/04 | session, bearer or explicit anonymous contract; требуется staging evidence |
| `/api/avatar/generate` | POST | AvatarService | PRO-03 | owner + capability/provider/public projection explicit; требуется staging evidence |
| `/api/avatar/upload` | POST | AvatarService | PRO-03 | owner + capability/provider/public projection explicit; требуется staging evidence |
| `/api/billing/entitlements` | GET | BillingService | SYS-07 | flag OFF retained; server entitlements/webhook; требуется staging evidence |
| `/api/billing/telegram-stars/checkout` | POST | BillingService | SYS-07 | flag OFF retained; server entitlements/webhook; требуется staging evidence |
| `/api/billing/telegram-stars` | POST | BillingService | SYS-07 | flag OFF retained; server entitlements/webhook; требуется staging evidence |
| `/api/documents/[id]` | DELETE,GET | DocumentService | DOC-01–03 | owner + private Storage; требуется staging evidence |
| `/api/documents` | GET,POST | DocumentService | DOC-01–03 | owner + private Storage; требуется staging evidence |
| `/api/dog-cards` | DELETE,GET,POST | PublicCardService | PRO-04/SYS-06 | publish owner; anonymous whitelist read; требуется staging evidence |
| `/api/habits/[id]/checkins` | POST | HabitService | HAB-01–03 | owner/pet; требуется staging evidence |
| `/api/habits/[id]` | DELETE,PATCH | HabitService | HAB-01–03 | owner/pet; требуется staging evidence |
| `/api/habits` | GET,POST | HabitService | HAB-01–03 | owner/pet; требуется staging evidence |
| `/api/health` | GET | Health/ObservationService | OBS-01–07 | owner/pet; требуется staging evidence |
| `/api/internal/avatar-retention` | GET | Operations | SYS-07 | health/release read-only; job-specific scheduler authorization for retention/outcomes; требуется staging evidence |
| `/api/internal/health` | GET | Operations | SYS-07 | health/release read-only; job-specific scheduler authorization for retention/outcomes; требуется staging evidence |
| `/api/internal/recommendation-outcomes` | GET | Operations | SYS-07 | health/release read-only; job-specific scheduler authorization for retention/outcomes; требуется staging evidence |
| `/api/internal/release` | GET | Operations | SYS-07 | health/release read-only; job-specific scheduler authorization for retention/outcomes; требуется staging evidence |
| `/api/map/features/[id]` | DELETE,PATCH | MapService | MAP-01–10 | owner or explicit public/coarse projection; требуется staging evidence |
| `/api/map/features` | GET,POST | MapService | MAP-01–10 | owner or explicit public/coarse projection; требуется staging evidence |
| `/api/map/library` | GET,POST | MapService | MAP-01–10 | owner or explicit public/coarse projection; требуется staging evidence |
| `/api/map/places` | GET | MapService | MAP-01–10 | owner or explicit public/coarse projection; требуется staging evidence |
| `/api/map/search` | GET | MapService | MAP-01–10 | owner or explicit public/coarse projection; требуется staging evidence |
| `/api/map/walking` | POST | MapService | MAP-01–10 | owner or explicit public/coarse projection; требуется staging evidence |
| `/api/observations/[id]/restore` | POST | Health/ObservationService | OBS-01–07 | owner/pet; требуется staging evidence |
| `/api/observations/[id]` | DELETE,PATCH | Health/ObservationService | OBS-01–07 | owner/pet; требуется staging evidence |
| `/api/observations/extract` | POST | Health/ObservationService | OBS-01–07 | owner/pet; требуется staging evidence |
| `/api/observations` | GET,POST | Health/ObservationService | OBS-01–07 | owner/pet; требуется staging evidence |
| `/api/observations/voice` | POST | Health/ObservationService | OBS-01–07 | owner/pet; требуется staging evidence |
| `/api/pets/[id]/summary` | GET | Health/ObservationService | OBS-01–07 | owner/pet; требуется staging evidence |
| `/api/pets` | POST | ProfileService | PRO-01/02/SYS-02/03/05 | owner/pet; требуется staging evidence |
| `/api/recommendations/[id]/outcome` | POST | RecommendationService | HOME-03 | owner or scheduler; flag retained; требуется staging evidence |
| `/api/recommendations/[id]` | PATCH | RecommendationService | HOME-03 | owner or scheduler; flag retained; требуется staging evidence |
| `/api/recommendations` | GET,POST | RecommendationService | HOME-03 | owner or scheduler; flag retained; требуется staging evidence |
| `/api/reminders/[id]/complete` | POST | ReminderService | CARE-01–05 | owner/pet; callback path separate; требуется staging evidence |
| `/api/reminders/[id]/history` | GET | ReminderService | CARE-01–05 | owner/pet; callback path separate; требуется staging evidence |
| `/api/reminders/[id]` | DELETE,PATCH | ReminderService | CARE-01–05 | owner/pet; callback path separate; требуется staging evidence |
| `/api/reminders/[id]/snooze` | POST | ReminderService | CARE-01–05 | owner/pet; callback path separate; требуется staging evidence |
| `/api/reminders` | GET,POST | ReminderService | CARE-01–05 | owner/pet; callback path separate; требуется staging evidence |
| `/api/social/candidates` | GET | SocialService | GAV-01–10 | owner/participant; helper guards; требуется staging evidence |
| `/api/social/invites/[token]` | GET,POST | SocialService | GAV-01–10 | owner/participant; helper guards; требуется staging evidence |
| `/api/social/invites` | POST | SocialService | GAV-01–10 | owner/participant; helper guards; требуется staging evidence |
| `/api/social/profile` | DELETE,GET,PUT | SocialService | GAV-01–10 | owner/participant; helper guards; требуется staging evidence |
| `/api/social/requests/[id]/meeting` | GET,POST | SocialService | GAV-01–10 | owner/participant; helper guards; требуется staging evidence |
| `/api/social/requests/[id]` | PATCH | SocialService | GAV-01–10 | owner/participant; helper guards; требуется staging evidence |
| `/api/social/requests` | GET,POST | SocialService | GAV-01–10 | owner/participant; helper guards; требуется staging evidence |
| `/api/social/signals` | DELETE,GET,PUT | SocialService | GAV-01–10 | owner/participant; helper guards; требуется staging evidence |
| `/api/stt/transcribe` | POST | VoiceCaptureService | OBS-02/03 | owner + quota/provider; требуется staging evidence |
| `/api/telegram/session` | POST | Identity/Bootstrap | SYS-01/04 | session, bearer or explicit anonymous contract; требуется staging evidence |
| `/api/telegram/webhook` | POST | TelegramDelivery | CARE-05/SYS-07 | server webhook auth; at-least-once; требуется staging evidence |
| `/api/v1/account` | DELETE | AccountService | SYS-05 | owner; deletion scope; требуется staging evidence |
| `/api/v1/onboarding/activate` | POST | ProfileService | PRO-01/02/SYS-02/03/05 | owner/pet; требуется staging evidence |
| `/api/v1/pets/[petId]/avatar/assets/[assetId]/activate` | POST | AvatarService | PRO-03 | owner + capability/provider/public projection explicit; требуется staging evidence |
| `/api/v1/pets/[petId]/avatar/assets/[assetId]/render` | GET | AvatarService | PRO-03 | owner + capability/provider/public projection explicit; требуется staging evidence |
| `/api/v1/pets/[petId]/avatar/assets/[assetId]` | DELETE | AvatarService | PRO-03 | owner + capability/provider/public projection explicit; требуется staging evidence |
| `/api/v1/pets/[petId]/avatar/assets` | GET,POST | AvatarService | PRO-03 | owner + capability/provider/public projection explicit; требуется staging evidence |
| `/api/v1/pets/[petId]/avatar/identity` | POST | AvatarService | PRO-03 | owner + capability/provider/public projection explicit; требуется staging evidence |
| `/api/v1/pets/[petId]/avatar/jobs` | POST | AvatarService | PRO-03 | owner + capability/provider/public projection explicit; требуется staging evidence |
| `/api/v1/pets` | DELETE,GET,PATCH,POST | ProfileService | PRO-01/02/SYS-02/03/05 | owner/pet; требуется staging evidence |
| `/api/v1/session/logout` | POST | Identity/Bootstrap | SYS-01/04 | session, bearer or explicit anonymous contract; требуется staging evidence |
| `/api/v1/session/telegram` | POST | Identity/Bootstrap | SYS-01/04 | session, bearer or explicit anonymous contract; требуется staging evidence |
| `/api/wishlist/[id]/restore` | POST | WishlistService | WISH-01–03 | owner/pet; требуется staging evidence |
| `/api/wishlist/[id]` | DELETE,PATCH | WishlistService | WISH-01–03 | owner/pet; требуется staging evidence |
| `/api/wishlist` | GET,POST | WishlistService | WISH-01–03 | owner/pet; требуется staging evidence |
| `/api/zones/[id]/restore` | POST | MapService | MAP-01–10 | owner or explicit public/coarse projection; требуется staging evidence |
| `/api/zones/[id]` | DELETE,PATCH | MapService | MAP-01–10 | owner or explicit public/coarse projection; требуется staging evidence |
| `/api/zones` | GET,POST | MapService | MAP-01–10 | owner or explicit public/coarse projection; требуется staging evidence |
