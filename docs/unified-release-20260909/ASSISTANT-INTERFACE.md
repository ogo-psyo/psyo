# A-02: complete conversation surface (locally verified candidate)

Keep the existing agent/API/domain behavior. Transfer the approved near-white NarisovanniySANS conversation material to the actual assistant, including its secondary states, not just a screenshot of the entry.

- Entry: question and input as one group, contextual suggestions optional. No permanent profile paragraph or three simultaneous prompt cards.
- Conversation: plain readable text; operational objects retain their own editor; composer remains accessible with long replies/small viewport.
- Sources: disclosure next to response actions. Saved answers and memory open dedicated native dialogs, with focus and scroll restored to the conversation on close.
- Memory: actual records, empty/loading/read-failure/retry; add/edit form only after owner chooses it; failed writes retain text; correction/forgetting use existing APIs, no fake local-memory success.
- Saved answers: empty/loading/read-failure/retry and full selected answer. No optimistic empty state before a GET succeeds.
- Keep cancellation, failed-request retry, legacy assistant actions, current pet context and observation review. Closing the assistant leaves the parent form mounted.
- Verify on immutable build Chromium/WebKit320/390, long answer/narrow height, existing agent/observation and return tests. API/provider are synthetic; physical keyboard/live agent remain unverified.

## Implemented / local evidence

- Real `ProductionAssistantSheet` extracted into a scoped component/module, not a second assistant implementation. Sources/follow-up suggestions remain available through disclosure; original action callbacks retained. Plain reply + fixed accessible composer; auxiliary native dialogs keep conversation mounted.
- Existing memory API returns source-run reference/date. Correction keeps the original key read-only (changing a key was actually adding another fact); metadata is not presented as verified medical knowledge. Empty/read-failure/loading are distinct. Draft editing can be closed and resumed within the mounted agent panel; it is not autosaved across closing the whole assistant/reload.
- Assistant-specific errors no longer borrow another module's global error; a failed preset keeps the actual question in the composer. Things now has a visible contextual assistant entry; original purchase form stays mounted.
- Browser found WebKit does not always focus a clicked button. Return target is captured explicitly from the initiating event, not guessed from `activeElement`; nested Escape is contained. Global legacy heading rules now exclude only marked assistant headings, so new typography is not overridden by old `!important` sizes.
- `qa:local`:186 tests/build/contracts passed, unchanged lint216/220. Extracted component required updating the source-contract file target; not weakening the error contract.
- `agent-ui.smoke.mjs`: Chromium/WebKit320/390 passed saved result, read failure/retry (no false empty), failed memory write/input preservation across pane close, correction, forget, nested Escape/focus, cancellation. All APIs mocked.
- New `evidence/assistant-surface.cjs`: same four combinations passed scoped error, failed preset/retry, long answer, 480px viewport, return to original Things draft/focus. Not physical keyboard evidence.
- `journal-motion-ui.smoke.mjs`: both engines, normal/reduced motion passed. 180ms explicit-open animation; no animation for keyboard entry or reduced motion. Prior test assumed old selector/duration; updated to the new native dialog and retained the original keyboard/no-motion behavior.
- `evidence/agent-observation.cjs`: all four combinations still passed after the shared dialog change.

Overall release is still blocked by full product design transfer, remaining tools, real provider/search entitlement, isolated cloud/workflow/storage and physical Telegram acceptance. This surface is not a claim those gates are complete.

Final grouped entry/build check passed: heading is ≥40px, composer directly follows the question with <65px gap, four browser combinations. Saved/library controls remain secondary above this group. Legacy typed reminder creation and map-preplanning actions passed both engines320/390 on synthetic APIs, with zero invented route points. Old guest smoke lacked a complete bootstrap fixture; replaced it with the same isolated owner harness, not a server workaround.
