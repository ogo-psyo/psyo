# CRUD audit — 2026-09-01

Scope: user-facing Псё entities in authenticated Telegram mode and local guest mode.

| Entity | Create | Read | Update | Delete / lifecycle | UI outcome |
| --- | --- | --- | --- | --- | --- |
| Dog profile | yes | yes | yes | confirmed hard delete | fixed guest deletion without server pet id |
| Account / local data | n/a | yes | yes | exact-phrase delete | guest now gets a reachable local-data action |
| Reminders | yes | yes | yes | confirmed delete | covered by care CRUD tests |
| Observations | yes | yes | yes | soft delete + restore | covered by care CRUD tests |
| Wishlist | yes | yes | yes | soft delete + restore | added reachable title/reason edit |
| Map zones | yes | yes | yes | soft delete + restore | added reachable title/note edit |
| Owner routes | yes | yes | yes | confirmed delete | guest update/delete now local-first |
| Habits | yes | yes | yes | archive lifecycle | archive intentionally replaces hard delete |
| Pet documents | yes | yes | immutable file; replace by create/delete | confirmed hard delete | open/delete actions are now reachable in History |
| Social profile | put/upsert | yes | put/upsert | opt-out delete | lifecycle semantics, not a separate create form |
| Walk signal | put/upsert | yes | put/upsert | stop/delete | lifecycle semantics |
| Public dog cards | yes | yes | regenerate/revoke | revoke | privacy-scoped lifecycle |

## Root causes fixed

1. Anonymous bootstrap returned `empty` and erased an already hydrated local guest profile.
2. The danger-zone shell rendered even when both actions inside were hidden by server-only identifiers.
3. Guest routes, reminders, wishlist items and zones did not share a durable local entity store.
4. Guest route update/delete still called authenticated endpoints.
5. Document deletion existed in code but had no reachable interface.

## Product rules

- Destructive hard deletes require an explicit confirmation.
- Recoverable domain records use soft delete and restore where the API supports it.
- Uploaded document bytes are immutable: editing a file means replacing it; metadata remains visible before deletion.
- Guest data is stored only under `pso.*` keys and local reset never removes unrelated browser data.
- Guest document upload is blocked with an explanation because secure file storage requires an authenticated private profile.

## Verification

- `scripts/qa/guest-crud.behavior.test.ts`
- `scripts/qa/crud-matrix.behavior.test.ts`
- existing care CRUD, lifecycle, recoverable-delete and owner-isolation suites
- TypeScript, lint/build and mobile browser smoke before release
