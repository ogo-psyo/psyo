'use client';

import dynamic from 'next/dynamic';

export type ZoneFeature = {
  id: string;
  title: string;
  type: string;
  note?: string;
  approximate_lat?: number | string | null;
  approximate_lng?: number | string | null;
  radius_meters?: number | null;
  radiusMeters?: number | null;
};

export type MapFeature = {
  id: string;
  type: 'point' | 'route';
  title: string;
  lat?: number | string | null;
  lng?: number | string | null;
  zone_type?: string | null;
  path?: { type?: string; coordinates?: number[][] } | { coordinates?: number[][] }[] | null;
  visibility: 'private' | 'shared' | 'public';
};

export type LiveMapProps = {
  zones?: ZoneFeature[];
  features?: MapFeature[];
  picked?: { lat: number; lng: number } | null;
  drawMode?: 'none' | 'point' | 'route';
  routePoints?: number[][];
  onPick?: (point: { lat: number; lng: number }) => void;
  onMapClick?: (event: { latlng: { lat: number; lng: number } }) => void;
  onRouteDraw?: (points: { lat: number; lng: number }[]) => void;
};

const LiveMapClient = dynamic(
  () => import('./LiveMapClient').then((module) => module.LiveMapClient),
  {
    ssr: false,
    loading: () => <div className="live-map" aria-label="Карта загружается" />,
  },
);

export function LiveMap(props: LiveMapProps) {
  return <LiveMapClient {...props} />;
}
