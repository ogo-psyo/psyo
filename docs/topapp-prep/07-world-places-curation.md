# World / Places / Curation Prep

## Product thesis

World is not “map tab”. It is the dog-specific layer over the real area:

> Где моей собаке здесь хорошо, безопасно и социально понятно?

## Place types

- `park`
- `safe_walk`
- `risk_zone`
- `clinic`
- `emergency_clinic`
- `vet_pharmacy`
- `pet_shop`
- `grooming`
- `training`
- `pet_friendly_place`

## Trust levels

Do not use one fake “verified” badge.

1. `open_source` — data from public sources.
2. `manual_checked` — manually checked by team.
3. `profile_expanded` — services/equipment/hours known.
4. `user_reviewed` — user reviews exist.
5. `curated_recommended` — internal quality criteria.
6. `partner` — commercial relationship, separate from quality.

## Place fields

- title;
- type;
- approximate lat/lng;
- address;
- phone;
- website;
- hours;
- emergency availability;
- dog-specific tags;
- source;
- last verified date;
- trust level;
- partner flag;
- notes.

## Dog-specific tags

- fenced;
- shade;
- water;
- quiet;
- crowded;
- reactive-friendly;
- puppy-friendly;
- small-dog-friendly;
- big-dog-friendly;
- off-leash risk;
- road risk;
- ticks/grass;
- glass/trash;
- 24/7;
- surgery;
- xray;
- ultrasound;
- emergency.

## First geography

Choose one city/area manually. Do not claim broad coverage.

Starter dataset:

- 5–10 clinics;
- 3 emergency clinics if available;
- 5 parks/walk areas;
- 5 pet shops/pharmacies;
- 3 groomers;
- 5 known risk/safe zones.

## Curation workflow

1. Add public source.
2. Manual phone/site check.
3. Set trust level.
4. Add last verified.
5. Add dog-specific tags.
6. Mark partner status separately.
7. Review monthly or on report.

## First implementation slice

- Add static/seeded places JSON for one geography.
- Render place cards on World tab.
- Add trust level labels.
- Add “new area” summary.
- No user-generated public reports yet.
