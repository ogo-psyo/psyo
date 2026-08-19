#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const source = readFileSync('components/LiveMapClient.tsx', 'utf8');
const failures = [];

if (!source.includes("basemaps.cartocdn.com/light_all")) {
  failures.push('map must use the neutral CARTO light tile layer');
}

if (!source.includes('<AttributionControl prefix={false}')) {
  failures.push('Leaflet vendor prefix must be disabled while provider attribution remains visible');
}

if (!source.includes('&copy; OpenStreetMap contributors &copy; CARTO')) {
  failures.push('OSM and CARTO attribution must remain visible');
}

if (/yandex/i.test(source)) {
  failures.push('map source must not reference Yandex');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('map attribution contract ok');
