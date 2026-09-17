---
name: "Псё"
description: "The owner-pinned connected interface: Naris throughout, matte lavender controls, calm Motion and light Liquid background."
colors:
  ink: "#3e3947"
  ink-soft: "#7b7186"
  detail-ink: "#817588"
  state-ink: "#6e6087"
  state-paper: "#ede8f1"
  lead: "#777080"
  paper: "#faf9fc"
  backdrop: "#eeedf2"
  white: "#fff"
  action-ink: "#50445f"
  secondary-ink: "#675972"
  secondary-paper: "#ffffff6b"
  field-paper: "#ffffffab"
  field-line: "#d7cfdf"
  row-line: "#dad4e143"
  focus: "#786b94"
  selected: "#e6dfee"
  error-ink: "#964e53"
  error-paper: "#fff1f1"
typography:
  display:
    fontFamily: "Naris"
    fontSize: "44px"
    fontWeight: 400
    lineHeight: 1.13
    letterSpacing: "-0.5px"
  headline:
    fontFamily: "Naris"
    fontSize: "29px"
    fontWeight: 400
    lineHeight: 1.2
  title:
    fontFamily: "Naris, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "Naris, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  lead:
    fontFamily: "Naris, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  control:
    fontFamily: "Naris, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  field:
    fontFamily: "Naris, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Naris, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  navigation:
    fontFamily: "Naris, Arial, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  map-search: "18px"
  map-panel: "24px"
  map-tools: "14px"
  map-dock: "20px"
  field: "16px"
  primary: "16px"
  soft: "27px"
  navigation: "26px"
  navigation-item: "18px"
  badge: "14px"
  chip: "15px"
  circle: "50%"
spacing:
  compact: "8px"
  action-gap: "12px"
  page-inset: "24px"
  narrow-page-inset: "20px"
  soft-inset: "21px"
components:
  button-primary:
    textColor: "{colors.action-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.primary}"
    padding: "12px 19px"
  button-secondary:
    backgroundColor: "{colors.secondary-paper}"
    textColor: "{colors.secondary-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.field}"
    padding: "10px 13px"
  button-text:
    textColor: "#685775"
    typography: "{typography.control}"
    padding: "10px 0"
  button-icon:
    rounded: "{rounded.circle}"
    size: "44px"
  field:
    backgroundColor: "{colors.field-paper}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.field}"
    padding: "13px"
  navigation:
    rounded: "{rounded.navigation}"
    padding: "5px"
  chip:
    backgroundColor: "#ffffff8c"
    textColor: "#74627f"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
    padding: "8px 12px"
  chip-active:
    backgroundColor: "{colors.selected}"
    rounded: "{rounded.chip}"
  soft-panel:
    textColor: "{colors.ink}"
    rounded: "{rounded.soft}"
    padding: "{spacing.soft-inset}"
  list-row:
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "14px 2px"
    width: "100%"
---

# Design System: Псё — Connected interface

## Overview

**Creative North Star: "The owner-pinned connected interface"**

Псё uses handwritten Naris headings, quiet Arial working text, lavender-tinted ink, and translucent white paper. Soft reflections distinguish a composer or actionable panel from the continuous canvas; ordinary records remain readable rows. The personality remains warm, precise, and protective. The selected dog is a real identity, not decorative sample content.

The owner's 2026-09-15 instruction (message 16719) applies the original connected design code to the entire application while preserving all existing product behavior and improving UX. The 20 source views establish visual authority, not a feature ceiling: additional working states reuse their forms, rows, disclosures, and materials. This reconciles and supersedes the previous forest/native-system visual rules, including their desktop rails, full-width dock, and arched profile portrait. It preserves the incumbent commitments to actual owner data, visible privacy and failure states, semantic controls, safe areas, and reduced motion. Original `../output/pso-connected-prototype/style.css`, `app.js`, font, and image references are the visual authority; React and the existing domain services supply live behavior. User-pinned source details, including source eyebrows and the Naris/Arial pairing, take precedence over generic stylistic prohibitions.

This is a source-grounded record of the **local implementation**, not a shipped-system or verified whole-app 1:1 claim. Evidence sampled: `components/exact/exact-interface.css`, `components/exact/exact-extensions.css`, `ExactShell.tsx`, `ExactProfileFields.tsx`, `ExactRecords.tsx`, `ExactProfile.tsx`, `ExactCare.tsx`, `ExactThings.tsx`, `components/app/ConnectedHome.tsx`, the exact branch in `components/journey/ProductionMapWorkspace.tsx`, and their composition in `app/page.tsx`. The source's final cascade, not an intermediate declaration or legacy leak, decides geometry. See `docs/exact-interface-20260915/CONTRACT.md` for current scope and `VERIFICATION.md` / `REVIEW.md` beside it for acceptance evidence. This documentation pass records code. A bounded visual review does not certify unseen states, physical Telegram behavior, live providers, accessibility as a whole, or release readiness.

**Key Characteristics:**

- Naris display and composer lettering paired with regular Arial working text.
- Lavender ink, near-white paper, soft translucent gradients, and diffuse inset light.
- One common header and compact single-column shell with a rounded five-destination navigation tray.
- Flat record rows, soft action panels, outlined fields, native disclosures, and thin inline SVG icons.
- Real dog identity, real geography, and explicit loading, error, permission, and empty states.

## Colors

Lavender is the recurring chromatic family; near-white paper and purple-gray ink carry most of the interface. Frontmatter owns reusable color values; gradient recipes and preview-only tonal ramps live in the sidecar.

### Primary

- **Action ink:** The foreground of pale primary actions, never a replacement forest fill.
- **Focus lavender:** The visible keyboard boundary, distinct from selection.
- **Selected lavender:** Selected chips; the navigation has its own translucent source recipe.
- **State ink / state paper:** Lavender state markers and checkbox accents on extended care, social, and diary surfaces; text carries the actual status.

### Neutral

- **Ink / soft ink / detail ink / lead:** Main copy, muted context, repeated row/form details, and explanatory paragraphs.
- **Paper / backdrop / white:** The inner canvas, outside-shell surround, and crisp material highlights.
- **Secondary paper / secondary ink:** Quiet secondary actions and circular hover surfaces.
- **Field paper / field line / row line:** Legible text entry and quiet row separation.
- **Error ink / error paper:** Explicit failure feedback; retain meaningful text rather than color alone.

**The Source Material Rule.** Preserve the approved translucent lavender-paper recipes; do not substitute the superseded forest, mint, or opaque journal panels.

## Typography

**Display Font:** Naris, supplied by the original `NarisovanniySANS-Regular.ttf` and served in the build from `/fonts/NarisovanniySANS-Regular.ttf`.
**Body Font:** Arial, sans-serif.

Naris supplies the personal, handwritten voice; Arial carries forms, rows, and working detail. The original Naris declaration has no explicit fallback stack; extended diary and social headings explicitly use Naris with Arial/sans-serif fallback. A missing Naris font is a verification failure, not authorization to substitute the old native-system display. Regular weight is the baseline, including labels and source eyebrows; inherited bold or tracked uppercase labels are not the design.

### Hierarchy

- **Display / headline:** The reusable source page and section heading roles in the frontmatter. Extended diary and social section headings retain the same Naris size with observed line-height (1.15); this contextual variant does not replace the source headline role.
- **Title:** Quiet Arial subheadings, not heavy card headings.
- **Body:** Regular row titles and task names share the working-body role.
- **Lead / label:** Supporting context steps down in size without competing with Naris.
- **Control / field / navigation:** Separate working sizes preserve the source's compact hierarchy.

Signature source compositions are not extra global type tokens: the wordmark uses Naris (38px/1); home uses (57px/1.08) with (-1.4px) tracking; composer entry uses (26px/1.25). Source metadata eyebrows use (11px) regular Arial. Preserve these where the original screens use them; do not invent new decorative labels.

**The Two Voices Rule.** Keep Naris for the source's handwritten roles and regular Arial for working text; never inherit the superseded system-font display treatment.

## Layout

The shell is a single flex column with a maximum width of (480px), viewport height (100dvh), isolated overflow, a nonshrinking header, an independently scrolling middle, and a nonshrinking navigation tray. The header has a minimum height of (84px) and insets (17px 23px 8px); content has insets (18px 24px 24px). Do not reintroduce the old desktop sidebar/context-rail layout.

The bottom tray has external insets (7px 15px) and bottom padding `max(16px, env(safe-area-inset-bottom))`. Its five destinations, in order, are Псё → Карта → Гав → Всё → Профиль. Internal navigation state must remain explicit when a child view is open. The brand stays Псё; the header dog identity comes from the selected pet. A single common header owns identity and Back. Child views register their return action and active section with that shell instead of rendering another brand, profile strip, or back bar. Extended map and diary content stays in the middle scroll flow; retired absolute-positioned screen wrappers do not own the viewport.

At widths up to (350px), header horizontal insets become (19px), content insets become (20px), page headings become (39px), the home heading becomes (49px), and navigation minimum widths become (45px). At widths from (800px), the same narrow shell is centered with (24px) vertical margins, height `calc(100dvh - 48px)`, rounded outer corners (32px), and ambient lift. These are observed source breakpoints, not a newly invented tablet grid.

Reusable action rows wrap with (12px) gaps; editable paired fields use two equal columns with the same gap. Lists use restrained dividers and a minimum row height of (73px), with (65px) compact rows. Full-bleed map rectangles cancel the page insets; the default map is (280px) high and expanded map (390px). Real map geometry, attribution, and interaction occupy that rectangle.

Per-screen first-viewport composition and all 20 route details belong to the original source and the contract, not to newly generalized layout rules. In particular, apply the source's trailing overrides: the social photo is (220px) high with a (14px) bottom gap, not the earlier (280px)/(18px) declaration. It contains the actual dog image without cropping the subject. The profile identity uses a rounded square (82px) with (29px) corners, not the superseded arch.

**The Exact Geometry Rule.** Compare the final source cascade at the same viewport and equivalent data; do not bless implementation drift by changing the design record.

**The One Shell Rule.** The common header owns identity and Back; extended product screens contribute content, not duplicate application chrome.

## Elevation & Depth

Depth is diffuse and translucent: layered white gradients, fine white edges, an inset highlight, and soft purple ambient shadows. Ordinary list rows stay flat. Soft working panels blur what lies behind them (18px); the navigation tray uses stronger blur (23px). Primary actions are pale reflective surfaces, not solid dark buttons. Exact material and shadow recipes are in the sidecar; no hard offset-shadow vocabulary is introduced.

Dialogs use pale paper with a dim, blurred backdrop and stronger ambient separation. The source's final live-status strip is static, shadowless, and in flow; the earlier absolute toast recipe is not the reusable status pattern.

Source control feedback is limited to transform/background transitions (150ms) and a pressed scale (.96), enabled only under `prefers-reduced-motion: no-preference`. The additional React page entrance is an implementation deviation, not a motion-system token. Reduced-motion support and focus behavior still need their explicit acceptance checks.

## Shapes

Soft panels, primary actions, fields, navigation, and chips use the distinct rounded roles in the frontmatter; do not flatten their differences into one universal radius. Circular icon controls and completion controls contrast with rounded-square row badges. Rows remain unframed. Note paper and conversation bubbles retain the asymmetric corner treatments found in the source; these are contextual silhouettes, not defaults for every panel.

Inline source SVG icons have no fill, round caps and joins, and a stroke width of (1.6), normally in a (22px) box. Navigation icons use (20px); trailing row icons narrow to (17px). Preserve source path geometry and prevent inherited filled-icon styling.

## Components

### Buttons

Primary actions are pale, lightly reflective rounded surfaces with action ink, a white edge, a minimum height of (48px), and (9px) content gaps. Secondary actions use translucent white, a minimum height of (44px), and (7px) gaps. Text actions have no enclosing panel. Circular icon actions are (44px) square and gain a translucent hover fill. Button minimum heights, borders, gradients, shadows, and motion live in sidecar snippets rather than invalid frontmatter properties.

Keyboard controls use a source lavender outline (2px) offset by (3px). Disabled source buttons have half opacity and a wait cursor; functional pending/error copy must still explain state. Do not infer that this source treatment proves every disabled state or target meets accessibility acceptance.

### Chips / Filter Actions

Compact rounded chips have a white edge and translucent fill, with a (40px) minimum height. Selected chips use lavender; pressed chips add an inset boundary and semantic pressed state. Preserve labels rather than relying on fill alone.

### Cards / Containers

Soft panels use the frontmatter inset and radius with the source white gradient, edge, blur, and diffuse shadows. The home composer is a specific soft-panel variant with inset (19px 17px 12px). Do not turn flat history and profile-index rows into elevated cards. Their titles remain regular weight with smaller contextual detail and a thin trailing chevron.

### Inputs / Fields

Working fields have translucent paper, a quiet lavender boundary, the field type role, and visible associated labels. Textareas use a (130px) minimum height and vertical resizing where the source permits it. The home composer is intentionally borderless with handwritten entry and a (65px) text area. Preserve real drafts and field errors; do not import the prototype's seeded records or simulate a successful save.

### Navigation

The rounded floating tray is part of the approved source. Each destination groups an inline icon and small label; only the active destination receives the translucent lavender tile. Keep `aria-current`, child-view section selection, source icon geometry, safe-area space, and the five-route order. Source links may be controlled React buttons without changing their visual metrics. The shared page wrapper records per-view scroll position and directs entry focus to the heading; behavior still requires its own acceptance checks.

### Functional Forms and Disclosures

Existing product functions extend the source primitives, not a second visual theme. Native details/summary groups keep profile fields, observation metrics, purchase category/date, document metadata, care calendar/history, and map tools available without flattening every option into the initial view. Summaries are regular Arial (13px), at least (44px) high, with insets (10px 0); groups use the observed field rhythm (19px). They retain native disclosure semantics and the same lavender keyboard outline as other controls. No extra decorative hover treatment is established for summaries.

Extended text fields reuse the source field geometry and visible labels; extension forms are single-column with wrapping action rows. Checkboxes and radio controls remain native, using lavender accents and associated text, rather than being styled as full-width text inputs. Social scenario choices use the source chip silhouette with a checked inset boundary; their labels stay regular, sentence-case working text. Existing handler, draft, confirmation, receipt, privacy, and error semantics remain product-owned.

**The Contextual Access Rule.** Preserve additional product actions in the section where they belong, using source rows and disclosures; do not funnel them through a global ellipsis menu or remove them because the mockups omit them.

### Identity, Records, and Maps

Profile identity is an actual image or honest initial in the source rounded-square frame. Social imagery uses the final source photo rectangle and contain behavior. Chronology and preference/document records use flat rows; source note paper and conversation bubbles carry their own reading hierarchy. Real geography replaces the prototype map drawing without turning the map into an ornamental background. Actual record IDs, dates, names, failure states, and consent boundaries remain service-owned facts.

## Do's and Don'ts

### Do:

- Do treat all 20 original connected views and their final CSS cascade as the approved visual source for the entire application, including existing states beyond those views.
- Do preserve Naris/Arial roles, lavender-paper materials, source eyebrows, thin SVG icons, and exact source geometry.
- Do bind names, dates, photos, maps, and records to real product state or honest empty states.
- Do keep one common header and expose extended functions through contextual source rows, fields, and disclosures.
- Do keep visible focus, reduced-motion behavior, safe-area spacing, and explicit privacy and error feedback.
- Do verify comparable views and functional parity before claiming the entire interface is complete or 1:1.

### Don't:

- Don't restore forest primary buttons, native-system display headings, desktop rails, the old dock, or the arched profile silhouette.
- Don't canonize legacy green treatments, inherited bold labels, duplicate chrome, intermediate source declarations, added page motion, or unverified implementation deviations.
- Don't treat prototype sample data, simulated social acceptance, or a screenshot as evidence of real service behavior.
- Don't delete product-only features merely because they were absent from the 20 source views or hide them behind a global ellipsis menu.
- Don't use this design record as a claim of deployment, completed accessibility review, or closed functional/visual acceptance.


## Approved update · 2026-09-17
Latest source: local Motion lab revision 5 and map lab. All text uses Naris; inputs stay 16px. Matte selected lavender primary, no metallic gradients or decorative CTA icons. Motion indicator and panel entrance use 280ms; native disclosure height transition 340ms is intentional, reduced-motion disabled. Light Liquid uses a bounded WebGL canvas, pauses while hidden and respects reduced motion; static paper fallback.
Map fills the available content area with a search overlay, tools, a contextual panel and a compact action dock. No new route exchange in this release. Existing account data, saved links and tools remain.
