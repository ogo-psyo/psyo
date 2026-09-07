'use client';
import { useEffect, useRef, useState } from 'react';
import type { DiscoveryResponse, PlaceBounds, PlaceCategory } from '@/lib/placeDiscovery';

export function usePlaceDiscovery(bounds: PlaceBounds | null) {
    const [request, setRequest] = useState<{ bounds: PlaceBounds; category: PlaceCategory; revision: number } | null>(null);
    const [data, setData] = useState<DiscoveryResponse | null>(null);
    const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'quota' | 'coverage' | 'area'>('idle');
    const firstRequest = useRef(false);
    const revision = useRef(0);
    const category = request?.category || 'all';
    function load(nextCategory: PlaceCategory = category) {
        if (!bounds) return;
        setRequest({ bounds, category: nextCategory, revision: ++revision.current });
    }
    useEffect(() => {
        if (!bounds || firstRequest.current) return;
        firstRequest.current = true;
        void Promise.resolve().then(() => setRequest({ bounds, category: 'all', revision: ++revision.current }));
    }, [bounds]);
    useEffect(() => {
        if (!request) return;
        const controller = new AbortController();
        const currentRequest = request;
        void (async () => {
            setState('loading'); setData(null);
            const b = currentRequest.bounds;
            try {
                const params = new URLSearchParams({ bounds: [b.south, b.west, b.north, b.east].join(','), category: currentRequest.category });
                const response = await fetch(`/api/map/places?${params}`, { signal: controller.signal });
                const payload = await response.json();
                if (controller.signal.aborted || currentRequest.revision !== revision.current) return;
                if (!response.ok) { setState(response.status === 429 ? 'quota' : payload.error === 'AREA_NOT_COVERED' ? 'coverage' : payload.error === 'AREA_LIMIT' ? 'area' : 'error'); return; }
                if (!Array.isArray(payload.results) || payload.category !== currentRequest.category) throw Error('Invalid places');
                setData(payload); setState('ready');
            } catch { if (!controller.signal.aborted && currentRequest.revision === revision.current) setState('error'); }
        })();
        return () => controller.abort();
    }, [request]);
    const moved = Boolean(bounds && request && Object.keys(bounds).some(k => Math.abs(bounds[k as keyof PlaceBounds] - request.bounds[k as keyof PlaceBounds]) > 0.0001));
    return { data, state, category, load, moved, requestedBounds: request?.bounds };
}
