# Assistant memory — owner control, not a second questionnaire

Approved flow: explicit remember request in existing chat → confirmed memory → personalized future chat → owner can review/edit/forget here. This UI change does not change assistant policy, execution, or backend memory behavior.

- Profile entry and page: «Память помощника».
- Empty: explains what will appear, one explicitly illustrative “Запомни…” example, “Перейти в чат”. No separate creation form.
- CTA calls existing assistant opener. Does not submit, prefill, clear draft, or incur a model request by itself.
- Return from chat re-reads existing owner/pet memory API, reactivates page Back handler and scroll context.
- Saved: readable content/source first, inline edit only on demand; cancel, save, forget. Draft/error/pending guards remain. No schema/API/auth/config changes.
- Loading, read failure/retry and guest availability are distinct from empty. Update/delete require server receipt before success.
- Unique original Imagegen paper-notes/paperclip/paw illustration; public/illustrations/assistant-memory.webp (768×512, alpha, ~45KB). Reduced illustration in populated state. One short entrance; reduced-motion disables it. Lavender/plum/cream/apricot print graphic matching user's reference direction. Welcome and observations art unchanged.
- Original generated PNG retained in generated_images/01a0aed1-99b0-7bd1-bdf0-7753b8bcdcf4/exec-4438a3a4-cbd2-467e-a928-6ce4e7258520.png.

Verification: scripts/qa/memory-screen.smoke.mjs in Chromium390/WebKit320 with synthetic Telegram/API fixture: load error vs empty, no creation fields, illustration loaded, reduced motion, no message send, existing chat draft intact, refreshed records on return, native Back after chat, edit/cancel/error/retry, forget/error/retry preserves other record, final empty. Local qa:local241/build/contracts. Browser fixture evidence does not claim a live model memory write or physical iPhone test.
