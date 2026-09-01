import fs from 'node:fs';

const workspace = fs.readFileSync('components/journey/ProductionMapWorkspace.tsx', 'utf8');
const journey = fs.readFileSync('components/journey/ProductionJourney.tsx', 'utf8');
const liveMap = fs.readFileSync('components/LiveMapClient.tsx', 'utf8');
const liveMapTypes = fs.readFileSync('components/LiveMap.tsx', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const css = fs.readFileSync('components/journey/production-journey.css', 'utf8');
const mapSearchRoute = fs.readFileSync('app/api/map/search/route.ts', 'utf8');

for (const requirement of [
  'data-production-map-workspace',
  'data-route-action="start"',
  'data-route-action="plan"',
  'Начать прогулку',
  'Построить заранее',
  'navigator.geolocation.watchPosition',
  'navigator.geolocation.clearWatch',
  'routeSessionKey',
  'pso.map.active-route.v3:${petId}',
  'Прогулка восстановлена и поставлена на паузу',
  'Попробовать снова',
  'Добавить точку',
  'Удалить незавершённый маршрут',
  'onReplaceRoutePoints',
  'onCenterChange={setMapCenter}',
  'production-map-center-pin',
  'onRouteMetaChange',
  'continueAfterDiscard',
  "next.accuracy > 80",
  'aria-modal="true"',
  'role="combobox"',
  '/api/map/search',
  'Ищу организации и места',
]) {
  if (!workspace.includes(requirement)) throw new Error(`Map workspace is missing: ${requirement}`);
}

if (!journey.includes('mapWorkspace?: ReactNode')) throw new Error('ProductionJourney does not accept the map workspace');
if (!journey.includes('props.mapWorkspace')) throw new Error('MapScreen does not render the map workspace');

for (const requirement of ['export type MapLayerFilter', 'userLocation?:', 'focusPoint?:', 'onCenterChange?:', 'fitDraftRoute?:', 'accessibleLabel?:']) {
  if (!liveMapTypes.includes(requirement)) throw new Error(`LiveMap contract is missing: ${requirement}`);
}
if (!liveMapTypes.includes('searchPoint?:')) throw new Error('LiveMap contract is missing searched-place support');
if (!liveMap.includes('searchPoint &&')) throw new Error('LiveMap client does not render searched places');
for (const requirement of ['useMap', 'MapViewport', 'MapAccessibility', 'moveend()', 'onCenterChange?.', 'map.fitBounds(draft', 'prefers-reduced-motion: reduce', "setAttribute('aria-label', label)"]) {
  if (!liveMap.includes(requirement)) throw new Error(`LiveMap client is missing: ${requirement}`);
}

for (const requirement of [
  'nominatim.openstreetmap.org/search',
  "'User-Agent': 'PsoApp/0.2 (https://pso-mvp.vercel.app)'",
  "query.length < 2",
  "slice(0, 120)",
  "'Cache-Control': 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400'",
  "error: 'search_unavailable'",
]) {
  if (!mapSearchRoute.includes(requirement)) throw new Error(`Map search API is missing: ${requirement}`);
}

for (const requirement of [
  'mapWorkspace={<ProductionMapWorkspace',
  'onReplaceRoutePoints={setRoutePoints}',
  'onRouteMetaChange={setMapRouteMeta}',
  'data-map-saved-content',
  'data-map-composer-content',
]) {
  if (!page.includes(requirement)) throw new Error(`Map workspace wiring is missing: ${requirement}`);
}

for (const requirement of [
  '.production-map-canvas .live-map-frame',
  '.production-map-workspace.route-focus',
  '.production-route-controller',
  '.production-route-start',
  'white-space: normal',
  ':focus-visible',
  'min-height: 44px',
  '@media (prefers-reduced-motion: reduce)',
]) {
  if (!css.includes(requirement)) throw new Error(`Map workspace CSS is missing: ${requirement}`);
}

console.log('map workspace contract: ok');
