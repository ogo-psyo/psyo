#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const source = [
  readFileSync('components/OpenFreeMapLayer.tsx', 'utf8'),
  readFileSync('components/LiveMapClient.tsx', 'utf8'),
  readFileSync('components/social/WoofLiveMapClient.tsx', 'utf8'),
].join('\n');
const failures = [];

if (!source.includes("tiles.openfreemap.org/styles/positron")) {
  failures.push('product maps must use the keyless OpenFreeMap Positron style');
}

if ((source.match(/<OpenFreeMapLayer/g) || []).length !== 2) {
  failures.push('both the journey map and Гав map must use the shared OpenFreeMap layer');
}

if (!source.includes('<AttributionControl prefix={false}')) {
  failures.push('Leaflet vendor prefix must be disabled while provider attribution remains visible');
}

if (!source.includes('OpenFreeMap') || !source.includes('OpenStreetMap')) {
  failures.push('OpenFreeMap and OpenStreetMap attribution must remain visible');
}

if (/cartocdn\.com|CARTO/i.test(source)) {
  failures.push('legacy CARTO raster tiles must not return: they render API KEY REQUIRED watermarks');
}

if (/yandex/i.test(source)) {
  failures.push('map source must not reference Yandex');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log('map attribution contract ok');
