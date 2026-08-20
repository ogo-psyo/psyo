'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { AttributionControl, Circle, CircleMarker, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import type { WoofLiveMapProps } from './WoofLiveMap';
import 'leaflet/dist/leaflet.css';

const defaultCenter: [number, number] = [55.751244, 37.618423];
const mapTiles = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

function Viewport({ signals, viewerLocation }: Pick<WoofLiveMapProps, 'signals' | 'viewerLocation'>) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize({ animate: false });
    if (signals.length === 0) {
      if (viewerLocation) map.setView([viewerLocation.lat, viewerLocation.lng], 15, { animate: false });
      return;
    }
    const points = [
      ...(viewerLocation ? [[viewerLocation.lat, viewerLocation.lng] as [number, number]] : []),
      ...signals.map((signal) => [signal.approximateLocation.lat, signal.approximateLocation.lng] as [number, number]),
    ];
    if (points.length === 1) map.setView(points[0], 14, { animate: false });
    else map.fitBounds(points, { paddingTopLeft: [42, 120], paddingBottomRight: [42, 250], maxZoom: 14, animate: false });
  }, [map, signals, viewerLocation]);
  return null;
}

export function WoofLiveMapClient({ signals, viewerLocation, viewerRadiusMeters, selectedId, onSelect }: WoofLiveMapProps) {
  const icons = useMemo(() => new Map(signals.map((signal) => {
    const content = signal.avatarUrl
      ? `<img src="${escapeHtml(signal.avatarUrl)}" alt="" />`
      : `<span aria-hidden="true">${escapeHtml(signal.name.slice(0, 1).toUpperCase())}</span>`;
    return [signal.id, L.divIcon({
      className: `woof-avatar-marker${signal.id === selectedId ? ' is-selected' : ''}${signal.isMine ? ' is-mine' : ''}`,
      html: `<div>${content}<i></i></div>`,
      iconSize: [62, 72],
      iconAnchor: [31, 64],
    })];
  })), [selectedId, signals]);

  return <MapContainer center={defaultCenter} zoom={12} className="woof-live-map" zoomControl attributionControl={false} aria-label="Карта активных Гав-сигналов поблизости">
    <AttributionControl prefix={false} />
    <TileLayer url={mapTiles} attribution="&copy; OpenStreetMap contributors &copy; CARTO" subdomains="abcd" maxZoom={20} />
    <Viewport signals={signals} viewerLocation={viewerLocation} />
    {viewerLocation && <>
      <Circle center={[viewerLocation.lat, viewerLocation.lng]} radius={viewerRadiusMeters} pathOptions={{ color: '#07814d', fillColor: '#98df73', fillOpacity: 0.055, weight: 1, dashArray: '6 8' }} interactive={false} />
      <CircleMarker center={[viewerLocation.lat, viewerLocation.lng]} radius={7} pathOptions={{ color: '#f7fff9', fillColor: '#07814d', fillOpacity: 1, weight: 3 }} interactive={false} />
    </>}
    {signals.map((signal) => <Circle
      key={`${signal.id}:privacy`}
      center={[signal.approximateLocation.lat, signal.approximateLocation.lng]}
      radius={signal.privacyRadiusMeters}
      pathOptions={{ color: signal.isMine ? '#07814d' : '#dd617c', fillColor: signal.isMine ? '#3df881' : '#dd617c', fillOpacity: signal.id === selectedId ? 0.18 : 0.08, weight: signal.id === selectedId ? 2 : 1 }}
      interactive={false}
    />)}
    {signals.map((signal) => <Marker
      key={signal.id}
      position={[signal.approximateLocation.lat, signal.approximateLocation.lng]}
      icon={icons.get(signal.id)!}
      eventHandlers={{ click: () => onSelect(signal.id) }}
      title={`${signal.name}: Гав-сигнал, примерная зона`}
      keyboard
    />)}
  </MapContainer>;
}
