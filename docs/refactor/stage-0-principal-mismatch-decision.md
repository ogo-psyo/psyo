# Principal mismatch characterization

Baseline: `dd541d0`.

## Current behavior

- `socialRequestContext` rejects bearer owner != app-session owner with HTTP 401 and `{ "error": "IDENTITY_PRINCIPAL_MISMATCH" }`.
- Representative care (`/api/reminders`), v1 (`PATCH /api/v1/pets`) and map (`POST /api/map/features`) routes do not compare principals. They silently use the bearer owner before the app-session owner.
- Route-level characterization tests preserve these legacy differences during stage 0.

## Target invariant

Every authenticated route must reject mismatched principals. HTTP 403 is proposed for stage 2a because both credentials can be individually valid while the combined identity assertion is forbidden.

## Stage 0 boundary

Stage 0 records current behavior only. It does not change production auth/session code or rewrite expectations toward the proposed status.

## Owner decision required before stage 2a

- approve HTTP 403 for all principal mismatches; or
- explicitly preserve legacy HTTP 401.

Decision evidence: awaiting owner decision before stage 2a.
