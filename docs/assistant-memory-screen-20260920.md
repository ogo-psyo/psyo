# Assistant memory — direct context management

Supersedes PR46 chat-led entry after owner clarification: the home assistant is good; a duplicate chat inside memory adds no value. Here the owner explicitly creates, reads, edits and forgets context.

- Entry/page remain «Память помощника», unique paper/paw art and Naris/lavender.
- Empty shows one text field personalized to active dog and “Запомнить”. No topic/key field, no generated advice, no chat transition.
- Populated shows saved content/source and “Добавить важное”, edit/cancel/save/forget.
- Existing owned /api/agent/memory API remains source of truth. One UUID-based key per draft retained in draft store across lost-response retries; successful confirmed receipt clears draft. No API/schema mutation changes.
- Existing main assistant's ordinary route now reads agent_memories by authorized owner+pet (bounded40, nonnull) alongside profile context; only canonical server values reach provider prompt, data not instructions. Rereads each question. On memory read error returns retryable context error, not falsely memoryless advice. Agent-enabled route already has recall_memory, unchanged. No provider/flag/assistant UI changes.
- Deleting memory removes it from the current saved-memory block; it does not erase statements from old conversation transcripts.
- Distinct loading/read-error/guest states; changed record requires server receipt. No private user records mutated by QA.

Verification: memory-screen.smoke.mjs Chromium390/WebKit320: direct input/no chat call, keyboard visibility, lost POST response after save/retry samekey one record, reload, edit/cancel/error/retry, forget error/retry/other-record retained. assistant-context.behavior.test.ts: canonical memory passed into generation after save/edit, absent after forget, client spoof ignored, owner+pet filters, failed memoryread stops generation. These are API/DB/provider fixtures, not a live paid-model quality evaluation or physical iPhone test.

Art unchanged: public/illustrations/assistant-memory.webp,768×512 realalpha~45KB; original generated PNG retained in generated_images/01a0aed1-99b0-7bd1-bdf0-7753b8bcdcf4/exec-4438a3a4-cbd2-467e-a928-6ce4e7258520.png. Brief: two cream paper notes, plum clip, apricot paw, irregular print lines. Compact when populated, single entrance disabled for reduced motion.
