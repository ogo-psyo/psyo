# Figma Handoff

## Importable artifact

Import or drag this SVG into the Figma board:

`docs/pso-hld-soa-2026-06-24/figma-board-pso-hld-soa.svg`

For the deeper screen/entity pass, import:

`docs/pso-hld-soa-2026-06-24/figma-board-pso-screen-entity-detail.svg`

For the DB schema RU/EN table, import:

`docs/pso-hld-soa-2026-06-24/figma-board-pso-db-schema-ru-en.svg`

It contains four large frames:

1. HLD
2. SOA domains
3. Entity map
4. Screen-to-service map

The detail board adds:

1. screen jobs;
2. per-screen entities;
3. read/write actions;
4. entity lifecycle/ownership cards.

## Local bridge status

Figma Desktop is open, but the OpenClaw Local Bridge plugin was not polling when this artifact was created. The local bridge server can queue commands on `127.0.0.1:4777`, but Figma must run the development plugin and press Start polling for editable node creation.

Recommended fallback: import the SVG now, then convert important parts into editable Figma nodes during the next design pass.
