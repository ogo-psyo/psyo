'use client';

import dynamic from 'next/dynamic';
import type { WalkSignal } from '@/lib/socialCore';
import type { CoarseLocation } from '@/lib/socialCore';

export type WoofLiveMapProps = {
  signals: WalkSignal[];
  viewerLocation: CoarseLocation | null;
  viewerRadiusMeters: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const WoofLiveMapClient = dynamic(() => import('./WoofLiveMapClient').then((module) => module.WoofLiveMapClient), {
  ssr: false,
  loading: () => <div className="woof-map-status" role="status">Оживляю район…</div>,
});

export function WoofLiveMap(props: WoofLiveMapProps) {
  return <WoofLiveMapClient {...props} />;
}
