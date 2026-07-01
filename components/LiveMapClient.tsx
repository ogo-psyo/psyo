'use client';

import { Circle, Marker, MapContainer, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import type { LiveMapProps, MapFeature } from './LiveMap';
import 'leaflet/dist/leaflet.css';

const defaultCenter: [number, number] = [55.751244, 37.618423];
const yandexTiles = 'https://core-renderer-tiles.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}';

function toNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function zoneColor(type: string) {
  if (type === 'risk_zone' || type === 'risk') return '#ef4444';
  if (type === 'clinic') return '#3b82f6';
  if (type === 'route') return '#8b5cf6';
  if (type === 'shop' || type === 'grooming') return '#8f6bff';
  return '#22c55e';
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

function MapEvents({ onMapClick, onPick }: Pick<LiveMapProps, 'onMapClick' | 'onPick'>) {
  useMapEvents({
    click(event) {
      const point = {
        lat: Number(event.latlng.lat.toFixed(3)),
        lng: Number(event.latlng.lng.toFixed(3)),
      };
      if (onMapClick) {
        onMapClick({ latlng: point });
        return;
      }
      onPick?.(point);
    },
  });
  return null;
}

export function LiveMapClient({
  zones = [],
  features = [],
  picked,
  routePoints = [],
  onPick,
  onMapClick,
}: LiveMapProps) {
  const mappedZones = zones
    .map((zone) => ({
      ...zone,
      lat: toNumber(zone.approximate_lat),
      lng: toNumber(zone.approximate_lng),
      radius: Number(zone.radius_meters || zone.radiusMeters || 500),
    }))
    .filter((zone) => zone.lat !== null && zone.lng !== null);
  const draftPositions = draftRoutePositions(routePoints);

  return (
    <MapContainer center={defaultCenter} zoom={12} className="live-map" zoomControl attributionControl>
      <TileLayer url={yandexTiles} attribution="Yandex Maps" maxZoom={19} />
      <MapEvents onMapClick={onMapClick} onPick={onPick} />

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

      {features.map((feat) => {
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
              pathOptions={{ color: feat.visibility === 'public' ? '#f59e0b' : zoneColor('route'), weight: 4 }}
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
        <Polyline positions={draftPositions} pathOptions={{ color: '#22c55e', weight: 4, dashArray: '6 8' }}>
          <Popup>Новый маршрут</Popup>
        </Polyline>
      )}

      {picked && (
        <Marker position={[picked.lat, picked.lng]}>
          <Popup>Новая примерная точка зоны</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
