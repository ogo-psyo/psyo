'use client';

import { useEffect, useRef, useState } from 'react';
import { AttributionControl, Circle, CircleMarker, MapContainer, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import type { LiveMapProps, MapFeature } from './LiveMap';
import { OpenFreeMapLayer } from './OpenFreeMapLayer';
import 'leaflet/dist/leaflet.css';

const defaultCenter: [number, number] = [55.751244, 37.618423];

function toNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function zoneColor(type: string) {
  if (type === 'risk_zone' || type === 'risk') return '#dd617c';
  if (type === 'clinic') return '#07814d';
  if (type === 'route') return '#07814d';
  if (type === 'shop' || type === 'grooming') return '#98df73';
  return '#3df881';
}

const zoneLabels: Record<string, string> = {
  safe_place: 'безопасное место',
  risk_zone: 'зона риска',
  home_area: 'домашний район',
  walk_route: 'маршрут прогулки',
  route: 'маршрут прогулки',
  clinic: 'ветклиника',
  shop: 'зоомагазин',
  grooming: 'груминг',
  point: 'точка на карте',
};

const visibilityLabels: Record<string, string> = {
  private: 'только владельцу',
  shared: 'по ссылке',
  public: 'публично',
};

function featureRoutePositions(path: MapFeature['path']): [number, number][] {
  const source = Array.isArray(path) ? path[0] : path;
  const coordinates = source?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map((point) => Array.isArray(point) && point.length >= 2 ? [Number(point[1]), Number(point[0])] as [number, number] : null)
    .filter((point): point is [number, number] => Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1])));
}

function draftRoutePositions(routePoints: number[][]): [number, number][] {
  return routePoints
    .map((point) => Array.isArray(point) && point.length >= 2 ? [Number(point[1]), Number(point[0])] as [number, number] : null)
    .filter((point): point is [number, number] => Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1])));
}

function MapEvents({ onMapClick, onPick, onCenterChange }: Pick<LiveMapProps, 'onMapClick' | 'onPick' | 'onCenterChange'>) {
  const map = useMapEvents({
    click(event) {
      const point = {
        lat: Number(event.latlng.lat.toFixed(5)),
        lng: Number(event.latlng.lng.toFixed(5)),
      };
      if (onMapClick) {
        onMapClick({ latlng: point });
        return;
      }
      onPick?.(point);
    },
    moveend() {
      const center = map.getCenter();
      onCenterChange?.({ lat: center.lat, lng: center.lng });
    },
  });
  useEffect(() => {
    const center = map.getCenter();
    onCenterChange?.({ lat: center.lat, lng: center.lng });
  }, [map, onCenterChange]);
  return null;
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function MapAccessibility({ label }: { label: string }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', label);
  }, [label, map]);
  return null;
}

function MapViewport({ zones, features, userLocation, focusPoint, routePoints, fitDraftRoute }: Pick<LiveMapProps, 'zones' | 'features' | 'userLocation' | 'focusPoint' | 'routePoints' | 'fitDraftRoute'>) {
  const map = useMap();
  const orientedRef = useRef(false);
  const focusTokenRef = useRef<number | null>(null);
  const fittedDraftRef = useRef('');

  useEffect(() => {
    const draft = draftRoutePositions(routePoints || []);
    const draftSignature = fitDraftRoute && draft.length > 1
      ? `${draft.length}:${draft[0].join(',')}:${draft.at(-1)?.join(',')}`
      : '';
    if (draftSignature && draftSignature !== fittedDraftRef.current) {
      fittedDraftRef.current = draftSignature;
      const fitCompletedRoute = () => {
        map.invalidateSize({ animate: false });
        const mapHeight = map.getSize().y;
        map.fitBounds(draft, {
          paddingTopLeft: [44, 76],
          paddingBottomRight: [44, Math.round(mapHeight * 0.58)],
          maxZoom: 17,
          animate: false,
        });
      };
      fitCompletedRoute();
      const refitTimer = window.setTimeout(fitCompletedRoute, 140);
      orientedRef.current = true;
      return () => window.clearTimeout(refitTimer);
    }
    if (focusPoint && focusPoint.token !== focusTokenRef.current) {
      focusTokenRef.current = focusPoint.token;
      map.setView([focusPoint.lat, focusPoint.lng], 16, { animate: !reducedMotion() });
      return;
    }
    if (userLocation && !orientedRef.current) {
      orientedRef.current = true;
      map.setView([userLocation.lat, userLocation.lng], 16, { animate: !reducedMotion() });
      return;
    }
    if (orientedRef.current) return;
    const points: [number, number][] = [];
    for (const zone of zones || []) {
      const lat = toNumber(zone.approximate_lat);
      const lng = toNumber(zone.approximate_lng);
      if (lat !== null && lng !== null) points.push([lat, lng]);
    }
    for (const feature of features || []) {
      if (feature.type === 'point') {
        const lat = toNumber(feature.lat);
        const lng = toNumber(feature.lng);
        if (lat !== null && lng !== null) points.push([lat, lng]);
      } else {
        points.push(...featureRoutePositions(feature.path));
      }
    }
    if (points.length === 1) map.setView(points[0], 15, { animate: false });
    if (points.length > 1) map.fitBounds(points, { padding: [44, 44], maxZoom: 15, animate: false });
    orientedRef.current = true;
  }, [features, fitDraftRoute, focusPoint, map, routePoints, userLocation, zones]);
  return null;
}

export function LiveMapClient({
  zones = [],
  features = [],
  picked,
  routePoints = [],
  onPick,
  onMapClick,
  onCenterChange,
  filter = 'all',
  userLocation,
  focusPoint,
  fitDraftRoute = false,
  accessibleLabel = 'Интерактивная карта прогулок и сохранённых мест',
}: LiveMapProps) {
  const [tilesReady, setTilesReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const mappedZones = zones
    .map((zone) => ({
      ...zone,
      lat: toNumber(zone.approximate_lat),
      lng: toNumber(zone.approximate_lng),
      radius: Number(zone.radius_meters || zone.radiusMeters || 500),
    }))
    .filter((zone) => zone.lat !== null && zone.lng !== null)
    .filter((zone) => filter === 'all' || (filter === 'risks' ? zone.type === 'risk_zone' || zone.type === 'risk' : filter === 'places' ? zone.type !== 'risk_zone' && zone.type !== 'risk' : false));
  const mappedFeatures = features.filter((feature) => filter === 'all'
    || (filter === 'routes' && feature.type === 'route')
    || (filter === 'risks' && feature.type === 'point' && (feature.zone_type === 'risk_zone' || feature.zone_type === 'risk'))
    || (filter === 'places' && feature.type === 'point' && feature.zone_type !== 'risk_zone' && feature.zone_type !== 'risk'));
  const draftPositions = draftRoutePositions(routePoints);

  return (
    <div className="live-map-frame">
      <MapContainer center={defaultCenter} zoom={12} className="live-map" zoomControl attributionControl={false} aria-label={accessibleLabel}>
        <MapAccessibility label={accessibleLabel} />
        <AttributionControl prefix={false} />
        <OpenFreeMapLayer onLoad={() => setTilesReady(true)} onError={() => setTilesFailed(true)} />
        <MapEvents onMapClick={onMapClick} onPick={onPick} onCenterChange={onCenterChange} />
        <MapViewport zones={zones} features={features} userLocation={userLocation} focusPoint={focusPoint} routePoints={routePoints} fitDraftRoute={fitDraftRoute} />

        {userLocation && <>
          <Circle center={[userLocation.lat, userLocation.lng]} radius={Math.max(40, Math.min(userLocation.accuracy || 80, 600))} pathOptions={{ color: '#07814d', fillColor: '#3df881', fillOpacity: 0.12, weight: 1 }} interactive={false} />
          <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={8} pathOptions={{ color: '#fafffb', fillColor: '#07814d', fillOpacity: 1, weight: 3 }}><Popup>Вы здесь</Popup></CircleMarker>
        </>}

        {mappedZones.map((zone) => {
        const color = zoneColor(zone.type);
        return (
          <Circle
            key={zone.id}
            center={[zone.lat as number, zone.lng as number]}
            radius={zone.radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.16, weight: 2 }}
          >
            <Popup>
              <b>{zone.title}</b>
              <br />
              {zoneLabels[zone.type] || 'место'}
              {zone.note ? <><br />{zone.note}</> : null}
            </Popup>
          </Circle>
        );
        })}

        {mappedFeatures.map((feat) => {
        if (feat.type === 'point' && feat.lat && feat.lng) {
          const color = zoneColor(feat.zone_type || 'safe_place');
          return (
            <Circle
              key={feat.id}
              center={[Number(feat.lat), Number(feat.lng)]}
              radius={90}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 2 }}
            >
              <Popup>
                <b>{feat.title}</b>
                <br />
                {zoneLabels[feat.zone_type || 'point'] || 'место'} · {visibilityLabels[feat.visibility] || 'только владельцу'}
              </Popup>
            </Circle>
          );
        }

        if (feat.type === 'route' && feat.path) {
          const positions = featureRoutePositions(feat.path);
          if (positions.length < 2) return null;
          return (
            <Polyline
              key={feat.id}
              positions={positions}
              pathOptions={{ color: feat.visibility === 'public' ? '#07814d' : '#3df881', weight: 4 }}
            >
              <Popup>
                <b>{feat.title}</b>
                <br />
                {visibilityLabels[feat.visibility] || 'только владельцу'}
              </Popup>
            </Polyline>
          );
        }

        return null;
        })}

        {draftPositions.length > 1 && (
          <Polyline positions={draftPositions} pathOptions={{ color: '#3df881', weight: 4, dashArray: '6 8' }}>
            <Popup>Новый маршрут</Popup>
          </Polyline>
        )}

        {picked && (
          <CircleMarker center={[picked.lat, picked.lng]} radius={10} pathOptions={{ color: '#fff', fillColor: '#dd617c', fillOpacity: 1, weight: 4 }}>
            <Popup>Новая примерная точка</Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {!tilesReady && (
        <div className="map-surface-status map-surface-overlay" role="status">
          <b>{tilesFailed ? 'Карта пока недоступна' : 'Загружаю карту'}</b>
          <span>{tilesFailed ? 'Место можно указать текстом ниже.' : 'Места и маршруты появятся здесь.'}</span>
        </div>
      )}
    </div>
  );
}
