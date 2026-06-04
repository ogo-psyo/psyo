'use client';

import { useEffect, useMemo, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Zone = {
  id: string;
  title: string;
  type: string;
  note?: string;
  approximate_lat?: number | string | null;
  approximate_lng?: number | string | null;
  radius_meters?: number | null;
  radiusMeters?: number | null;
};

type Props = {
  zones: Zone[];
  picked?: { lat: number; lng: number } | null;
  onPick: (point: { lat: number; lng: number }) => void;
};

const defaultCenter: [number, number] = [55.751244, 37.618423];

function toNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function zoneColor(type: string) {
  if (type === 'risk_zone') return '#ff755f';
  if (type === 'clinic') return '#61e7ff';
  if (type === 'shop' || type === 'grooming') return '#8f6bff';
  return '#d8ff3e';
}

export function LiveMap({ zones, picked, onPick }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);

  const mappedZones = useMemo(() => zones.map((zone) => ({
    ...zone,
    lat: toNumber(zone.approximate_lat),
    lng: toNumber(zone.approximate_lng),
    radius: Number(zone.radius_meters || zone.radiusMeters || 500),
  })).filter((zone) => zone.lat !== null && zone.lng !== null), [zones]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!hostRef.current || mapRef.current) return;
      const L = await import('leaflet');
      if (cancelled || !hostRef.current) return;
      leafletRef.current = L;
      const map = L.map(hostRef.current, { zoomControl: false, attributionControl: false }).setView(defaultCenter, 12);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.control.attribution({ prefix: false, position: 'bottomleft' }).addAttribution('© OpenStreetMap').addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        crossOrigin: true,
      }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      map.on('click', (event: Leaflet.LeafletMouseEvent) => {
        // Privacy-first: round to ~100m precision before handing it back to app state.
        onPick({ lat: Number(event.latlng.lat.toFixed(3)), lng: Number(event.latlng.lng.toFixed(3)) });
      });
      mapRef.current = map;
      layerRef.current = layer;
      setTimeout(() => map.invalidateSize(), 120);
    }
    boot();
    return () => { cancelled = true; };
  }, [onPick]);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();

    const bounds: Leaflet.LatLngTuple[] = [];
    for (const zone of mappedZones) {
      const center: [number, number] = [zone.lat as number, zone.lng as number];
      bounds.push(center);
      const color = zoneColor(zone.type);
      L.circle(center, {
        radius: zone.radius,
        color,
        fillColor: color,
        fillOpacity: 0.16,
        weight: 2,
      }).bindPopup(`<b>${zone.title}</b><br/>${zone.type}${zone.note ? `<br/>${zone.note}` : ''}`).addTo(layer);
    }

    if (picked) {
      const marker = L.circleMarker([picked.lat, picked.lng], {
        radius: 8,
        color: '#d8ff3e',
        fillColor: '#d8ff3e',
        fillOpacity: 0.9,
      }).bindPopup('Новая примерная точка зоны');
      marker.addTo(layer);
      bounds.push([picked.lat, picked.lng]);
    }

    if (bounds.length > 0) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 });
  }, [mappedZones, picked]);

  return <div ref={hostRef} className="live-map" aria-label="Реальная карта OpenStreetMap" />;
}
