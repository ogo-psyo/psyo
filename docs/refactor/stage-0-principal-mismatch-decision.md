# Principal mismatch characterization

Baseline: `dd541d0`.

## Current behavior

- `socialRequestContext` rejects bearer/app-session owner mismatch with `401` and `{ "error": "IDENTITY_PRINCIPAL_MISMATCH" }`.
- Care routes represented by `GET /api/reminders` and `POST /api/reminders` do not compare bearer and app-session principals. When both are present, bearer owner takes precedence.
- V1 routes represented by `PATCH /api/v1/pets` do not compare bearer and app-session principals. When both are present, bearer owner takes precedence.
- Map routes represented by `POST /api/map/features` do not compare bearer and app-session principals. When both are present, bearer owner takes precedence.

## Target invariant

- `bearer owner != app-session owner` must be rejected before owner-scoped storage access.
- The proposed target status for stage 2a is `403`.

## Stage 0

- Current behavior is characterized only.
- Production auth/session code is not changed.
- Test expectations are not rewritten toward the future stage 2a behavior.

## Owner decision before stage 2a

- Approve `403` for principal mismatch.
- Or explicitly keep legacy `401`.

No owner decision source for `403` is recorded in this repository yet.
