---
name: Псё Pouf Companion
description: Tactile, warm care UI that keeps the owner's next useful action unmistakable.
colors:
  primary-ink: "#06472f"
  muted-ink: "#3e6657"
  canvas: "#f4fff7"
  surface: "#fafffb"
  mint-soft: "#cbfedb"
  green-soft: "#98df73"
  lime-signal: "#3df881"
  accent-emerald: "#07814d"
  danger-coral: "#dd617c"
typography:
  display:
    fontFamily: "Russo One, Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "clamp(2.4375rem, 11vw, 3.375rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.03em"
  brand:
    fontFamily: "Russo One, Nunito, ui-rounded, system-ui, sans-serif"
    fontSize: "2.8125rem"
    fontWeight: 400
    lineHeight: 0.78
  title:
    fontFamily: "Nunito, SF Pro Rounded, ui-rounded, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 900
    lineHeight: 1.15
  body:
    fontFamily: "Nunito, SF Pro Rounded, ui-rounded, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 650
    lineHeight: 1.5
  label:
    fontFamily: "Nunito, SF Pro Rounded, ui-rounded, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 850
    lineHeight: 1.1
rounded:
  control: "16px"
  compact-card: "20px"
  card: "24px"
  focal-field: "30px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary-ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "12px 18px"
  button-secondary:
    backgroundColor: "{colors.mint-soft}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.control}"
    height: "48px"
    padding: "12px 14px"
---

# Design System: Псё Pouf Companion

## Overview

**Creative North Star: "The Care Cushion"**

Псё feels like a reassuring physical object the owner can tap while distracted: soft, rounded and visibly responsive, but never vague. The 1st-Pouf material language supplies the cushion depth, rounded heavy lettering and pastel fields; the product's Operate mode keeps one next action dominant and privacy states explicit.

**Key Characteristics:**

- tactile cushion surfaces with inset light and a soft physical drop;
- Russo One for the Cyrillic Псё signature and display, with Nunito for readable supporting copy;
- deep aubergine ink over lilac, yellow, pink, mint and washed blue fields;
- one dominant action per surface;
- Streamline Plump navigation icons sourced through Iconify.

## Colors

The owner-selected ColorKit palette is exact: `#CBFEDB`, `#98DF73`, `#3DF881`, `#07814D`, `#DD617C`. A darker derived emerald `#06472F` carries body text where the supplied emerald does not provide enough contrast. Lilac, yellow, blue and unrelated decorative hues are outside the product palette; lighter surfaces are tints of the five approved colors.

**The Green Range Rule.** Large regions use mint soft; selected states use green soft; primary actions use emerald with near-white text. Lime signal appears only at the nearest care action, and coral is reserved for destructive states.

## Typography

**Brand font:** Russo One for the Cyrillic `Псё` signature. The product name is never transliterated in user-facing UI.

**Display font:** Russo One for major Russian screen titles and focal actions.

**Body font:** Nunito, with SF Pro Rounded, `ui-rounded` and system sans fallbacks.

Display headings use weight 400, short line lengths and `-0.03em` tracking. Body copy uses weight 650 for resilience on pastel fields. Avoid uppercase decorative labels; hierarchy comes from scale, topology and weight.

## Layout

Mobile is canonical. The working shell spans the viewport, uses 14–24px contrasting rhythms, and reserves safe-area space for the fixed five-item bottom navigation. Today is one asymmetric care-board; Profile is a two-part passport spread; Map starts with a full-height map under floating controls; Nearby overlaps a trust-flow with its action surface; Things is a horizontal shelf rather than a vertical list.

At 768px and above, the product becomes a centered working surface with a contextual rail. Controls remain at least 44px high. No horizontal overflow is allowed at 320px and above.

## Elevation & Depth

Depth is structural and tactile. Cards use a top inset highlight, a low-opacity lower compression shade and a diffuse aubergine drop. The focal Today field and bottom navigation use a stronger version; ordinary text groups remain flat.

**The Cushion Rule.** Apply the full cushion treatment only to an interactive control, an actionable card or a major container. Never stack a border beneath it, and never nest multiple equally elevated cards.

## Shapes

Controls use 16px corners; recurring cards use 20–24px; the focal Today field reaches 30px. Full pills are reserved for compact selectors. Icon containers use small rounded squares that echo the cushion material without becoming separate cards.

## Components

### Buttons

Primary buttons are deep aubergine, 48px high, weight 900 and visibly compress by 1px on press. Secondary buttons use pale lilac with a smaller cushion. Focus uses a 3px purple ring with 3px offset.

### Cards and containers

The default surface is near-white lilac with a 24px radius and cushion depth. Care cards use yellow. Wishlist and contextual cards may rotate through pink, washed blue and mint, while preserving aubergine text contrast.

### Inputs

Inputs are 48px high, borderless, pale lilac and recessed with an inner shadow. Placeholder text remains opaque and readable.

### Navigation

The mobile navigation is a near-white 25px cushion with five equal routes: Всё, Псё, Карта, Рядом, Вещи. The active item uses lavender fill and the same aubergine ink. All icons come from Streamline Plump; do not mix icon families inside navigation.

## Composition references

Aceternity is used as a topology library, not as a marketing-template skin. The product-safe translations are: bento grid into Today's asymmetric care board, timeline into profile observations, expandable cards into progressive profile disclosure, carousel into the Things shelf, and floating dock into the five-route navigation. Aurora, beams, meteors, 3D cards and decorative scroll reveals are outside the Operate-mode contract.

## Motion

Animate UI supplies the interaction grammar, without adding a runtime dependency. A route change unfolds the next working surface from the bottom navigation; the active dock icon settles into its cushion; profile sections disclose from their summary; press states visibly compress. Routine feedback stays between 140–360ms, uses `cubic-bezier(.16, 1, .3, 1)`, and becomes effectively static under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:

- **Do** keep the next useful care action visually dominant.
- **Do** use pastel color as a large semantic field, not scattered accents.
- **Do** keep privacy and recovery copy beside the action it governs.
- **Do** respect reduced-motion and 44px minimum targets.
- **Do** use motion to explain route continuity, disclosure or action feedback.

### Don't:

- **Don't** turn the product into a maximalist marketing page; task clarity wins.
- **Don't** mix Streamline Plump navigation icons with emoji or unrelated icon families.
- **Don't** stack borders and cushion shadows on the same surface.
- **Don't** use tracked uppercase kickers, gradient text, neon glows or generic SaaS cards.
- **Don't** let commerce, AI or decorative status compete with daily care.
- **Don't** import marketing-template effects that compete with an owner's next task.
