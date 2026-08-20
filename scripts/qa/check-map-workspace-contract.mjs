import fs from 'node:fs';

const workspace = fs.readFileSync('components/journey/ProductionMapWorkspace.tsx', 'utf8');
const journey = fs.readFileSync('components/journey/ProductionJourney.tsx', 'utf8');
const liveMap = fs.readFileSync('components/LiveMapClient.tsx', 'utf8');
const liveMapTypes = fs.readFileSync('components/LiveMap.tsx', 'utf8');
const page = fs.readFileSync('app/page.tsx', 'utf8');
const css = fs.readFileSync('components/journey/production-journey.css', 'utf8');

for (const requirement of [
  'data-production-map-workspace',
  'data-route-action="start"',
  'data-route-action="plan"',
  'Начать прогулку',
  'Построить заранее',
  'navigator.geolocation.watchPosition',
  'navigator.geolocation.clearWatch',
  'ROUTE_SESSION_KEY',
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
]) {
  if (!workspace.includes(requirement)) throw new Error(`Map workspace is missing: ${requirement}`);
}

if (!journey.includes('mapWorkspace?: ReactNode')) throw new Error('ProductionJourney does not accept the map workspace');
if (!journey.includes('props.mapWorkspace')) throw new Error('MapScreen does not render the map workspace');

for (const requirement of ['export type MapLayerFilter', 'userLocation?:', 'focusPoint?:', 'onCenterChange?:', 'fitDraftRoute?:', 'accessibleLabel?:']) {
  if (!liveMapTypes.includes(requirement)) throw new Error(`LiveMap contract is missing: ${requirement}`);
}
for (const requirement of ['useMap', 'MapViewport', 'MapAccessibility', 'moveend()', 'onCenterChange?.', 'map.fitBounds(draft', 'prefers-reduced-motion: reduce', "setAttribute('aria-label', label)"]) {
  if (!liveMap.includes(requirement)) throw new Error(`LiveMap client is missing: ${requirement}`);
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
