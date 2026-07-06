# PSYO Production Pipeline

Status: working operating model for turning the PRD into production slices.

## Sources Of Truth

- Product PRD: `docs/PSYO_FINAL_PRD.md`
- Implementation tracker: `docs/PSYO_PRD_IMPLEMENTATION_TRACKER.md`
- Production repo: `ogo-psyo/psyo`
- Local quality loop: `../QUALITY_OS.md`
- Continuity: workspace `SESSION-STATE.md`, `memory/working-buffer.md`, and daily notes

## Loop

```text
SYNC -> SLICE -> ISSUE -> BUILD -> VERIFY -> DESIGN REVIEW -> RECORD -> REPORT
```

## Rules

- PSYO is commercial product work for real people, not sandbox work.
- A slice is only acceptable if it creates production-safe value or is clearly marked unfinished/internal.
- GitHub should track execution, but the PRD and implementation tracker remain the product source of truth.
- Keep at most three active P0 slices in flight.
- Do not deploy without explicit approval.
- Do not call a PRD area done until UI, data model, privacy boundaries, QA evidence, tracker update, and production smoke after approved deploy all exist.
- UI work gets a separate taste gate before completion: inspect the browser result, catch visual slop, and fix density, hierarchy, motion, spacing, copy, and responsive behavior instead of accepting merely functional screens.

## Slice Contract

Each slice must include:

- user-facing goal;
- PRD source section;
- acceptance criteria;
- data and persistence boundary;
- privacy/security boundary;
- QA gate;
- likely files touched;
- explicit non-goals.

## GitHub Shape

Preferred GitHub project:

- Project: `PSYO Production`
- Views: `P0 Now`, `PRD Gaps`, `QA/Release`, `Blocked`
- Fields: Status, Priority, Area, PRD Section, Slice, QA Gate, Deploy State
- Statuses: Backlog, Ready, In Progress, Review, Blocked, Done

Use issue titles like:

```text
[PSYO] Persisted dog-specific public card links
```

Default labels:

- `psyo`
- `slice`
- one priority: `p0`, `p1`
- one area: `area:cards`, `area:map`, `area:onboarding`, `area:qa`, etc.

## Default Verification

Run the smallest meaningful gates for the changed surface:

```bash
npm run check
npm run qa:local
```

Add targeted Playwright or contract checks for changed UI, public sharing, auth, owner-scoping, privacy, and generated artifacts.

## Design Review Gate

For changed UI surfaces, run a compact design review before reporting done:

- **Impeccable pass:** inspect the browser output for obvious visual slop, broken spacing, awkward hierarchy, clipping, overflow, and tap-target problems; fix directly in the page.
- **Taste pass:** compare the result against the product context and current design system, then adjust density, contrast, rhythm, copy weight, and composition until it feels like a real product surface rather than a stitched demo.
- **Motion pass:** add or preserve only useful motion: state feedback, transitions, and loading affordances that make the interface feel responsive without hiding latency or creating noise.

## Reporting

Each completed slice report must include:

- what changed;
- files changed;
- verification evidence;
- remaining gaps;
- GitHub issue/project update status;
- deploy status.
