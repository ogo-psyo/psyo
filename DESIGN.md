---
name: "Псё"
description: "A calm iOS-like dog companion with system typography, forest actions, and mint–lilac watercolor light."
colors:
  forest: "#245a40"
  ink: "#233b30"
  ink-soft: "#5b685f"
  paper: "#f4f6f2"
  paper-raised: "#fffefa"
  line: "#d8e0d7"
  line-strong: "#456451"
  mint: "#e0eee3"
  moss: "#365c46"
  blue: "#deedf0"
  lilac: "#e8e3f3"
  danger: "#a63f3f"
  yellow: "#f5e9c6"
  pink: "#efdde3"
  focus-blue: "#315ea8"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "30px"
    fontWeight: 730
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.22
    letterSpacing: "-0.025em"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "18px"
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 700
  control:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1
  navigation-mobile:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
rounded:
  compact: "12px"
  control: "14px"
  card: "16px"
  identity: "18px"
  surface: "20px"
  sheet: "24px"
spacing:
  compact: "8px"
  control-gap: "12px"
  card-inset: "14px"
  section-inset: "16px"
  page-inset: "20px"
  section-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper-raised}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  button-care:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.paper-raised}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "0 16px"
  field:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "11px 13px"
  surface-raised:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.surface}"
  surface-flat:
    backgroundColor: "{colors.mint}"
    rounded: "{rounded.surface}"
  navigation-active-mobile:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.forest}"
    typography: "{typography.navigation-mobile}"
    rounded: "{rounded.compact}"
    height: "54px"
  filter-action:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.forest}"
    rounded: "{rounded.control}"
    height: "44px"
---

# Design System: Псё

## Overview

**Creative North Star: "A Familiar Pocket Companion"**

Псё is a warm, precise, protective companion for daily life with one dog. Its owner-approved iOS watercolor world uses familiar system Cyrillic, calm forest actions, soft paper, and diffuse mint–lilac light. The dog remains the personal anchor; typography and usable controls carry the hierarchy.

This document records the local iOS watercolor v5 implementation, not a production-release claim. It refreshes the superseded Living Field Guide direction using app/companion.css, the current shared stylesheet cascade, and implemented route components. PRODUCT.md remains authoritative for privacy, honest state feedback, and accessible interaction; the first-screen composition and verification status stay in artifacts/design-v5/BRIEF.md.

**Key Characteristics:**

- System typography throughout the active companion shell, with compact sentence-case headings.
- Forest primary actions and readable green-black text over soft paper.
- Mint–lilac background washes, quiet dividers, and selective ambient depth.
- Five personal routes with a safe-area-aware mobile dock and responsive desktop rails.
- Real map-first Гав, with paper controls and existing consent-aware social states.

## Colors

Muted botanical neutrals support a restrained forest action color and pastel contextual fields. The frontmatter owns the exact reusable values; gradient recipes remain in the sidecar.

### Primary

- **Forest:** Primary and care buttons, social actions, and selected mobile navigation text.
- **Mint:** Selected mobile route backgrounds, quiet supporting surfaces, and social filter actions.

### Secondary

- **Moss:** Supporting botanical iconography.
- **Spatial blue:** Existing spatial and care context fields.
- **Lilac:** A soft contextual field alongside the mint–lilac atmospheric background.
- **Pale yellow and pink:** Supporting things and utility surfaces, not competing primary actions.
- **Danger:** Explicit destructive controls; never infer danger from color without text.

### Neutral

- **Ink / soft ink:** Primary text and secondary explanation respectively.
- **Paper / raised paper:** Continuous canvas and readable working surfaces.
- **Line / strong line:** Quiet dividers and stronger control boundaries.
- **Focus blue:** Keyboard focus, not a route or brand accent.

**The Forest Action Rule.** Forest carries the primary action; pale mint supports selection. Lilac and other pastel fields provide atmosphere or context, never a substitute for a readable label.

## Typography

**Display Font:** Native system sans (Apple system, BlinkMacSystemFont, Segoe UI, sans-serif).
**Body Font:** The same stack.

The explicit owner-approved system face takes precedence over generic custom-display-font guidance. Headings are sentence case with balanced wrapping and slight negative tracking. Working copy is lighter than headings; buttons use medium emphasis rather than poster-like weight.

### Hierarchy

- **Display:** Standard route headings use the frontmatter display role; narrow screens below 360px reduce them to 28px. The desktop home greeting is 34px.
- **Headline:** Section headings use the headline role.
- **Title:** Tertiary headings use the title role; the compact dog identity has a distinct 20px, 700-weight name.
- **Body:** Supporting explanatory copy uses the body role; existing detailed records retain their contextual sizes.
- **Label:** Field labels use the label role. Mobile route labels use the separate navigation role and truncate long dog names.
- **Control:** Shared buttons use the control role. Inputs, selects, and textareas remain 16px for phone readability and native zoom behavior.

**The Familiar Type Rule.** Use the owner-approved system stack for both headings and working text; do not restore the superseded Unbounded/Manrope display pairing.

## Layout

The phone is primary. Standard journey pages use 20px horizontal insets and 24px section gaps; below 360px the inset becomes 16px. The page reserves bottom space for the dock and device safe area. Scenario choices form a two-column row system, not a grid of competing hero cards.

The mobile dock spans the viewport edge to edge, with five equal destinations, icon above label, 54px route targets, a quiet top divider, and safe-area padding. Its routes are **Главная → dog name (Профиль fallback) → Карта → Гав → Вещи**. The full dog name remains the control’s accessible text even when visually truncated.

At 760px the shell becomes a desktop workspace: 190px navigation, fluid content, and a 260px context rail. Between 760px and 1100px the context rail is hidden and navigation narrows to 168px. Journey content uses 32px horizontal padding; the home content has an 800px maximum width and 26px section gaps. Desktop navigation uses horizontal icon–label rows, not the mobile stacked arrangement.

## Elevation & Depth

Depth is hybrid: diffuse mint–lilac radial washes establish the canvas; ordinary records stay flat; selected paper actions receive a low ambient shadow. Identity surfaces use a pale linear wash without a shadow. The dark care action and temporary bottom sheets receive stronger but soft elevation. The mobile dock uses a translucent paper surface, subtle upper shadow, and backdrop blur.

### Shadow Vocabulary

- **Ambient paper:** Shared low shadow for freeform scenarios, scenario workspaces, and social controls.
- **Primary action:** Small forest-tinted button shadow.
- **Care action:** More pronounced ambient depth for the nearest-care action.
- **Sheet:** Upward diffuse shadow separates temporary assistant, document, and create-dog sheets.
- **Dock:** Very light upper shadow supports the bottom navigation boundary.

Exact shadow and gradient values are recorded in the sidecar rather than duplicated as primitive tokens.

**The Quiet Depth Rule.** Use diffuse shadows for actionable paper surfaces and temporary sheets; keep ordinary records and structural containers flat.

Motion uses brief state transitions and a small scenario-workspace reveal. Reduced-motion mode removes animation, transitions, and smooth scrolling; whole-screen watercolor animation is disabled.

## Shapes

Controls have gently rounded corners; cards and identity surfaces use successively softer radii. Larger bottom sheets round only their top corners. Quiet one-pixel dividers separate rows, while actionable cards can omit borders. The phone shell and mobile dock remain full-width with no artificial device-frame rounding. Map workspaces clip to a rounded boundary without replacing real map geometry with illustration.

## Components

### Buttons

Forest primary and care variants share paper-colored text and restrained elevation. Shared buttons have a 48px minimum height; their frontmatter height describes the baseline, not a fixed cap. Secondary buttons are transparent with an ink outline; legacy secondary controls can use raised paper. Ghost buttons remove the visible boundary; danger buttons use a danger outline and text. Preserve disabled and busy behavior from the shared Button component. Pointer hover and press provide small movement; focus uses a 3px blue outline with 3px offset.

### Chips / Filter Actions

Social filter actions use mint with forest text, 14px corners, and a 44px minimum target. Selected social mode buttons use forest with paper text. Labels continue to explain the state instead of relying on the fill alone.

### Cards / Containers

Working paper and social cards commonly use 16px corners and the shared ambient shadow only where actionable or floating. Shared Surface containers retain 20px corners and remain flat; raised and outlined variants use the quiet line. Identity and care actions use 18px corners. Plain scenario rows use bottom dividers and a pale selected state.

### Inputs / Fields

Fields use raised paper, ink text, quiet borders, 14px corners, 16px input text, and a 48px minimum height. The shared field inset is 11px vertically and 13px horizontally. Keep visible labels, hints, and blue keyboard focus; errors and disabled states remain functional source states, not new decorative variants.

### Navigation

The mobile active route has a mint background and forest text; all five destinations retain inline SVG icons and text. On desktop the dock becomes a left rail with horizontal icon–label rows. Assistant entry is available from the home masthead and desktop navigation; a floating assistant does not cover the mobile dock.

### Compact Dog Identity and Care Action

The dog identity is a compact avatar, real dog name, breed, and short factual line on a pale mint–lilac wash. It opens the dog profile. A separate forest care action uses a calendar icon and real care text and opens existing care/calendar behavior. The brand is always Псё, not the dog’s name.

### Map-first Гав

Гав opens the live social-map workspace directly. Its existing map, location-dependent state, filters, social mode switch, and consent-aware cards remain real interactive surfaces. Raised paper overlays and forest actions share the same visual vocabulary as the other routes. Approximate location, contact release, invitations, and empty states must not be visually disguised.

## Do's and Don'ts

### Do:

- Do keep Псё as the product name and use the selected dog’s actual name for the profile route.
- Do preserve the existing five routes, real map interactions, and explicit privacy and consent states.
- Do use forest actions, soft-paper surfaces, and mint–lilac atmosphere together.
- Do retain visible focus, readable text, safe-area spacing, and reduced-motion behavior.
- Do ground new surfaces in the current stylesheet cascade and actual states rather than historical screenshots.

### Don't:

- Don’t restore neon lime primary actions, heavy black framing, or oversized editorial display typography.
- Don’t turn the watercolor atmosphere into decorative cards that compete with the next useful action.
- Don’t substitute a fake map or discovery teaser for the functioning Гав workspace.
- Don’t hide permission, loading, error, empty, or disabled states behind decorative certainty.
- Don’t promote leftover legacy styles or one-off flourishes into reusable design tokens.
