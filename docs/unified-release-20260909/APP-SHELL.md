# U01 · Connected main entry and direct navigation

Local implementation slice toward the full chosen design, not a new release or claim that every inner form is redesigned.

## Visual source and scope

Use the direction of output/pso-naris-home/05-balanced.png and output/pso-connected-prototype: real NarisovanniySANS, grouped question/input/recent conversation, light cool depth, 5 direct primary entries. The connected prototype is a reference, not a backend specification or complete accepted set of states. No fake mic/upload/simulation controls from it are copied.

Primary navigation: Псё (`today`) → Карта (`map`) → Гав (`nearby`) → Всё (`all`) → Профиль (`profile`). Existing hash routes, entities and forms remain addressable. Purchases (`things`) stays a real subroute from All; care/calendar/health/habits/card remain. Current Today functionality becomes a directly reachable secondary “Дела и записи” (`diary`), not discarded or forced through the agent. All owns tools, Profile owns dog identity/character/passport/settings; contextual links can coexist without duplicate mandatory forms.

## State and interaction

- Main free text uses the existing pet-scoped assistant draft and request pipeline. Submit opens the real conversation with the same text. No keyword-routing demo logic. Blank input never creates a run. Pending/error/back retains text and task. Recent conversation shown only when actual messages/thread/run exist; no demo topic.
- All provides direct destinations: day overview, calendar, records/health, habits, purchases, passport/documents, care card. No automatic creation, dates, reminders or messages.
- Entering/closing secondary pages preserves origin and focus, including All and direct hash entry fallback. Mobile nav active item matches primary owner; direct purchases remain reachable. Existing Map/Gav states, GPS and staged route are not remounted/lost by nav changes.
- Day overview preserves care actions, voice observation flow, trends and actual history. Journal items must open exact source records, not a generic new-entry form; do not invent clock precision for all-day care.
- New main input is >=16px, readable contrast, real keyboard/Enter behavior and reduced-motion. No CSS scaling trick or random filler. Existing font file available; no new dependency install for conversion.
- First-run copy may promise name/profile only, never an automatic task. Existing onboarding remains intact.

## Acceptance / exclusions

Build/full QA plus Chromium/WebKit narrow/short/desktop: free text→run/draft→result/back; actual recent conversation/reload; every primary/All destination/back; typed Things draft across helper; day item exact identity; nav keyboard and long dog names; no source function removed. Compare actual local screenshot with grouped reference. Real Groq/cloud/physical keyboard acceptance remain unverified until their separate gates. Autonomous canonical route save stays open; saved-answer text is not that feature.

## Verification (2026-09-09, local)

204 tests pass. Initial test failure was an obsolete five-tab assertion (Things remains a real secondary destination); the navigation checks now require the new five primary entries plus all old real destinations. Type checking caught the old PrimaryRoute/detail coupling; detail state now uses the actual Tab union. Build, all source contracts and rollout contract pass; lint217/220, unchanged from A06. 25 context SQL projections remain valid; no DB migration for this slice.

`evidence/connected-shell.cjs` passes Chromium/WebKit ×320/390/1280: blank entry does not submit, real question→503→retry, preserved draft/focus on return, every All destination/back, exact day observation/completed reminder, actual latest-run metadata/reload/open, long dog name and480px viewport. API, user and provider responses are synthetic. Existing assistant-surface and agent-map regressions pass four combinations each (14 combined browser cases).

Visual inspection exposed inherited global h1/textarea styles and the old desktop care sidebar. Scoped components now keep actual font size/material; main/All remove the competing sidebar. The enlarged input initially overlapped nav at480px height; compact short-viewport layout fixes it. WebKit does not focus clicked buttons automatically: direct-tool triggers now explicitly capture focus before navigation. Intermediate failed screenshots retained in `evidence/u01-intermediate`, final screenshots named connected-home/tools. These are not physical keyboard/Telegram or live model tests.

## Review and remaining scope

The main performs no writes except an explicit question submit; recent metadata is owner/pet-filtered and private/no-store. No arbitrary UI actions or fabricated topics. All does not create objects. Existing map remains mounted; regression proves old route and source selection persist. New direct day rows share the profile exact-record viewer. No function/API removed.

This slice deliberately does not claim all legacy inner forms are visually transferred. Reminder time precision is not persisted in the existing data model and remains a separate open contract; do not infer it from a noon timestamp. Autonomous canonical walk save, full remaining forms, free-provider entitlement, cloud and physical Telegram gates remain open. No production/provider changes.
