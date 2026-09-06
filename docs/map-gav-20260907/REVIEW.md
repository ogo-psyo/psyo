# Final review log (ongoing until release)

## Correctness and integrity

- Separate folded view vs destructive discard; named/recorded work not treated as empty. Malformed local recovery entries preserved in a recovery slot. GPS-denied fallback cannot silently discard already recorded points.
- Save success is tied to actual response, not a mode change. Stable route/signal/library/proposal retries; library revisions use compare-and-swap, preserve competing edit.
- Editing a saved planned route keeps target ID in the persisted draft. Recorded history is reused as a planned copy, not rewritten through the UI.
- Geometry validates numeric/range and recognizes existing PostGIS encodings. GPS missing segments excluded from both display and measured distance.

## Security and privacy

- Existing owner/pet guard and mismatch auth rules reused. No demo path to production privileges.
- New collection write path server-only, RLS owner read. New proposals server-only, accepted participant check and database guard. Closed/blocked/other owner denied; organic connection observes current visibility rules.
- Meeting preview is an explicit whitelist. Notes are separate. Coarse source areas retain radius; route excerpt omits points within 500 m of both private ends. Deleted/changed source suppresses snapshot on read.
- No exact coordinates, search terms, personal messages or user IDs in new operational logs.
- No Yandex, new paid provider, public test signal, email, or real contact message.

## Interaction / visual findings fixed

1. Recording-return action under bottom nav → fixed button plus content reserve.
2. Escape from search kept primary sheet hidden → closes search and returns keyboard focus.
3. Select label included option content → explicit accessible labels.
4. Safari click did not focus opener → capture actual trigger and restore it.
5. Composer opened before location bootstrap → populate missing location without replacing an existing draft choice.
6. Search status collided with attribution → separate visible lanes; redundant transient status hidden when selected panel already explains state.
7. Social top controls dominated map → native progressive disclosure, values visible in summary.
8. Duplicate “edit own signal” action → bottom primary entry retained; card only finishes signal.

## Architecture / performance

- No new dependencies, fonts or provider integration. Domain and private storage/meeting panels separated from app shell.
- Recording workspace stays mounted only after first visit, hidden elsewhere; resize observer repairs map size after return. GPS stops on actual teardown, not routine tab navigation.
- Provider requests explicitly submitted, aborted when obsolete, globally rate-gated. Marker grouping preserves selected object. Existing original zones remain privacy circles, not exact markers.
- TypeScript printer used only on new modules to make source readable; no whole-app formatter rewrite.

## Evidence / limits

`SCENARIOS.md`, domain and endpoint tests, SQL transaction log, target browser logs and screenshot pairs form the evidence. Review is by the implementing agent, not an independent reviewer. Browser map tiles are live; mutations and GPS in browser checks are synthetic. Physical Telegram/background GPS and paid-provider routing are not claimed verified.

## Final cross-surface regressions caught before release

9. Keeping the recording component mounted exposed a broad `:has(map)` scroll selector on Home. CSS now scopes only to a visible map wrapper; browser suite checks content scrolling after leaving Map.
10. Intermittent WebKit test stuck at “Обновляю анкеты…” revealed GPS was awaited before fetching discovery. Profile/candidates/signals load first; optional GPS refinement is independent and time-bounded in UI. The fixture deliberately supplies no GPS callback for discovery, so this does not pass by timing luck.
11. Old Gav markers retained neon fill → scoped matte marker/circle palette; periodic social polling no longer refits the camera. Missing basemap is a labelled loading/error/retry state.

12. Gav mandatory attribution fell under bottom navigation → moved to a dedicated top lane, verified on final A/B screenshot.

Final local/browser evidence is recorded in LEDGER.md; production release evidence will be separate.

13. Guest-only production traversal showed indefinite loading before area choice and generic network failure after a 401. Access prerequisites now take precedence in both modes; guest manual-area browsing does not call authenticated social endpoints. An explicit guest regression is added alongside the two-user test.
