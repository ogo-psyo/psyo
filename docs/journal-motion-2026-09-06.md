# Journal B motion — local verified slice

Base production a309ccb. Scope: presentation only; all existing scenarios, API, auth, persistence, reminders and billing unchanged. No dependencies added. New production deployment not performed.

## State and interaction

Ephemeral input mode is unset on initial render, pointer after pointerdown, keyboard after keydown. The client component only manages two passive/capture event listeners; no React state, render loop or durable state. CSS respects OS reduced motion live. Business state remains source of truth for success feedback; no timers postpone actions, unmounts or focus restoration.

## Review

| Before | After | Why |
| --- | --- | --- |
| Mixed/disabled entry effects | 150ms screen opacity, 200ms modal entry | Communicate a new surface without moving fixed navigation |
| Inconsistent press feedback | 120ms scale .96; static opt-out; disabled controls excluded | Pointer acknowledgment without delaying the click |
| Native details jump | 200ms native details-content interpolation where supported; instant fallback | Explain disclosure without rebuilding native semantics |
| Abrupt existing success messages | 180ms opacity; existing positioning transforms untouched | Confirm only already-saved results |
| Static recording dot / assistant busy icon | State-bound pulse/rotation with persistent labels | Explain ongoing work; no idle decoration |
| Keyboard/initial states could inherit motion | New effects gated by pointer input; keyboard and reduced motion cancel transitions | Keep repeated keyboard actions immediate |

The only layout animation is a small, user-triggered native disclosure, not a page; no scroll listeners, global height transitions, scroll hijacking, map transforms or permanent will-change. Unsupported details interpolation degrades to immediate opening. Immediate exits intentionally preserve established dialog dismissal/focus behavior.

## Verification

- npm run qa:local PASS: lint budget, 98 tests, build/typecheck and contracts.
- Chromium and WebKit: actual held-pointer scale, active modal transitions, interruption via Escape, keyboard-open no motion and focus return, rapid disclosure toggles; both normal and reduced motion PASS.
- 42 scroll cases: seven content screens ×320/390/1280 ×Chromium/WebKit. Actual wheel and Chromium mobile touch input; bottom reachable, bounded shell, no horizontal overflow PASS.
- Map two route scenarios320/390 PASS on retry (first run map tile loading overlay blocked click; no forced bypass). Gav two-user fixture PASS. Synthetic voice320/390/1280 PASS, no paid STT.
- Initial press harness needed fonts/layout settling; WebKit pointer-click focus differs from keyboard focus. Final test checks focus restoration on the explicit keyboard path, not a fabricated pointer-focus promise.
- Recording artifacts/motion-b/pso-motion.mp4 uses a fictional profile and guest-only task. Still frames inspected.
- Physical Telegram client, keyboard, screen reader and device frame-rate not verified. No claims of measured 60fps.

## Five-axis verdict

Correctness: UI-only, static state feedback remains, no scenario removed. Readability: dedicated stylesheet and small listener component. Architecture: no new domain/entity/state machine. Privacy: no new data or network traffic. Performance: short targeted transitions; bounded disclosure layout exception. Verdict: ready for owner review; production still the scrolling hotfix.
