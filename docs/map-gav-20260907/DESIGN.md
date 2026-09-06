# Scoped map / Gav detail system

Status: implemented local proposal, awaiting final delivery verification. It is **not** v8 or the prior v9 A/B home/profile mockup. Current production fonts, scale, five primary destinations and map-first Gav composition remain.

## Preserve / refine / replace

| Element | Decision and reason |
|---|---|
| Typography, hierarchy, main map sheet and social modes | Preserve current B. No global display-font or size reset. |
| Map and coarse privacy circles | Preserve actual geography and current precision. A coarse area is never rendered as a precise saved point. |
| Glossy green action fill / inset white highlight | Replace with close-value matte forest gradient, diffuse low-opacity shadow, no specular stripe. |
| Panel borders / floating fields | Refine consistent rounded outline, paper-to-sage surface, no nested decorative card per line. |
| Place and cluster markers | Distinct shape/count, 44px interaction box, selected outline, keyboard focus; selected marker never hidden in cluster. |
| No-photo dog | Real name initial, never a stock dog represented as that participant. |
| Empty social state | Small authored vector dog `public/map-gav/empty-companion.svg` in the existing icon slot, not wallpaper or an avatar. No extra layout block. |
| Successful action | Uses server-confirmed result; failed requests retain form and show error, not celebratory animation. |

## Two detail variants on the same real components

A: paper / sage / forest, scoped `app/map-gav.css` implementation. Primary action #446e53 → #376548, surfaces #fbfaf4 → #f0f5ef; ink #294f37. Recommended for continuity with the current application.

B: sand / warm sage / muted olive, `visual-b.css`, **comparison only**, not imported into application. Same content, fonts, layout and actions. The screenshot suite exports both on place, route, live signal, empty discovery and candidate states. Demo fixtures are labelled as such in the comparison artifact; not live owner data.

## States / export

- Normal: readable surface; selected: outline + pressed/selected state, not color alone.
- Focus: 3px forest ring with 3px separation; keyboard operable cluster and waypoint controls.
- Disabled: actual disabled attribute plus reduced opacity; not a fake enabled action.
- Error: text + role=alert, retained input. Success: role=status only after confirmation.
- Entry: opacity/translateY 4px, 180ms ease-out. Press: scale .98, 140ms. No idle looping motion over maps/cards. Existing app motion retained.
- Reduced motion: no newly added entry/press movement. Map pan animation consults system preference.
- Assets are repo-native SVG/CSS/Phosphor vectors. No additional image generation, library, font, paid API, or unrelated product visual reset.

## Verification boundaries

Real components and synthetic anonymized states; browser screenshots are not proof of physical Telegram rendering. Route geometry and map tiles are not replaced by an illustrative background. The comparison is a visual artifact, not a second runtime product branch.
