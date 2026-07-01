# Pso Non-MVP Rescue Plan — 2026-06-29

## Situation

Ruslan validated demand at a dog-owner festival: people understand the need and want the product. The current product must not be treated as public-ready until it earns trust in the first minute.

The failure mode is not "bad copy". It is a trust gap:

- screens promised abstract intelligence instead of concrete owner value;
- fake or premature social surfaces implied a network that does not exist;
- browser/email auth copy looked like an account takeover risk;
- share/print did not feel like a useful card for a real sitter/groomer/friend;
- QA protected technical readiness more than owner trust.

## North Star

Pso should feel like a calm operating system for one dog:

1. remember what matters;
2. show the next useful care action;
3. keep a private history;
4. produce a safe short memo for other humans;
5. only then expand into assistant, map, social and commerce.

The product must not look like a deck of nice generated cards. Every first-run block needs a clear owner job.

## Non-MVP Definition

This version is not "full product". It is non-MVP in the sense that it must be coherent, trustworthy and demoable to warm leads without apology.

Required before public push:

- first screen explains the value without oral narration;
- one dog can be created and understood in under 2 minutes;
- first care task can be created, completed and seen in history;
- public memo can be previewed before sharing;
- browser fallback cannot imply "enter any email and see a profile";
- no fake marketplace, fake dog network, fake community or fake AI promises on primary surfaces;
- prod gates prove the visible claims.

## Current Night Slice

Completed in the 2026-06-29 night rescue:

- changed first-run positioning to `план ухода и памятка`;
- removed visible `живой центр собаки` UI copy from first-run shell;
- changed bottom nav `Социализация` to `Памятка`;
- replaced fake nearby-dog swipe flow with public memo preview/checklist/privacy actions;
- removed dead CSS for the fake swipe flow;
- updated metadata toward care plan and public memo;
- updated QA contracts so `Кого встретить`, `Свайпай`, `dog-match-card` cannot return silently;
- deployed to production after local QA and prod smoke.

Completed in the SWARM rescue pass:

- onboarding now ends in a concrete care plan: name, contact rule and first care task;
- Today prioritizes nearest care action, care presets, memo status and care history;
- public memo cannot open/share/print until required trust fields are present;
- public memo area redacts exact-address-looking input to `район скрыт`;
- map is personal-first: public/community controls are hidden from the UI;
- assistant first-use copy is framed around safe care scenarios, not open-ended AI chat;
- cookie-based app session requires `PSYO_SESSION_SIGNING_KEY` and rejects unsafe cross-origin write auth;
- `qa:local` and production smoke passed on deployment `dpl_7oiTYmmkHqyn2pS3ggZuSDRxBbWU`.

## P0 Workstream

### 1. First Use: One Dog, One Care Anchor

Goal: the user should understand the product by doing one useful thing.

Acceptance:

- first visible action is "create dog / add first care task", not "explore app";
- onboarding creates a profile draft and one reminder without hidden side effects;
- Today shows exactly: dog, next task, plan/history, memo status;
- no decorative tags that tell the owner what they already know.

Files:

- `app/page.tsx`
- `app/globals.css`
- `lib/readiness.ts`
- `scripts/qa/check-ux-surface-contract.mjs`

### 2. Public Memo: Safe Sharing

Goal: the memo is useful enough to send to a dog sitter, groomer, friend or person in the yard.

Acceptance:

- preview shows only share-safe fields;
- explicit checklist before sharing;
- no exact address, owner contact, medical notes, medication or private care history;
- print/PDF version fits cleanly and reads as a real handoff card;
- share title says `Памятка`, not `Паспорт`.

Files:

- `app/page.tsx`
- `app/dog/[slug]/page.tsx`
- `app/dog/[slug]/DogCardActions.tsx`
- `app/globals.css`

### 3. Auth Honesty

Goal: the app never implies insecure access to another owner's profile.

Acceptance:

- Telegram Mini App is presented as primary session path;
- browser email is explicitly magic-link only;
- unauthenticated guest/local mode is clearly local and not durable;
- bootstrap/API never expose another owner;
- QA catches unsafe copy and unsafe auth redirect changes.

Files:

- `app/page.tsx`
- `lib/server/auth.ts`
- `lib/server/telegramOwner.ts`
- `app/api/app/bootstrap/route.ts`
- `scripts/qa/check-auth-redirect-source.mjs`
- new/updated auth copy gate if needed.

### 4. Release Gate: Owner Trust

Goal: no public release based only on build success.

Acceptance:

- `npm run qa:local` passes;
- prod smoke covers `/`, public memo, health, map, entitlements, Telegram session error path;
- visual QA exists for mobile main screen and public memo;
- release note states known limitations honestly;
- no fake social/commerce/AI surfaces on primary nav.

Files:

- `scripts/qa/*`
- `docs/TEST_REPORT.md`
- `docs/production-readiness.md`

## P1 Workstream

- Assistant becomes an action engine: answer -> create reminder / memo note / map note.
- Map stays approximate and personal-first; community layer is hidden unless real data exists.
- Wishlist is task-driven only, not marketplace-first.
- Care history supports real owner memory, not just completed reminder rows.
- Add "demo mode" explicitly for sample data, never mixed with real owner's dog.

## Stop Conditions

Do not claim public readiness if any of these is true:

- first screen still needs verbal explanation;
- share/memo exposes private details or looks like a toy card;
- social/community features imply real nearby users without real backend/data;
- auth copy can be read as "enter any email and open a profile";
- visual QA is missing for mobile viewports;
- prod smoke only checks status codes but not owner-facing content.

## Morning Review Script

Use this script when Ruslan wakes up:

1. Open Mini App fresh, not cached browser tab.
2. First 10 seconds: can he say what the app is for?
3. Add/check one care task.
4. Open `Памятка`, inspect what another human sees.
5. Share/print public memo.
6. Check whether any primary screen still feels fake, generic or decorative.

If step 2 fails, stop feature work and fix the first screen again.
