---
name: "Псё — Дневник"
description: "A daily dog journal in native system type, muted forest, lilac paper, and quiet chronology."
colors:
  forest: "#405845"
  ink: "#253b34"
  ink-soft: "#617067"
  paper: "#fdfcf9"
  paper-raised: "#fffefa"
  lilac: "#edeaf4"
  lilac-ink: "#706676"
  mint: "#e7eee0"
  nav-mint: "#dce9d9"
  line: "#dfe5dc"
  control-ink: "#233b30"
  control-line: "#d8e0d7"
  focus-blue: "#315ea8"
  danger: "#a63f3f"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "36px"
    fontWeight: 550
    lineHeight: 1.12
    letterSpacing: "-0.033em"
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "21px"
    fontWeight: 550
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  row-title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.35
  label:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 550
  navigation-mobile:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "10px"
    fontWeight: 400
    lineHeight: "14px"
rounded:
  nav-icon: "8px"
  row-icon: "11px"
  control: "14px"
  journal-action: "15px"
  card: "16px"
  record: "20px"
  status: "22px"
  sheet: "24px"
spacing:
  compact: "8px"
  row-gap: "10px"
  control-gap: "12px"
  card-inset: "14px"
  section-inset: "20px"
  page-inset: "24px"
  desktop-inset: "32px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "#fff"
    typography: "{typography.control}"
    rounded: "{rounded.journal-action}"
    height: "49px"
    padding: "12px 14px"
    width: "100%"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.control-ink}"
    rounded: "{rounded.control}"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.control-ink}"
    rounded: "{rounded.control}"
    height: "48px"
  field:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.control-ink}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "11px 13px"
  record:
    backgroundColor: "{colors.lilac}"
    textColor: "{colors.ink}"
    rounded: "{rounded.record}"
    padding: "18px 20px"
  domain-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    height: "69px"
    padding: "14px 0"
  navigation-active-icon:
    backgroundColor: "{colors.nav-mint}"
    textColor: "{colors.forest}"
    rounded: "{rounded.nav-icon}"
    size: "30px"
---

# Design System: Псё — Дневник

## Overview

**Creative North Star: "Дневник"**

Псё is a warm, precise, protective journal for daily life with a dog. The selected B «Дневник» world gives chronology and one observation action visual priority: native Cyrillic system type, muted forest controls, lilac capture fields, and a near-white paper canvas with a mild watercolor wash. The dog is a personal identity anchor, not decorative dashboard imagery.

This records the locally built journal v6, not a deployment. The owner selected B on 2026-09-06; that explicit choice supersedes the rejected v5 visual system. Evidence is app/companion.css, the active stylesheet cascade, and the implemented journal/profile components. PRODUCT.md still governs privacy, honest state feedback, and accessible interaction; surface composition and verification evidence belong in artifacts/design-v6/BRIEF.md.

**Key Characteristics:**

- Native system typography with light display emphasis and clear working labels.
- Muted forest actions inside restrained lilac and paper fields.
- Flat chronological and domain rows with quiet straight dividers.
- A compact wordmark, real dog identity, and an arched profile portrait.
- Five persistent destinations, a safe-area-aware dock, and a responsive desktop workspace.

## Colors

Muted forest sits within botanical paper and soft lilac, with low-chroma contextual accents. The frontmatter owns exact reusable colors; the sidecar carries gradient recipes and preview-only tonal ramps.

### Primary

- **Forest:** Main capture and care actions, selected navigation text, and supporting action links.
- **Mint / navigation mint:** Completed chronology points and the selected navigation icon tile, respectively. The whole active navigation button stays transparent.

### Secondary

- **Lilac / lilac ink:** The reusable capture field and its supporting copy. The home status panel uses a related pale lilac gradient.
- **Danger:** Explicit destructive controls with a written label. Existing pale blue and ochre domain icon fields remain contextual, not primary actions.

### Neutral

- **Ink / soft ink:** Journal foreground and secondary record copy.
- **Paper / raised paper:** Continuous reading canvas and working fields.
- **Line:** Timeline connectors; list dividers are lower-opacity forest strokes.
- **Control ink / control line:** Shared secondary controls and editors preserve these slightly different incumbent values.
- **Focus blue:** Inherited visible keyboard focus, separate from the forest action role.

**The Forest Action Rule.** Forest identifies the decisive action; lilac groups capture and reflection, while mint marks a quiet selected or completed state. None replaces a readable label.

## Typography

**Display Font:** Native system sans (Apple system, BlinkMacSystemFont, Segoe UI, sans-serif).
**Body Font:** The same stack.

The user explicitly pinned system typography; that decision overrides generic custom-display advice. Sentence-case headings use modest negative tracking and balanced wrapping. Weight, spacing, and chronological alignment do more work than a large type-scale jump.

### Hierarchy

- **Display:** The reusable page-title role in the frontmatter. Profile identity is a nearby (34px) variant; ordinary secondary route headings use (30px).
- **Headline:** The record invitation heading; no oversized promotional hero.
- **Title:** The journal section heading. Compact status, profile index, and recent-history headings use (16px).
- **Body:** Supporting capture and empty-state copy. Timeline titles use the row-title size with a looser (1.5) line height.
- **Label:** Dates, descriptions, and quiet links; tighter profile metadata uses (11px). Time columns use tabular numerals.
- **Control:** Journal capture actions. Shared secondary controls retain their existing (15px) text; editable inputs remain (16px).
- **Navigation:** Compact mobile labels; active text increases to (600) weight without enlarging the entire button.

**The Familiar Type Rule.** Use the owner-pinned native system stack for both headings and working text; do not restore the superseded custom display pairing.

## Layout

The journal is a continuous reading column, not a second phone inside the app. Home and profile share a maximum width of (760px), standard phone insets from the frontmatter, and a dock clearance of (100px) plus bottom safe area. Below (360px), horizontal insets become (19px), the masthead shortens from (70px) to (64px), and compact row copy steps down. At desktop width, the masthead is (80px) and the reading column uses the desktop inset.

Home expresses day/status → journal → assistant; profile expresses identity → capture → domains → recent history. These are the approved surfaces, not a requirement to copy identical composition onto maps or editors. Chronology uses a time column (40px), a circular point column (28px), then fluid text; long record titles clamp to two lines while the existing destination opens their context. Domain and recent-history rows have straight, full-width dividers, no card frame, and flexible text.

Below (760px), the fixed full-width dock has five equal icon-and-label destinations: Главная → dog name (Профиль fallback) → Карта → Гав → Вещи. It reserves safe-area padding and uses route targets at least (54px) high. The dog name may truncate visually but remains the control’s accessible text.

At (760px), the shell becomes a desktop workspace with (190px) navigation and a (260px) context rail around fluid content. Between (760px) and (1100px), the context rail is hidden and navigation narrows to (168px). Desktop route rows are horizontal. The separate assistant CTA retains its dark treatment; transparent route resets apply only to destination buttons.

## Elevation & Depth

Depth is restrained and material-led. Static botanical and lilac radial washes sit behind paper; capture panels use tonal grouping; ordinary journal rows and profile portrait stay shadowless. Primary journal actions have a very small soft shadow. Floating social controls and scenario workspaces retain a low ambient shadow; temporary sheets use stronger upward separation. The dock is translucent paper with a quiet upper shadow and blur.

### Shadow Vocabulary

- **Journal action:** A tiny forest-tinted lift beneath the decisive action.
- **Ambient paper:** Floating social controls and opened scenario workspaces.
- **Sheet:** Soft upward separation for temporary document, assistant, and create-dog sheets.
- **Dock:** Subtle upper boundary; not a floating pill.

Exact recipes live in the sidecar.

**The Quiet Paper Rule.** Chronology and indexes stay flat. Use a small ambient shadow for an action or floating working surface, not for every record.

Controls inherit short (160ms) color/border/transform transitions. Scenario reveal is a small (200ms) movement, not page choreography. Reduced-motion mode removes animation, transitions, and smooth scrolling; the watercolor canvas is static.

## Shapes

Capture panels have soft rounded corners; journal actions are slightly tighter. Domain icon tiles are compact rounded squares. Timeline points and the masthead dog avatar are circular. The profile portrait is a distinct arch with rounded lower corners (50px 50px 24px 24px), normally (88px × 100px), narrowing to (73px × 91px) below (360px). Preserve this silhouette when replacing its real photo or monogram.

Index and recent-history rows have zero corner radius and straight dividers. The mobile dock and shell are full-width with no simulated device-frame rounding. Temporary sheets round their top corners only. Maps retain their real geometry within a gently rounded workspace.

## Components

### Buttons

The journal primary action is full width, forest with white text, an inline SVG, and the frontmatter’s (49px) baseline minimum height; it can grow with content. Shared primary/care controls carry the same muted forest language. Secondary controls use transparent paper-facing surfaces with a quiet or ink outline; ghost controls remove that outline. Danger uses explicit destructive text and border. Preserve shared disabled/busy behavior. Keyboard focus is a visible blue outline (3px) with offset (3px); existing pointer feedback is brief and removed in reduced-motion mode.

### Chips / Filter Actions

Social filters use pale mint and forest text with touch-sized controls; selected social modes use forest and raised-paper text. Labels and pressed state communicate selection. Do not borrow the legacy glossy badge treatment as a journal primitive.

### Cards / Containers

Lilac is the recurring capture container on profile and things; the home status panel is a related gradient with a slightly softer radius. Keep one primary action inside the capture field. Ordinary history stays outside card frames. Raised-paper working surfaces remain available for editors, scenarios, and floating map controls.

### Inputs / Fields

Inputs, selects, and textareas use raised paper, readable ink, quiet borders, the shared control radius, and visible labels/hints. Shared fields have a (48px) baseline minimum height with the frontmatter inset; text is (16px). Existing validation, confirmation, source errors, and disabled states remain functional states, not decorative variants.

### Navigation

Only the active icon tile receives pale mint; its route background remains transparent and shadowless. Inline SVG icons accompany labels. Preserve the five-route model, real dog name, active-page semantics, and mobile safe area. Assistant entry is available in the journal/profile and desktop rail without covering the mobile dock.

### Journal Chronology and Profile Index

A vertical hairline connects circular event markers beside a tabular time column. Completed points use pale mint and a check; titles and descriptions explain the event. Index rows use a contextual icon tile, two-line hierarchy, and a quiet chevron. Recent history uses a compact date column. Every row opens an existing record flow; empty history is written plainly rather than filled with invented events.

### Dog Identity and Map-first Гав

The masthead keeps the product name distinct from the selected dog. The profile arch is an edit control with a real identity image or honest monogram fallback. Гав remains the live social-map workspace: location, filters, invitations, contact release, and consent-aware states stay explicit. Its overlays share paper, forest, and restrained ambient depth; they are not substitutes for the map.

## Do's and Don'ts

### Do:

- Do keep Псё as the product name and use the selected dog’s actual name for the profile destination.
- Do pair forest actions with lilac capture fields, paper, and mild watercolor atmosphere.
- Do preserve straight row dividers, the arched identity portrait, and real chronological labels.
- Do keep all five routes, real map interactions, explicit privacy states, visible focus, and device safe-area spacing.
- Do show actual records and honest empty, loading, error, disabled, and permission states.

### Don't:

- Don’t restore neon lime primary actions, heavy black framing, or oversized editorial display typography.
- Don’t turn ordinary timeline and index rows into a grid of elevated cards.
- Don’t use the approved comp’s illustrative dog, dates, or records as fabricated product data.
- Don’t replace a functioning map with a decorative imitation or conceal sharing and consent boundaries.
- Don’t promote leftover compatibility styles or one-off flourishes into new system rules.
