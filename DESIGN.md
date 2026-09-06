---
name: "Псё"
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
  focus-blue: "#315ea8"
  danger: "#a63f3f"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "36px"
    fontWeight: 550
    lineHeight: 1.12
    letterSpacing: "-0.033em"
  page-heading:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "30px"
    fontWeight: 550
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  field:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
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
  field: "13px"
  working-panel: "18px"
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
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  field:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.field}"
    height: "48px"
    padding: "11px 12px"
  back-action:
    backgroundColor: "transparent"
    textColor: "{colors.forest}"
    height: "44px"
    padding: "0"
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

This records the locally built journal v6, not a deployment. The owner selected B on 2026-09-06; that explicit choice supersedes the rejected v5 visual system. Following the owner’s «Обнови все» instruction, the same world now extends through secondary care, health, habits, documents, sharing, settings, onboarding, and public/legal surfaces. Evidence is app/companion.css, the active stylesheet cascade, ProfileMemoryWorkspace.module.css, and the shared WatercolorScreen/PageHeader components. This is a source-grounded design snapshot; functional gates and the fresh finish review are tracked separately, not claimed complete here. PRODUCT.md still governs privacy, honest state feedback, and accessible interaction; surface composition and verification evidence belong in artifacts/design-v6/BRIEF.md.

**Key Characteristics:**

- Native system typography with light display emphasis and clear working labels.
- Muted forest actions inside restrained lilac and paper fields.
- Flat chronological and domain rows with quiet straight dividers.
- A compact wordmark, real dog identity, and an arched profile portrait.
- Five persistent destinations, a safe-area-aware dock, and a responsive desktop workspace.
- Consistent plain page headers, paper form fields, flat working lists, and opaque modal sheets.

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
- **Shared aliases:** Controls, editors, onboarding, and public surfaces now resolve to the same ink, line, paper, mint, and forest primitives; historical alias names do not introduce a second palette.
- **Focus blue:** Inherited visible keyboard focus, separate from the forest action role.

**The Forest Action Rule.** Forest identifies the decisive action; lilac groups capture and reflection, while mint marks a quiet selected or completed state. None replaces a readable label.

## Typography

**Display Font:** Native system sans (Apple system, BlinkMacSystemFont, Segoe UI, sans-serif).
**Body Font:** The same stack.

The user explicitly pinned system typography; that decision overrides generic custom-display advice. Sentence-case headings use modest negative tracking and balanced wrapping. Weight, spacing, and chronological alignment do more work than a large type-scale jump.

### Hierarchy

- **Display:** The reusable journal page-title role in the frontmatter. Profile identity is a nearby (34px) variant.
- **Page heading:** Secondary working pages use the frontmatter page-heading role, reducing to (28px) below (360px). Their real page title is an h1; decorative header asides and inherited eyebrows are not part of this header pattern.
- **Headline:** The record invitation heading; no oversized promotional hero.
- **Title:** The journal section heading. Compact status, profile index, and recent-history headings use (16px).
- **Body:** Supporting capture and empty-state copy. Timeline titles use the row-title size with a looser (1.5) line height. Secondary page descriptions use (14px/1.5), with a (48ch) maximum measure; legal prose uses (16px/1.65).
- **Label:** Dates, descriptions, and quiet links; tighter profile metadata uses (11px). Time columns use tabular numerals.
- **Control:** Journal capture actions. Shared secondary controls retain their existing (15px) text; editable inputs remain (16px).
- **Navigation:** Compact mobile labels; active text increases to (600) weight without enlarging the entire button.

**The Familiar Type Rule.** Use the owner-pinned native system stack for both headings and working text; do not restore the superseded custom display pairing.

## Layout

The journal is a continuous reading column, not a second phone inside the app. Home and profile share a maximum width of (760px), standard phone insets from the frontmatter, and a dock clearance of (100px) plus bottom safe area. Below (360px), horizontal insets become (19px), the masthead shortens from (70px) to (64px), and compact row copy steps down. At desktop width, the masthead is (80px) and the reading column uses the desktop inset.

Home expresses day/status → journal → assistant; profile expresses identity → capture → domains → recent history. These are the approved surfaces, not a requirement to copy identical composition onto maps or editors. Chronology uses a time column (40px), a circular point column (28px), then fluid text; long record titles clamp to two lines while the existing destination opens their context. Domain and recent-history rows have straight, full-width dividers, no card frame, and flexible text.

Below (760px), the fixed full-width dock has five equal icon-and-label destinations: Главная → dog name (Профиль fallback) → Карта → Гав → Вещи. It reserves safe-area padding and uses route targets at least (54px) high. The dog name may truncate visually but remains the control’s accessible text.

At (760px), the shell becomes a desktop workspace with (190px) navigation and a (260px) context rail around fluid content. Between (760px) and (1100px), the context rail is hidden and navigation narrows to (168px). Desktop route rows are horizontal. The separate assistant CTA retains its dark treatment; transparent route resets apply only to destination buttons.

Secondary working pages use an (800px) maximum width, (24px) content gaps, the same responsive horizontal insets, and (104px) bottom clearance plus safe area. A plain back action precedes the real page heading. Profile’s internal return control is a compact pale-mint (44px) icon button rather than the text-back variant. The selected dog switcher and sign-out controls live in settings; ordinary journal pages do not repeat account chrome.

Public dog cards use a (520px) reading container, an arched portrait, and flat safety rows with a lilac approach field. Legal text uses a (720px) container, generous leading, and restrained lilac callouts. Onboarding and identity creation inherit the same paper/forest palette rather than another visual world.

## Elevation & Depth

Depth is restrained and material-led. Static botanical and lilac radial washes sit behind paper; capture panels use tonal grouping; ordinary journal rows and profile portrait stay shadowless. Primary journal actions have a very small soft shadow. Floating social controls and scenario workspaces retain a low ambient shadow; temporary sheets use stronger upward separation. The dock is translucent paper with a quiet upper shadow and blur.

### Shadow Vocabulary

- **Journal action:** A tiny forest-tinted lift beneath the decisive action.
- **Ambient paper:** Floating social controls and opened scenario workspaces.
- **Sheet:** Soft upward separation for attached assistant sheets and map details.
- **Modal:** Opaque paper dialogs and detached social/profile editors with soft ambient elevation. Social modals also have a dim backdrop, and their parent map stacking context is raised above the dock while the modal owns interaction.
- **Dock:** Subtle upper boundary; not a floating pill.

Exact recipes live in the sidecar.

**The Quiet Paper Rule.** Chronology and indexes stay flat. Use a small ambient shadow for an action or floating working surface, not for every record.

Controls inherit short (160ms) color/border/transform transitions. Scenario reveal is a small (200ms) movement, not page choreography. Reduced-motion mode removes animation, transitions, and smooth scrolling; the watercolor canvas is static.

## Shapes

Capture panels have soft rounded corners; journal actions are slightly tighter. Domain icon tiles are compact rounded squares. Timeline points and the masthead dog avatar are circular. The profile portrait is a distinct arch with rounded lower corners (50px 50px 24px 24px), normally (88px × 100px), narrowing to (73px × 91px) below (360px). Preserve this silhouette when replacing its real photo or monogram.

Index and recent-history rows have zero corner radius and straight dividers. The mobile dock and shell are full-width with no simulated device-frame rounding. Attached assistant and map sheets round their top corners; detached social, identity, and editor dialogs use fully rounded (24px) paper surfaces. Maps retain their real geometry within a gently rounded workspace.

## Components

### Buttons

The journal primary action is full width, forest with white text, an inline SVG, and the frontmatter’s (49px) baseline minimum height; it can grow with content. Shared primary/care controls carry the same muted forest language. Secondary controls use transparent paper-facing surfaces with a quiet or ink outline; ghost controls remove that outline. Danger uses explicit destructive text and border. Preserve shared disabled/busy behavior. Keyboard focus is a visible blue outline (3px) with offset (3px); existing pointer feedback is brief and removed in reduced-motion mode.

The shared page back action is plain forest text with an SVG arrow, no enclosing fill, border, or radius, and a (44px) minimum target. Working row actions use restrained pale-mint fills; destructive row actions use explicit danger text on pale rose. This does not change the primary journal action’s geometry.

### Chips / Filter Actions

Social filters use pale mint and forest text with touch-sized controls; selected social modes use forest and raised-paper text. Labels and pressed state communicate selection. Care view toggles use a pale-mint track with a raised-paper selected segment. Calendar days are flat: selected days use forest/white and today uses mint when not selected. Health and social choice controls pair selected mint with a forest boundary and explicit active or pressed state. Do not borrow the legacy glossy badge treatment as a journal primitive.

### Cards / Containers

Lilac is the recurring capture container on profile and things; the home status panel is a related gradient with a slightly softer radius. Keep one primary action inside the capture field. Ordinary history stays outside card frames. Raised-paper working surfaces remain available for editors, scenarios, and floating map controls. Care, health, habits, and wishlist records now use flat rows with quiet bottom dividers. Quick-add, health capture, and habit/item creation use lilac groupings; settings utility panels use a muted neutral surface without decorative elevation. Publication lifecycle and standalone profile observation capture also use borderless, shadowless lilac record panels with paper icon/field surfaces and forest controls; lifecycle state remains explicit in copy.

### Inputs / Fields

Secondary working inputs, selects, and textareas use raised paper, readable ink, quiet borders, the frontmatter field radius and inset, and visible labels/hints. They have a (48px) baseline minimum height and use the frontmatter field typography. Profile identity editors retain their contextual shared field geometry while adopting the same flat paper and regular weight. Checkbox and radio geometry is not replaced by the text-field rule. Standalone observation capture uses regular-weight explanatory copy and placeholders, paper text entry, and forest microphone/send controls. Disabled send is an opaque muted-mint surface with soft-ink text, not an enabled-looking forest action. Existing validation, confirmation, source errors, and disabled states remain functional states, not decorative variants.

### Navigation

Only the active icon tile receives pale mint; its route background remains transparent and shadowless. Inline SVG icons accompany labels. Preserve the five-route model, real dog name, active-page semantics, and mobile safe area. Assistant entry is available in the journal/profile and desktop rail without covering the mobile dock.

### Journal Chronology and Profile Index

A vertical hairline connects circular event markers beside a tabular time column. Completed points use pale mint and a check; titles and descriptions explain the event. Index rows use a contextual icon tile, two-line hierarchy, and a quiet chevron. Recent history uses a compact date column. Every row opens an existing record flow; empty history is written plainly rather than filled with invented events.

### Dog Identity and Map-first Гав

The masthead keeps the product name distinct from the selected dog. The profile arch is an edit control with a real identity image or honest monogram fallback. Public cards use the same honest image-or-monogram convention; their identity header is flat, without a surrounding border, rounded frame, or shadow. Redundant decorative preview labels do not become part of the publication hierarchy. Гав remains the live social-map workspace: location, filters, invitations, contact release, and consent-aware states stay explicit. Its overlays share paper, forest, and restrained ambient depth; they are not substitutes for the map. Social composer/profile sheets are opaque paper, detached from viewport edges, with a (430px) maximum width and viewport-bounded height. Their dialog stacking context sits above underlying navigation. Map route controls use a flexible three-column action row with wrapping labels; route-risk actions retain explicit danger meaning.

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
