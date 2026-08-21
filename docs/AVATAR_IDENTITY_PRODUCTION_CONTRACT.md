# Dog identity production contract

Status: implementation contract. Production flags stay off until the release gates below pass.

## Product model

Every dog has one explicit identity source:

- `none`: neutral composition, no invented image;
- `uploaded`: an owner-confirmed, metadata-stripped dog photo;
- `generated`: an owner-confirmed generated variant.

Generation is always opt-in. A generated result is a draft until the owner activates it. The product never silently substitutes a provider, applies a result, or claims that a text-only image preserves the dog's likeness.

## Asset lifecycle

1. The owner selects a dog.
2. A reference photo is validated, stripped of metadata and stored in the private `pet-avatar-private` bucket.
3. A generation job is keyed by owner, dog and idempotency key.
4. The provider receives only the minimum appearance context and optional bounded owner text after consent.
5. Provider bytes are validated and copied into the private bucket. Provider URLs and data URLs are never persisted.
6. The owner previews a draft and explicitly activates it.
7. Activation is atomic and recorded. A previous active asset can be restored.
8. Deleting a dog or account purges its avatar objects before deleting database rows.

## Security and privacy

- Canonical owner identity is Supabase Auth or a verified Telegram app session with an owner bridge.
- Every route checks both `owner_id` and `pet_id`; asset activation also checks the asset belongs to that dog.
- Originals and variants are private. The app renders them through an authenticated owner-scoped endpoint.
- Public dog cards require a separate explicit publication step and never expose the original reference photo automatically.
- There is no Pollinations fallback. Provider, purpose and retention consent is explicit and versioned.
- Generation requires both `AVATAR_GENERATION_ENABLED=true` and `AVATAR_OPENAI_ENABLED=true`, plus a positive daily budget. Upload requires `UPLOADS_ENABLED=true`.
- Job cost/idempotency and upload quotas are reserved atomically in service-role RPCs before provider or storage work.
- Browser clients have no direct CRUD policies on the avatar lifecycle tables.

## Retention

- generation-only reference: 24 hours unless the owner activates or keeps it;
- unselected generated variant: 30 days;
- failed job temporary bytes: immediate deletion, no later than 24 hours;
- selected image: until replacement or deletion;
- replaced/removed image: 30-day rollback grace, then deletion;
- sanitized job metadata: 90 days;
- dog/account deletion: immediate best-effort purge with a verified deletion test before release.

Expired drafts and job metadata are processed daily by `/api/internal/avatar-retention`; storage deletion happens before a row is tombstoned, and failures remain eligible for retry.

## Release gates

- Telegram owner happy path and origin enforcement;
- two owners × two dogs IDOR and cross-dog negative tests;
- idempotent replay, quota, timeout and zero-cost-overrun tests;
- no provider fallback and typed recovery states;
- preview, activate, reload, switch dogs, rollback and delete;
- anonymous access to private assets denied;
- 320/390 px, keyboard, focus, reduced motion and image failure;
- QA database migration and rollback plan;
- full local QA, preview smoke, then an explicit production approval.
