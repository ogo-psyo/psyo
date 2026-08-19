# Псё interface sources

This source map comes from the design-process reel shared on 2026-08-19. It is a decision log, not a list of packages to copy wholesale.

## Sources and roles

- [Refero Styles](https://styles.refero.design/) and [shadcn/ui](https://ui.shadcn.com/): semantic system grammar. Псё uses named surface, ink, action, border, focus, radius, and elevation tokens instead of one-off colors.
- [tweakcn](https://tweakcn.com/): palette calibration and state preview. The selected direction is cool mineral neutrals, deep pine action, and one citron care accent.
- [Mobbin](https://mobbin.com/): real mobile flows. [Headspace iOS flows](https://mobbin.com/apps/headspace-ios-28986bf8-81b2-4af0-84df-b5654a8c98f9/_/flows) are the reference for one dominant action, quiet supporting actions, and calm progressive disclosure.
- [Fontshare](https://www.fontshare.com/) and [Google Fonts](https://fonts.google.com/): type research. Fontshare's featured families in the reel do not provide the required Russian coverage consistently, so Псё uses Cyrillic-capable display and body families.
- [Solar Icons](https://solar-icons.vercel.app/) and [Iconify](https://iconify.design/): icon-family and optical-weight reference. The product keeps its existing Phosphor family to avoid mixing icon languages, with one shared weight and size system.
- [21st.dev](https://21st.dev/): interaction pattern reference, especially compact mobile navigation and tactile button states. Components are not copied into the project; only patterns that preserve Псё's task flow are adapted.
- [Storybook](https://storybook.js.org/): state-coverage model. Every core component is checked in default, active, empty, loading, error, disabled, keyboard-focus, and narrow-mobile states.

## Owner-selected references — 2026-08-19

- [1st-Pouf](https://1st-pouf.worksonmy.dev/): the selected material language. Псё adapts its rounded heavy typography, cushion depth, inset highlights, soft physical shadows, and lavender/pink/mint fields to a task-first mobile product.
- [Iconify pet search](https://icon-sets.iconify.design/?query=pet): icon discovery source. Primary navigation uses one family only — Streamline Plump — with locally embedded SVG paths and no runtime dependency.
- [Tanker on Fontshare](https://www.fontshare.com/fonts/tanker): evaluated but rejected for the wordmark because it has no Cyrillic glyphs. The product name is always `Псё`; Russo One carries the signature and Russian display text, while Nunito remains the body face.
- [Aceternity UI templates](https://ui.aceternity.com/templates): composition reference, not a template dependency. Псё translates bento grids into the Today care-board, timelines into profile observations, expandable cards into progressive disclosure, carousel shelves into Things, and the floating dock into primary navigation. Marketing-only auroras, beams, meteors, 3D cards and scroll spectacle are deliberately excluded.
- [Animate UI](https://animate-ui.com/): motion and state-transition reference. Псё adapts its Tabs, Accordion, Sheet, Progress and Button principles with local CSS: route continuity, active-dock feedback, profile disclosure and tactile press states, all with reduced-motion support.
- [Blockforge](https://blockforge.terravidhal.me/): composition and state-discipline reference. Its useful contribution is not the black developer-tool skin, but the strict block taxonomy, responsive preview modes, compact hairline hierarchy, restrained hover lift, and Builder model where independent sections can be added, reordered, previewed and removed. For Псё this maps to reusable app sections, predictable responsive states, and stronger empty/onboarding/settings patterns. The monochrome terminal aesthetic, dense desktop sidebars, pricing/testimonial patterns, grid wallpaper and permanent ambient motion are not part of Псё's visual language.
- [Elements](https://www.tryelements.dev/): specialist micro-component and integration-state reference, not a replacement for the core design system. Псё can adapt its explicit upload progress variants, accessible progress semantics, compact interactive previews, and the organic Morphing Blob as one branded waiting state. Terminal/glitch loaders, pixel typography, provider badge walls, technical integration chrome and default UI sound effects are excluded; Telegram haptics and quiet visual feedback remain preferable to unsolicited sound.
- [Brainless](https://brainless.swerdlow.dev/components): conversational-state architecture reference. Its useful idea is the explicit separation of message, thinking, action/tool, progress, result, permission and completion states, plus a conversational onboarding composition. Псё may adapt that transparency for assistant replies and consequential confirmations without imitating Claude/Codex/Grok, terminal typography, code diffs, slash menus or developer permission screens. Artificial typing delays are not part of the product.
- [ericts/ui](https://ui.ericts.com/): motion-first product-state reference. The strongest patterns for Псё are Status Button (`idle → loading → success`, error recovery and polite announcements), Adaptive Drawer with measured height, Multi-Step Flow with directional continuity, and touch navigation with axis locking, edge resistance, owned-gesture exclusions and reduced-motion support. Use these patterns for care completion, pet/observation editing, onboarding and bounded horizontal shelves. Context Cursor, Jitter/Squeeze/Heartbeat decoration, marketing scene galleries and swipe navigation between primary app routes are excluded.
- [Owner-selected ColorKit palette](https://colorkit.co/palette/cbfedb-b6fdcd-3df881-07814d-dd617c/): exact brand primitives `#CBFEDB`, `#B6FDCD`, `#3DF881`, `#07814D`, and `#DD617C`. The interface derives only darker emerald text and near-white canvas steps needed for readable product UI.

## Applied visual contract

- Mode: operate. Task clarity beats decoration.
- Palette: the exact owner-selected ColorKit green range drives surfaces, selection, care signal and emerald actions; coral is destructive-only. Pink decoration, purple and beige are absent from the core UI.
- Typography: Russo One for the Cyrillic `Псё` signature and Russian display, Nunito for body copy. The brand is never transliterated in user-facing UI.
- Shape: 16px controls, 20–24px recurring cards and a 30px focal field; pills only for compact selectors.
- Elevation: cushion depth only on interactive controls, actionable cards and major containers; borders and shadows are not stacked.
- Composition: Aceternity-informed care-board, passport timeline, map-first field, trust flow and horizontal shelf; one dominant next action per screen.
- Motion: Animate UI-informed route continuity, disclosure and feedback, with reduced-motion support and no extra dependency.
