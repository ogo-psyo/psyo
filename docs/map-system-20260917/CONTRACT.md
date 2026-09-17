# Authorized release · 2026-09-17
User16889: ship the approved local design system and map; exclude new route exchange.
Source UI: output/pso-motion-lab rev5 and output/pso-map-lab feedback16869. Supersedes older Naris/Arial and reflective control instructions: single Naris, matte controls, calm Motion, light Liquid. Reuse MapZoneService/ProfileService contracts and existing storage/IDs. No new dog questionnaire. No billing/auth changes.
Backend tasks: world-coordinate map presence independent of dating city constraints; temporary community hazards with ownership/expiry; name search without hard bounds and category search; shared profile projection only. Do not silently raise precision of existing signals. New signal preview remains approximate. Existing signals remain visible through compatible reads. Exchange excluded; existing saved data/legacy link functions preserved.
Terminal: source revision + passing required QA + candidate deployment + authenticated cross-user checks + promoted aliases and smoke. No success claim from prototype/localStorage-only checks.

Verification: guest browser scenarios in Chromium/WebKit at 320/390 passed (manual route, persisted reload/reopen/GPX, hazard leaves draft intact, search/save place, Naris and profile navigation). Provider search responses are stubbed in browser test, no claim of real provider coverage. Map live API exercised with two simulated principals and blocked/expired fixtures; SQL on isolated restored PostgreSQL checks ownership, replay after removal, conflict and ACLs. Physical iPhone/Telegram not directly tested.

Private avatar behavior: only selected active approved asset of an explicitly published map signal can get a 60-second URL for an authenticated, nonblocked viewer. Original social endpoints retain their private-asset exclusion; no document data projected.

Recovery: original deployment dpl_3qNsuim3r611vAvXRWPbgRtroink. Fresh affected-table snapshot decoded successfully against local restored schema (20 pets, 1 signal); direct full pg_dump failed twice due network. Previous full backup remains. This migration adds storage/RPCs and extends the city constraint, without rewriting existing rows.
