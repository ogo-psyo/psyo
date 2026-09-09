# U02 · One purchase list and coherent internal states

Locally implemented. Full Things path, not a decorative cover over the old form. Same canonical wishlist/care APIs, no production changes.

- Always-available title input; category/reason/optional date remain disclosed. No default care task. Enter/add saves once, then permits the next item.
- Actual wanted list, per-item edit/complete/remove, bought history and recoverable remove. Metadata and management are secondary, not required steps.
- Error belongs to purchase action; writing locks at request start, failed input persists, switching pet cannot apply the prior response to the new pet.
- A committed POST/PATCH receipt updates the real item directly. An unrelated bootstrap read failure must not turn a committed purchase into “not saved”. Malformed/missing receipts preserve request and do not invent success.
- Completion of linked care retains the existing atomic care path and its next occurrence semantics. No silent reminder re-creation on restore/return.
- Same grouped/cool material as U01, readable fields, short viewport, back/helper return and exact item editing. Test whole flow including failed write/retry, double submit, changed values, edit, completion, remove/restore, reload and domain/pet isolation.

Open discovered contract: existing core reminder completion also depends on bootstrap after commit; needs receipt-based handling for a complete linked purchase acceptance. Existing reminder time precision is not stored; do not infer exactness from noon. No cloud or live provider proof from browser fixtures.

## Implementation and evidence

- Canonical mutation receipts are validated against the requested pet and item, support camel/snake API shapes, and drive the list directly. Demo/mismatched-pet receipts do not clear a draft or claim a save. Same retry key stays until verified success; changing payload fields gets a distinct key. Request-start lock blocks double submits. Pet reset invalidates the request token, state/draft/edit/optional reminder fields.
- Create/update/remove/restore errors belong to Things. An assistant-suggested purchase uses its own scope; its payload cannot inherit the manual composer’s date/category/reason and does not clear that draft. This is the existing explicit assistant-action UI, not a newly registered universal agent wishlist tool.
- Completed linked care now consumes its atomic RPC receipt, including actual next occurrence/date/status, instead of requiring a second bootstrap. A completed non-recurring linked reminder updates the purchased item in the same UI. No new server persistence semantics or migration.
- Title is immediately available. Metadata is optional; edit remains at the same ID, with failed/closed drafts retained. Completed and removed items remain recoverable via the existing endpoints. Old fixed218px empty rows, tiny titles and default “ordinary priority” clutter removed.

204 tests, build/contracts/lint217 pass. Final scope build plus `things-flow.cjs` passed Chromium/WebKit ×320/390/1280: duplicate submit,503/retry, committed receipts despite bootstrap503, edit failure/close/reopen, clearing reason, bought/return, aborted remove/restore503, linked care completion,reload, foreign/demo receipt rejection, assistant retry without manual-draft contamination. Eight previous assistant/interaction regression cases passed after adapting their fixture to the API’s real `item` envelope and the always-open title input.

All browser/server responses are synthetic; no paid/live provider, cloud/RLS/device or new SQL verification is claimed. Actual server atomicity/migrations remain the separate backend evidence from prior slices.

## Remaining limits

Existing database removal deletes the linked reminder. Restoring that item restores the thing, not its old plan/date; the recovery message makes this explicit. Full reversible restoration of the plan remains a backend/product release item, not a claimed implementation here. General reminder time precision and wider inner screens remain open, as do autonomous canonical agent walk save and live free-provider/cloud/physical-device gates. Production is unchanged.
