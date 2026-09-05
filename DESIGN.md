---
name: Псё Living Field Guide
description: A living field guide for one dog, built from warm paper, black linework, and semantic color fields.
colors:
  ink: "#171814"
  ink-soft: "#4e5149"
  paper: "#f7f6f0"
  paper-raised: "#fffdf8"
  line: "#cbcbc2"
  line-strong: "#22231f"
  sage: "#dde3d2"
  moss: "#5b6336"
  lime: "#d8ff72"
  blue: "#a9c7c9"
  lilac: "#c6a9e6"
  coral: "#f05a3d"
  yellow: "#f3df64"
  pink: "#eba4bf"
  focus-blue: "#315ea8"
  watercolor-mint: "#91d6b1"
  watercolor-lilac: "#d9bff0"
  wash-health: "#e7f5eb"
  wash-care: "#fff4c8"
  wash-handoff: "#e6f3ee"
  lime-shadow: "#c9eba7"
typography:
  display:
    fontFamily: "Unbounded, Manrope, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 11vw, 4rem)"
    fontWeight: 700
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Unbounded, Manrope, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.15
  body:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.48
  label:
    fontFamily: "Manrope, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  xs: "8px"
  control: "14px"
  surface: "20px"
  focal: "28px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-raised}"
    rounded: "{rounded.control}"
    height: "48px"
  button-care:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.coral}"
    rounded: "{rounded.control}"
  field:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "11px 13px"
  surface-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  surface-flat:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  surface-raised:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
  navigation-active-mobile:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "54px"
---

# Design System: Псё Living Field Guide

## Overview

**Creative North Star: “The Living Field Guide”**

Псё is a pocket field guide for life with a dog, not a dashboard made from soft cards. The dog, the next useful action, direct observation capture, and the deeper record form one continuous editorial surface.

The visual world is warm, precise, and protective: flat paper, near-black ink, firm linework, concise oversized Cyrillic display type, and semantic color fields. Hierarchy comes from composition, typography, color ownership, and rules—not ornamental effects.

**Key Characteristics:**

- warm paper and paper-raised surfaces joined by black or quiet gray linework;
- Unbounded display moments paired with Manrope for all working copy and controls;
- semantic route and state colors applied to meaningful regions;
- mobile bottom dock and a true three-region editorial workspace on wide screens;
- calm watercolor-gradient atmosphere behind the editorial surface, with restrained depth on focal cards and floating controls.

## Colors

The exact kit palette is neutral paper, near-black ink, subdued botanical neutrals, and a small set of semantic fields. Low-opacity mint, lilac, and yellow washes may blend in the canvas and focal surfaces; they never carry text meaning alone.

### Primary

- **Near-black ink:** The default text, decisive action, strong outline, and active desktop-route color.
- **Signal lime:** The nearest care action and active mobile route.

### Secondary

- **Spatial blue:** Maps, spatial context, completed-care states, and calm health cues.
- **Social lilac:** Nearby and social route fields.
- **Utility yellow:** Things and warning-like utility fields.

### Tertiary

- **Sage:** Dog identity, quiet care, neutral portrait fields, and flat supporting surfaces.
- **Moss:** A restrained botanical support color; never a replacement for near-black action ink.
- **Coral:** Danger, destructive actions, and emphatic item fields.
- **Warm pink:** A reserved kit accent; use only when an implemented semantic state calls for it.

### Neutral

- **Warm paper:** The continuous application canvas.
- **Raised paper:** Inputs, controls, context rail, and temporary contained surfaces.
- **Soft ink:** Secondary copy and inactive navigation.
- **Quiet line:** Dividers and low-emphasis borders.
- **Strong line:** Firm structural separation when near-black would be too dominant.
- **Focus blue:** The accessible keyboard focus outline; it is not decorative color.

### Named Rules

**The Field Rule.** Color owns a meaningful region rather than appearing as scattered decoration: lime for the current action, blue for spatial or completed context, lilac for social, yellow for things, and coral for danger.

**The Exact Kit Rule.** Use the normative palette tokens, including the documented watercolor washes; do not introduce near-duplicate greens, mints, or off-whites.

## Typography

**Display Font:** Unbounded (with Manrope and system sans fallbacks)
**Body Font:** Manrope (with system sans fallbacks)

**Character:** Unbounded gives the Псё signature and major route/day headings a compact, authored silhouette. Manrope keeps controls, records, labels, and longer Russian copy direct and highly legible.

### Hierarchy

- **Display:** Unbounded 700, tightly spaced and approximately 36–64px depending on viewport; only for short brand, route, day, and focal headings.
- **Headline:** Unbounded 700 around 28px for page-level headings below the primary display moment.
- **Title:** Manrope 700 around 22px for task and section headings.
- **Body:** Manrope at 14–15px with roughly 1.4–1.5 line height; explanatory copy generally stays within 68 characters.
- **Label:** Manrope 700 around 11–12px for compact factual metadata and field labels.

### Named Rules

**The Two-Typeface Rule.** Unbounded is reserved for selected display moments; Manrope carries the interface.

**The No-Kicker Rule.** Do not add uppercase or tracked eyebrow labels above headings; headings carry hierarchy themselves.

## Layout

Mobile is a full-width working surface with 14–20px horizontal insets. It reserves bottom safe-area space for a fixed five-route dock: a flat, near-opaque paper bar with a top ink rule, 54px route targets, and a lime active field. Primary actions remain clear of the dock.

At 760px the app stops behaving like a framed phone and becomes a viewport-height editorial desk. Its canonical wide grid is `200px minmax(0, 1fr) 292px`: permanent route rail, fluid scrollable workspace, and contextual rail. The left rail uses a right divider; the context rail uses a left divider and raised paper. At 760–920px, the grid becomes `156px minmax(0, 1fr)` and the context rail is hidden.

The Today workspace uses a two-column internal composition on wider screens, with a large focal care field on the left, capture and assistant on the right, and history below. Deep flows prefer continuous sections and ruled rows over nested card stacks.

## Elevation & Depth

The system remains mostly flat, but focal cards, map frames, sheets, and persistent navigation may use one restrained shadow to establish hierarchy. Watercolor gradients belong to the canvas and semantic focal surfaces; they must not reduce contrast or appear as glow around controls. Overlays use a dark translucent backdrop.

### Shadow Vocabulary

- **Temporary sheet:** (`0 12px 36px rgb(23 24 20 / 14%)`) Only for the dog-creation overlay sheet; it must not migrate to persistent surfaces.

### Named Rules

**The Flat-by-Default Rule.** Persistent surfaces use tone and line, never shadow, to establish hierarchy.

**The No-Gradient Rule.** Use a single flat paper or semantic field; never blend colors to simulate richness.

## Shapes

The form language is softly practical, not pillowy. Compact icon wells use an 8px radius; controls use 14px; ordinary authored surfaces use 20px; focal care and onboarding fields use 28px. Pills are limited to true status pills, while circles are reserved for identity and map-marker geometry. Editorial rows and full-height rails remain square, separated by lines.

## Components

### Buttons

- **Primary:** Near-black fill, raised-paper text, 1px ink border, 14px corners, and a 48px minimum height.
- **Care:** Signal-lime fill with near-black text and border; reserved for the nearest care action.
- **Secondary:** Raised-paper fill, quiet-line border, near-black text, 14px corners, and a 44px minimum height.
- **Ghost:** Transparent fill and border with near-black text.
- **Danger:** Transparent fill with coral text and coral border.
- **States:** All variants use the 160ms state easing, a 3px focus-blue outline with 3px offset, and a 1px downward active translation. Disabled controls use muted gray ink on a quiet gray field.

### Cards / Containers

- **Outlined surface:** Transparent field with a quiet 1px border and 20px corners.
- **Flat surface:** Sage field with 20px corners.
- **Raised surface:** Raised paper with a quiet 1px border and 20px corners; “raised” is tonal, not shadowed.
- **Focal care field:** Lime at rest, spatial blue when complete, near-black border, 28px corners, and generous responsive padding.
- **Rows:** History, settings, and task lists use square transparent rows with bottom dividers instead of individual cards.

### Inputs / Fields

Fields use raised paper, near-black text, a quiet 1px border, 14px corners, 11px × 13px padding, and a 48px minimum height. Observation textareas are taller but retain the same material and focus behavior. Labels sit directly above their field; hints and recovery copy use soft ink and remain adjacent.

### Navigation

The five canonical routes are Всё, Псё, Карта, Гав, and Вещи. Mobile uses the fixed bottom dock and a lime active field. Desktop uses the permanent left contents rail: active items remain transparent and are marked by a 2px near-black line at the rail edge. The assistant is an inline action on mobile content and a dedicated near-black final action in the desktop rail.

### Today Care Field

The recurring focal component combines the next action, supporting copy, completion control, and dog identity in one bordered semantic field. It is deliberately larger than supporting controls and changes from lime to spatial blue when complete.

### Assistant Entry

The assistant entry is a near-black, bordered control with raised-paper text and a small lime icon well. It is part of the layout rather than a persistent floating capsule; the compact floating trigger is mobile-only and remains clear of the dock.

## Do's and Don'ts

### Do:

- **Do** make the nearest useful action the largest semantic field.
- **Do** use the exact kit palette and assign route colors by meaning.
- **Do** use the whole desktop viewport as one connected 200px / fluid / 292px working spread.
- **Do** keep privacy, recovery, labels, and hints beside the action or field they govern.
- **Do** reset route scroll and respect mobile safe-area insets.

### Don't:

- **Don't** render the application as a phone mockup beside utility cards.
- **Don't** use uppercase tracked kickers above headings.
- **Don't** float the assistant over primary content or navigation.
- **Don't** add gradient text, decorative glass, diffuse control glow, or shadows on every surface.
- **Don't** rebuild deep flows from nested, equally elevated cards.
- **Don't** substitute near-duplicate mint or green values for the exact kit palette.
