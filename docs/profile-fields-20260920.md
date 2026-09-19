# Profile fields and welcome · 2026-09-20

User scope: softer sex words, exact/group age, extensive breed autocomplete; remove Telegram badge and add original character illustration with entrance animation. No auth/API/schema/dependency changes.

## Data compatibility
- UI labels Мальчик/Девочка retain stored кобель/сука; existing male/female labels also understood.
- Age mode uses existing string; exact input remains free. Group values remain щенок/юниор/взрослый/зрелый/сеньор. No guessed conversion or universal year thresholds; local form keeps both drafts on toggle.
- Breed directory supplements existing care catalog; existing IDs retain identity and care information, extra breeds/varieties roundtrip through existing custom-breed field. Specific varieties are not silently collapsed into generic breed. Empty selection has no default; mixed/unknown/free text remain available.
- Search is local RU/English/common aliases; keyboard Arrow/Enter/Escape, pointer/touch selection. No requests containing query text.

## Breed source
450 names and varieties from published RKF nomenclature, retrieved 2026-09-20:
https://help.rkf.online/ru/knowledge_base/art/611/cat/487/prilozenie--1-nomenklatura-porod-priznannih-fci-i-rkf-s-klassifikaciej-po-razmeram

Source SHA256: 815cf5a2c8b9d263f806e05175ae0394cacc20b061b91928b06883e993e30a10
Only factual names/English aliases extracted; no care advice copied. Original PDF/list recognition colors and size classifications are not used. Count is varieties as well as breeds, NOT 450 distinct FCI-recognized breeds. Snapshot is not a claim of automatic updates/current worldwide completeness. Names converted to sentence case, coat abbreviations expanded; source typos Хигенская гочая/Пиринейская corrected with original search aliases retained. Existing common Pso names supplement the source.

## Welcome art and motion
Built-in Imagegen, original raster; optimized alpha WebP768x512 (~67KB): public/illustrations/welcome-dog.webp. Transparent cream/lavender naive handprinted dog carrying rope toy beside a bone; no text/scenery/UI. Prompt asks asymmetrical silhouettes, restrained grain, plum features, tiny apricot accent, no watercolor/3D. Original PNG retained in local generated_images/01a0aed1-99b0-7bd1-bdf0-7753b8bcdcf4/exec-57150b7b-451d-4b8c-b0e0-e80d9c5ec879.png.

A single .65s arrival from a small leftward tilt settles at the paws, without delaying interaction, loops or sound. Disabled under prefers-reduced-motion. Image has intrinsic dimensions and empty alt (decorative); entry/action text stays independent. Removed visible Telegram badge; readiness tests use data-auth-ready, actual auth loading/errors remain in existing panels.

## Evidence
See workspace reports/pso-profile-fields-20260920 for local/candidate/production command logs and screenshots. Focused browser paths cover both forms, exact/group draft preservation, RU/English/alias lookup, keyboard/touch selection, Escape not dismissing parent, custom fallback, create/save error-retry and reload. Auth/API transport fixtures only, no claim of real-account or physical-iPhone testing.

### Imagegen production prompt
Create ONE original production UI illustration asset for the Russian dog companion app Pso, NOT a UI mockup. Transparent background with real alpha. A charming slightly odd small cream dog in an enthusiastic play bow, bottom up and floppy ears, holding a lavender rope knot toy in its mouth; one small bone resting beside its front paw. Bold naive hand-cut/linocut-like rounded asymmetrical silhouettes with subtle printed grain INSIDE the shapes. Dark plum tiny eyes and nose, imperfect proportions, characterful understated expression. Editorial indie brand illustration, playful but not babyish, not a generic app mascot. Palette cream #fff9ec, muted lavender #a795bd and dark purple-gray #44394f, tiny apricot accent on toy. Flat shape construction with a little tactile print softness, clean readable silhouette even at 200px. Landscape 3:2 composition, isolated centered dog and bone with compact generous clear edge padding. No text, no lettering, no border, no sticker rim, no background rectangle, no scenery, no cast shadow, no watercolor, no pencil hatching, no photorealism, no 3D render, no UI. The playful character and handprinted shapes should blend into a pale lavender liquid app background.
