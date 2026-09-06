# Псё v5 verification · 2026-09-06

## Artifact
Stable base `239a96b`; branch `design/ios-watercolor-v5-20260906`; isolated worktree `wt-pso-design-v5`.
Local production build served at `http://localhost:3212/?demo=1`. Demo data is illustrative local product state, not a claim about the owner's dog. Production aliases untouched.

## Results
- `npm run qa:local`: PASS; 96/96 tests, Next production build, TypeScript and source contracts; lint 0 errors,218 warnings under220 existing budget.
- `git diff --check`: PASS.
-15 route/viewport geometry cases: today/profile/map/nearby/things at320/390/1280, no horizontal overflow, navigation in bounds.
- All-screen smoke: PASS320/390/1280, real observation timeline, voice disclosure, scenario workspace, direct Gav navigation, profile reachability.
- Map workspace smoke: PASS two route modes at320/390. Real OpenFreeMap style, sprites, glyphs and vector tiles returned200; loaded screenshot `map-loaded-390.png`.
- Gav two-user fixture smoke: PASS signal creation → second user's request → polling/badge. Synthetic API fixtures; no live sends or production records.
- Voice pipeline: PASS320/390/1280, cancel without upload, recording/review/progress/error/empty states and saved observations. Deterministic WebAudio stream feeds actual MediaRecorder; STT/extraction mocked. No claim of real microphone or provider validation.
- Assistant: PASS320×568 and390×844, focus isolation, contextual response, real local reminder action/calendar navigation and route-planning action. Composer bottom554/568 and830/844; API reply mocked.
- Profile breed editor: PASS320/390, English alias filtering, custom fallback and input retention. No production writes.
- Impeccable detector:63 advisory old-DESIGN token/ramp findings only; no other findings. New DESIGN.md and sidecar documented afterward. No second detector run.
- Fresh independent finish review: see `finish-review.md`.

## Harness notes
Adapters in this directory retain source assertions but abort the external Telegram SDK in browser fixtures, use approved renamed navigation labels/current action status copy, close the intentionally opened request sheet in two-user setup, and supply synthetic audio. They are local/browser tests, not live Telegram or backend acceptance.

## Boundaries and remaining release checks
No production deployment, no DB/auth/API changes, no paid provider requests. Live Telegram WebView, real microphone/provider and authenticated production backend smoke remain release checks after approval; current deliverable is a verified local design preview.
