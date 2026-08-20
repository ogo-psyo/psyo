'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { AttributionControl, Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import type { WoofLiveMapProps } from './WoofLiveMap';
import 'leaflet/dist/leaflet.css';

const defaultCenter: [number, number] = [55.751244, 37.618423];
const mapTiles = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

function Viewport({ signals }: Pick<WoofLiveMapProps, 'signals'>) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize({ animate: false });
    if (signals.length === 0) return;
    const points = signals.map((signal) => [signal.approximateLocation.lat, signal.approximateLocation.lng] as [number, number]);
    if (points.length === 1) map.setView(points[0], 14, { animate: false });
    else map.fitBounds(points, { paddingTopLeft: [42, 120], paddingBottomRight: [42, 250], maxZoom: 14, animate: false });
  }, [map, signals]);
  return null;
}

export function WoofLiveMapClient({ signals, selectedId, onSelect }: WoofLiveMapProps) {
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
    <Viewport signals={signals} />
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
