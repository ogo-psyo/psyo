'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowCounterClockwise,
  CaretDown,
  CaretUp,
  Crosshair,
  Footprints,
  MagnifyingGlass,
  MapPin,
  MapTrifold,
  NavigationArrow,
  Pause,
  PencilSimple,
  Play,
  ShieldCheck,
  ShieldWarning,
  Stop,
  Trash,
  X,
} from '@phosphor-icons/react';
import { LiveMap, type MapFeature, type MapFocusPoint, type MapLayerFilter, type MapUserLocation, type ZoneFeature } from '@/components/LiveMap';

export type ProductionMapMode = 'view' | 'route' | 'risk';
type RouteFlow = 'idle' | 'recording' | 'paused' | 'gps-error' | 'record-review' | 'planning' | 'plan-review';

export type RouteDraftMeta = {
  routeSource: 'recorded' | 'planned';
  startedAt?: string;
  durationSeconds: number;
  distanceMeters: number;
};

type SearchResult = {
  id: string;
  title: string;
  detail?: string;
  category?: string;
  kind: 'route' | 'risk' | 'place' | 'organization';
  point: { lat: number; lng: number } | null;
};

type StoredRouteSession = {
  version: 3;
  petId: string;
  flow: Exclude<RouteFlow, 'idle' | 'gps-error'>;
  elapsedSeconds: number;
  points: number[][];
  updatedAt: number;
  startedAt?: number;
};

type ProductionMapWorkspaceProps = {
  petId: string;
  dogName: string;
  avatar: ReactNode;
  zones: ZoneFeature[];
  features: MapFeature[];
  mode: ProductionMapMode;
  pickedPoint?: { lat: number; lng: number } | null;
  routePoints?: number[][];
  composer: ReactNode;
  savedContent: ReactNode;
  onOpenProfile: () => void;
  onModeChange: (mode: ProductionMapMode) => void;
  onMapClick: (event: { latlng: { lat: number; lng: number } }) => void;
  onAppendRoutePoint: (point: number[]) => void;
  onReplaceRoutePoints: (points: number[][]) => void;
  onClearDraft: () => void;
  onSaveDraft: () => void | Promise<void>;
  canSaveDraft: boolean;
  savingDraft?: boolean;
  onRouteMetaChange?: (meta: RouteDraftMeta | null) => void;
};

const routeSessionKey = (petId: string) => `pso.map.active-route.v3:${petId}`;
const persistentFlows: RouteFlow[] = ['recording', 'paused', 'record-review', 'planning', 'plan-review'];

function numberOrNull(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function routeStart(feature: MapFeature) {
  const source = Array.isArray(feature.path) ? feature.path[0] : feature.path;
  const first = source?.coordinates?.[0];
  if (!Array.isArray(first) || first.length < 2) return null;
  const lng = numberOrNull(first[0]);
  const lat = numberOrNull(first[1]);
  return lat === null || lng === null ? null : { lat, lng };
}

function distanceMeters(a: number[], b: number[]) {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLng = radians(lng2 - lng1);
  const startLat = radians(lat1);
  const endLat = radians(lat2);
  const h = Math.sin(deltaLat / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} м` : `${(meters / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} км`;
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

function formatPointCount(count: number) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const word = mod100 >= 11 && mod100 <= 14 ? 'точек' : mod10 === 1 ? 'точка' : mod10 >= 2 && mod10 <= 4 ? 'точки' : 'точек';
  return `${count} ${word}`;
}

export function ProductionMapWorkspace({
  petId,
  dogName,
  avatar,
  zones,
  features,
  mode,
  pickedPoint,
  routePoints = [],
  composer,
  savedContent,
  onOpenProfile,
  onModeChange,
  onMapClick,
  onAppendRoutePoint,
  onReplaceRoutePoints,
  onClearDraft,
  onSaveDraft,
  canSaveDraft,
  savingDraft = false,
  onRouteMetaChange,
}: ProductionMapWorkspaceProps) {
  const [filter, setFilter] = useState<MapLayerFilter>('all');
  const [savedExpanded, setSavedExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteSearchResults, setRemoteSearchResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [selectedSearchPoint, setSelectedSearchPoint] = useState<SearchResult | null>(null);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [userLocation, setUserLocation] = useState<MapUserLocation | null>(null);
  const [focusPoint, setFocusPoint] = useState<MapFocusPoint | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 55.751244, lng: 37.618423 });
  const [routeFlow, setRouteFlow] = useState<RouteFlow>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const routeWatchIdRef = useRef<number | null>(null);
  const lastRecordedPointRef = useRef<number[] | null>(null);
  const lastRecordedAtRef = useRef<number | null>(null);
  const discardReturnFlowRef = useRef<RouteFlow>('idle');
  const discardReturnFocusRef = useRef<HTMLElement | null>(null);
  const discardDialogRef = useRef<HTMLElement | null>(null);

  const routeFocused = routeFlow !== 'idle';
  const routeDistance = routePoints.slice(1).reduce((total, point, index) => total + distanceMeters(routePoints[index], point), 0);

  useEffect(() => {
    if (!onRouteMetaChange) return;
    const recorded = ['recording', 'paused', 'gps-error', 'record-review'].includes(routeFlow);
    const planned = routeFlow === 'planning' || routeFlow === 'plan-review';
    if (!recorded && !planned) {
      onRouteMetaChange(null);
      return;
    }
    onRouteMetaChange({
      routeSource: recorded ? 'recorded' : 'planned',
      startedAt: recorded && startedAt ? new Date(startedAt).toISOString() : undefined,
      durationSeconds: recorded ? elapsedSeconds : 0,
      distanceMeters: Math.round(routeDistance),
    });
  }, [elapsedSeconds, onRouteMetaChange, routeDistance, routeFlow, startedAt]);

  useEffect(() => {
    if (routeFlow !== 'recording') return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [routeFlow]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(routeSessionKey(petId));
      if (!raw) return;
      const stored = JSON.parse(raw) as StoredRouteSession;
      if (stored.version !== 3 || stored.petId !== petId || !persistentFlows.includes(stored.flow) || !Array.isArray(stored.points)) return;
      onModeChange('route');
      onReplaceRoutePoints(stored.points);
      setElapsedSeconds(Math.max(0, Number(stored.elapsedSeconds) || 0));
      setStartedAt(Number.isFinite(stored.startedAt) ? Number(stored.startedAt) : null);
      setRouteFlow(stored.flow === 'recording' ? 'paused' : stored.flow);
      lastRecordedPointRef.current = stored.points.at(-1) || null;
      setLocationStatus(stored.flow === 'recording'
        ? 'Прогулка восстановлена и поставлена на паузу.'
        : stored.flow === 'planning' ? 'Черновик маршрута восстановлен.' : 'Незавершённый маршрут восстановлен.');
    } catch {
      window.localStorage.removeItem(routeSessionKey(petId));
    } finally {
      setHydrated(true);
    }
  // Restore once. Parent callbacks intentionally follow the mounted app instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId]);

  useEffect(() => {
    if (!hydrated) return;
    if (persistentFlows.includes(routeFlow)) {
      const session: StoredRouteSession = {
        version: 3,
        petId,
        flow: routeFlow as StoredRouteSession['flow'],
        elapsedSeconds,
        points: routePoints,
        updatedAt: Date.now(),
        startedAt: startedAt ?? undefined,
      };
      window.localStorage.setItem(routeSessionKey(petId), JSON.stringify(session));
      return;
    }
    if (routeFlow === 'idle') window.localStorage.removeItem(routeSessionKey(petId));
  }, [elapsedSeconds, hydrated, petId, routeFlow, routePoints, startedAt]);

  useEffect(() => {
    if (!discardPrompt) return;
    discardReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = discardDialogRef.current;
    const controls = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled])') || []);
    controls[0]?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        continueAfterDiscard();
        return;
      }
      if (event.key !== 'Tab' || controls.length === 0) return;
      const first = controls[0];
      const last = controls.at(-1) as HTMLElement;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      discardReturnFocusRef.current?.focus();
    };
  // continueAfterDiscard uses refs and state setters only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discardPrompt]);

  useEffect(() => () => {
    if (routeWatchIdRef.current !== null) navigator.geolocation?.clearWatch(routeWatchIdRef.current);
  }, []);

  useEffect(() => {
    if (mode === 'view' && (routeFlow === 'record-review' || routeFlow === 'plan-review')) {
      setRouteFlow('idle');
      setElapsedSeconds(0);
      setStartedAt(null);
      setLocationStatus('Маршрут сохранён. Он появился на карте.');
      window.localStorage.removeItem(routeSessionKey(petId));
    }
  }, [mode, petId, routeFlow]);

  useEffect(() => {
    if (mode !== 'route' || routeFlow !== 'idle') return;
    onClearDraft();
    setElapsedSeconds(0);
    setStartedAt(null);
    setDiscardPrompt(false);
    setRouteFlow('planning');
    setLocationStatus('Передвиньте карту и добавьте точку из центра.');
  }, [mode, onClearDraft, routeFlow]);

  const counts = useMemo(() => ({
    routes: features.filter((feature) => feature.type === 'route').length,
    risks: zones.filter((zone) => zone.type === 'risk_zone' || zone.type === 'risk').length
      + features.filter((feature) => feature.type === 'point' && (feature.zone_type === 'risk_zone' || feature.zone_type === 'risk')).length,
    places: zones.filter((zone) => zone.type !== 'risk_zone' && zone.type !== 'risk').length
      + features.filter((feature) => feature.type === 'point' && feature.zone_type !== 'risk_zone' && feature.zone_type !== 'risk').length,
  }), [features, zones]);

  const localSearchResults = useMemo<SearchResult[]>(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU');
    if (!normalized) return [];
    const zoneResults = zones.map((zone): SearchResult => {
      const lat = numberOrNull(zone.approximate_lat);
      const lng = numberOrNull(zone.approximate_lng);
      const risk = zone.type === 'risk_zone' || zone.type === 'risk';
      return { id: zone.id, title: zone.title, kind: risk ? 'risk' : 'place', point: lat === null || lng === null ? null : { lat, lng } };
    });
    const featureResults = features.map((feature): SearchResult => {
      const risk = feature.type === 'point' && (feature.zone_type === 'risk_zone' || feature.zone_type === 'risk');
      const lat = numberOrNull(feature.lat);
      const lng = numberOrNull(feature.lng);
      return {
        id: feature.id,
        title: feature.title,
        kind: feature.type === 'route' ? 'route' : risk ? 'risk' : 'place',
        point: feature.type === 'route' ? routeStart(feature) : lat === null || lng === null ? null : { lat, lng },
      };
    });
    return [...zoneResults, ...featureResults].filter((item) => item.title.toLocaleLowerCase('ru-RU').includes(normalized)).slice(0, 4);
  }, [features, query, zones]);

  const searchResults = useMemo(() => [...localSearchResults, ...remoteSearchResults].slice(0, 8), [localSearchResults, remoteSearchResults]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setRemoteSearchResults([]);
      setSearchState('idle');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchState('loading');
      const params = new URLSearchParams({
        q: normalized,
        lat: mapCenter.lat.toFixed(3),
        lng: mapCenter.lng.toFixed(3),
      });
      try {
        const response = await fetch(`/api/map/search?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error('search failed');
        const payload = await response.json() as { results?: SearchResult[] };
        setRemoteSearchResults(Array.isArray(payload.results) ? payload.results : []);
        setSearchState('ready');
      } catch (error) {
        if (controller.signal.aborted) return;
        setRemoteSearchResults([]);
        setSearchState('error');
      }
    }, 850);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mapCenter.lat, mapCenter.lng, query]);

  useEffect(() => setActiveSearchIndex(searchResults.length ? 0 : -1), [searchResults]);

  function locateUser() {
    if (!navigator.geolocation) {
      setLocationStatus('Геопозиция недоступна. Можно выбрать сохранённое место.');
      return;
    }
    setLocating(true);
    setLocationStatus('Определяю ваше примерное место…');
    navigator.geolocation.getCurrentPosition((position) => {
      const next = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
      setUserLocation(next);
      setFocusPoint({ lat: next.lat, lng: next.lng, token: Date.now() });
      setLocationStatus('Вы на карте. Точное место никому не показывается.');
      setLocating(false);
    }, () => {
      setLocationStatus('Не удалось открыть геопозицию. Найдите район вручную.');
      setLocating(false);
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 });
  }

  function chooseSearchResult(result: SearchResult) {
    setFilter(result.kind === 'route' ? 'routes' : result.kind === 'risk' ? 'risks' : result.kind === 'place' ? 'places' : 'all');
    if (result.point) setFocusPoint({ ...result.point, token: Date.now() });
    setSelectedSearchPoint(result.kind === 'organization' ? result : null);
    setQuery('');
    setLocationStatus(result.point ? `Показываю «${result.title}».` : `«${result.title}» сохранено без точки на карте.`);
  }

  function stopRouteWatch() {
    if (routeWatchIdRef.current === null) return;
    navigator.geolocation.clearWatch(routeWatchIdRef.current);
    routeWatchIdRef.current = null;
  }

  function watchRoute() {
    if (!navigator.geolocation) {
      setRouteFlow('gps-error');
      setLocationStatus('На этом устройстве геопозиция недоступна.');
      return;
    }
    stopRouteWatch();
    setRouteFlow('recording');
    setLocationStatus('GPS включён · прогулка записывается');
    routeWatchIdRef.current = navigator.geolocation.watchPosition((position) => {
      const next = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
      const point = [next.lng, next.lat];
      const previous = lastRecordedPointRef.current;
      const now = position.timestamp || Date.now();
      setUserLocation(next);
      setFocusPoint({ lat: next.lat, lng: next.lng, token: Date.now() });
      if (!Number.isFinite(next.accuracy) || next.accuracy > 80) {
        setLocationStatus('Сигнал пока неточный · жду более надёжную точку');
        return;
      }
      const travelled = previous ? distanceMeters(previous, point) : 0;
      const secondsSinceLast = lastRecordedAtRef.current ? Math.max(1, (now - lastRecordedAtRef.current) / 1000) : null;
      const plausibleDistance = secondsSinceLast === null || travelled <= Math.max(50, secondsSinceLast * 12);
      const movementThreshold = Math.max(5, Math.min(next.accuracy / 2, 15));
      if (plausibleDistance && (!previous || travelled >= movementThreshold)) {
        lastRecordedPointRef.current = point;
        lastRecordedAtRef.current = now;
        onAppendRoutePoint(point);
        setLocationStatus('Прогулка записывается');
      }
    }, (error) => {
      stopRouteWatch();
      if (error.code === error.PERMISSION_DENIED) {
        setRouteFlow('gps-error');
        setLocationStatus('Доступ к геопозиции выключен. Разрешите его или постройте маршрут заранее.');
      } else {
        setRouteFlow('paused');
        setLocationStatus('GPS-сигнал потерян. Запись поставлена на паузу.');
      }
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 });
  }

  function startWalk() {
    onModeChange('route');
    onClearDraft();
    setElapsedSeconds(0);
    setStartedAt(Date.now());
    setDiscardPrompt(false);
    lastRecordedPointRef.current = null;
    lastRecordedAtRef.current = null;
    watchRoute();
  }

  function pauseWalk() {
    stopRouteWatch();
    setRouteFlow('paused');
    setLocationStatus('Прогулка на паузе. Маршрут сохранён в черновике.');
  }

  function finishWalk() {
    stopRouteWatch();
    setRouteFlow('record-review');
    setLocationStatus('Прогулка завершена. Проверьте и сохраните результат.');
  }

  function startPlanning() {
    stopRouteWatch();
    onModeChange('route');
    onClearDraft();
    setElapsedSeconds(0);
    setStartedAt(null);
    setDiscardPrompt(false);
    setRouteFlow('planning');
    setLocationStatus('Передвиньте карту и добавьте точку из центра.');
  }

  function addCenterPoint() {
    onAppendRoutePoint([Number(mapCenter.lng.toFixed(5)), Number(mapCenter.lat.toFixed(5))]);
    setLocationStatus('Точка добавлена. Передвиньте карту к следующему месту.');
  }

  function undoLastPoint() {
    onReplaceRoutePoints(routePoints.slice(0, -1));
    setLocationStatus(routePoints.length <= 1 ? 'Все точки убраны.' : 'Последняя точка убрана.');
  }

  function reviewPlannedRoute() {
    setRouteFlow('plan-review');
    setLocationStatus('Маршрут готов. Добавьте название и сохраните его.');
  }

  function requestDiscard() {
    discardReturnFlowRef.current = routeFlow;
    stopRouteWatch();
    if (routeFlow === 'recording') setRouteFlow('paused');
    setDiscardPrompt(true);
  }

  function continueAfterDiscard() {
    const returnFlow = discardReturnFlowRef.current;
    setDiscardPrompt(false);
    if (returnFlow === 'recording') watchRoute();
    else setRouteFlow(returnFlow);
  }

  function discardRoute() {
    stopRouteWatch();
    onClearDraft();
    onModeChange('view');
    setRouteFlow('idle');
    setElapsedSeconds(0);
    setStartedAt(null);
    setDiscardPrompt(false);
    lastRecordedPointRef.current = null;
    lastRecordedAtRef.current = null;
    setLocationStatus('Черновик маршрута удалён.');
    window.localStorage.removeItem(routeSessionKey(petId));
  }

  function startRisk() {
    if (routeFocused) return;
    onModeChange('risk');
    setLocationStatus('Коснитесь опасного места на карте.');
  }

  const routeTitle = routeFlow === 'recording' ? 'Идёт прогулка'
    : routeFlow === 'paused' ? 'Прогулка на паузе'
      : routeFlow === 'gps-error' ? 'Не удалось включить GPS'
        : routeFlow === 'record-review' ? 'Прогулка завершена'
          : routeFlow === 'planning' ? 'Построить заранее'
            : 'Маршрут готов';

  return <section className={`production-map-workspace${routeFocused ? ' route-focus' : ''}`} data-production-map-workspace data-production-journey="map" data-route-flow={routeFlow}>
    <section className="production-map-canvas" aria-label={`Карта прогулок ${dogName}`}>
      <LiveMap
        zones={zones}
        features={features}
        picked={pickedPoint}
        routePoints={routePoints}
        onMapClick={mode === 'risk' ? onMapClick : undefined}
        onCenterChange={setMapCenter}
        filter={filter}
        userLocation={routeFlow === 'record-review' || routeFlow === 'plan-review' ? null : userLocation}
        focusPoint={focusPoint}
        searchPoint={selectedSearchPoint?.point ? { ...selectedSearchPoint.point, title: selectedSearchPoint.title, detail: selectedSearchPoint.detail } : null}
        fitDraftRoute={routeFlow === 'record-review' || routeFlow === 'plan-review'}
        accessibleLabel={routeFlow === 'planning' ? 'Карта для построения маршрута. Перемещайте карту стрелками или коснитесь нужного места.' : routeFlow === 'recording' || routeFlow === 'paused' ? 'Карта записываемой прогулки' : routeFlow === 'record-review' || routeFlow === 'plan-review' ? 'Обзор всего маршрута перед сохранением' : `Карта прогулок ${dogName}`}
      />
      {routeFlow === 'planning' && <span className="production-map-center-pin" aria-hidden="true"><MapPin weight="fill" /></span>}

      {!routeFocused && <>
        <header className="production-map-topbar">
          <button className="production-map-profile" type="button" onClick={onOpenProfile} aria-label={`Открыть профиль ${dogName}`}>
            <span className="production-map-avatar">{avatar}</span>
            <span><b>Карта {dogName}</b><small>маршруты, места и предупреждения</small></span>
          </button>
          <button className="production-map-locate" type="button" onClick={locateUser} disabled={locating} aria-label="Найти меня">
            <Crosshair weight={userLocation ? 'fill' : 'regular'} aria-hidden="true" />
            <span>{locating ? 'Ищу' : 'Найти меня'}</span>
          </button>
        </header>

        {mode === 'view' && <div className="production-map-search">
          <MagnifyingGlass weight="regular" aria-hidden="true" />
          <label htmlFor="production-map-search-input">Найти организацию, место или маршрут</label>
          <input id="production-map-search-input" role="combobox" aria-autocomplete="list" aria-expanded={Boolean(query)} aria-controls="production-map-search-results" aria-activedescendant={activeSearchIndex >= 0 ? `production-map-result-${activeSearchIndex}` : undefined} aria-describedby="production-map-search-status" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && searchResults.length) { event.preventDefault(); setActiveSearchIndex((index) => (index + 1) % searchResults.length); }
            if (event.key === 'ArrowUp' && searchResults.length) { event.preventDefault(); setActiveSearchIndex((index) => (index <= 0 ? searchResults.length - 1 : index - 1)); }
            if (event.key === 'Enter' && activeSearchIndex >= 0 && searchResults[activeSearchIndex]) { event.preventDefault(); chooseSearchResult(searchResults[activeSearchIndex]); }
            if (event.key === 'Escape') { setQuery(''); setActiveSearchIndex(-1); }
          }} placeholder="Клиника, парк или маршрут" autoComplete="off" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Очистить поиск"><X weight="bold" aria-hidden="true" /></button>}
          <span id="production-map-search-status" className="sr-only" role="status" aria-live="polite">{query ? searchState === 'loading' ? 'Ищу организации и места' : searchResults.length ? `Найдено: ${searchResults.length}` : 'Ничего не найдено' : ''}</span>
          {query && <div id="production-map-search-results" className="production-map-search-results" role="listbox" aria-label="Результаты поиска">
            {searchResults.length ? searchResults.map((result, index) => <button id={`production-map-result-${index}`} key={`${result.kind}-${result.id}`} type="button" role="option" aria-selected={index === activeSearchIndex} onMouseEnter={() => setActiveSearchIndex(index)} onClick={() => chooseSearchResult(result)}><span>{result.kind === 'route' ? <MapTrifold aria-hidden="true" /> : result.kind === 'risk' ? <ShieldWarning aria-hidden="true" /> : result.kind === 'organization' ? <MagnifyingGlass aria-hidden="true" /> : <MapPin aria-hidden="true" />}</span><span className="production-map-result-copy"><b>{result.title}</b>{result.detail && <em>{result.detail}</em>}</span><small>{result.kind === 'route' ? 'маршрут' : result.kind === 'risk' ? 'опасность' : result.category || 'место'}</small></button>) : searchState === 'loading' ? <p>Ищу организации и места…</p> : searchState === 'error' ? <p>Поиск мест временно недоступен. Сохранённые точки всё ещё можно найти.</p> : <p>Ничего не найдено. Попробуйте название или тип места.</p>}
          </div>}
        </div>}
      </>}

      <div className="production-map-status" role="status" aria-live="polite">{locationStatus}</div>
    </section>

    {routeFocused ? <section className="production-route-controller" data-route-controller aria-label={routeTitle}>
      {discardPrompt ? <section ref={discardDialogRef} className="production-route-discard" role="alertdialog" aria-modal="true" aria-labelledby="route-discard-title" aria-describedby="route-discard-description">
        <Trash weight="regular" aria-hidden="true" />
        <div><b id="route-discard-title">Удалить незавершённый маршрут?</b><p id="route-discard-description">Записанные точки и время восстановить не получится.</p></div>
        <button type="button" className="secondary" onClick={continueAfterDiscard}>Продолжить маршрут</button>
        <button type="button" className="danger" onClick={discardRoute}>Удалить черновик</button>
      </section> : <>
        <header className="production-route-controller-heading">
          <div><b>{routeTitle}</b><p>{routeFlow === 'planning' || routeFlow === 'plan-review' ? `${formatPointCount(routePoints.length)} · ${formatDistance(routeDistance)}` : `${formatDuration(elapsedSeconds)} · ${formatDistance(routeDistance)}`}</p></div>
          {(routeFlow === 'recording' || routeFlow === 'paused' || routeFlow === 'record-review' || routeFlow === 'planning' || routeFlow === 'plan-review') && <button type="button" className="route-discard-trigger" onClick={requestDiscard}>Отменить</button>}
        </header>

        {(routeFlow === 'recording' || routeFlow === 'paused') && <>
          <dl className="production-route-metrics">
            <div><dt>Время</dt><dd>{formatDuration(elapsedSeconds)}</dd></div>
            <div><dt>Расстояние</dt><dd>{formatDistance(routeDistance)}</dd></div>
            <div><dt>Сигнал</dt><dd>{routeFlow === 'recording' ? 'Запись' : 'Пауза'}</dd></div>
          </dl>
          {routeFlow === 'recording' ? <button type="button" className="production-route-pause" onClick={pauseWalk}><Pause weight="fill" aria-hidden="true" /><span>Пауза</span></button> : <div className="production-route-paused-actions">
            <button type="button" className="primary" onClick={watchRoute}><Play weight="fill" aria-hidden="true" />Продолжить</button>
            <button type="button" className="secondary" disabled={!canSaveDraft} onClick={finishWalk}><Stop weight="fill" aria-hidden="true" />{canSaveDraft ? 'Завершить' : 'Пройдите несколько метров'}</button>
          </div>}
          <p className="production-route-open-note"><ShieldCheck weight="regular" aria-hidden="true" />Пока идёт запись, оставьте Псё открытым. Черновик сохранится, если вы смените вкладку.</p>
        </>}

        {routeFlow === 'gps-error' && <section className="production-route-error" role="alert">
          <NavigationArrow weight="regular" aria-hidden="true" />
          <div><b>Псё не видит ваше местоположение</b><p>Разрешите геопозицию в Telegram и попробуйте снова или постройте путь вручную.</p></div>
          <button type="button" className="primary" onClick={watchRoute}>Попробовать снова</button>
          <button type="button" className="secondary" onClick={startPlanning}>Построить заранее</button>
          <button type="button" className="text-action" onClick={discardRoute}>Вернуться на карту</button>
        </section>}

        {routeFlow === 'planning' && <>
          <div className="production-route-plan-help"><PencilSimple weight="regular" aria-hidden="true" /><div><b>{routePoints.length ? 'Добавьте следующий поворот' : 'Отметьте начало маршрута'}</b><p>Передвиньте карту так, чтобы метка оказалась в нужном месте, затем добавьте точку.</p></div></div>
          <div className="production-route-plan-actions">
            <button type="button" className="primary" onClick={addCenterPoint}><MapPin weight="fill" aria-hidden="true" />Добавить точку</button>
            <button type="button" className="secondary" disabled={!routePoints.length} onClick={undoLastPoint}><ArrowCounterClockwise weight="regular" aria-hidden="true" />Убрать последнюю</button>
            <button type="button" className="secondary" disabled={!canSaveDraft} onClick={reviewPlannedRoute}>Готово</button>
          </div>
        </>}

        {(routeFlow === 'record-review' || routeFlow === 'plan-review') && <div className="production-route-review">
          <div className="production-route-review-summary"><Footprints weight="regular" aria-hidden="true" /><div><b>{routeFlow === 'record-review' ? 'Прогулка записана' : 'Маршрут построен'}</b><p>{formatDuration(elapsedSeconds)} · {formatDistance(routeDistance)} · {formatPointCount(routePoints.length)}</p></div></div>
          {composer}
        </div>}
      </>}
    </section> : mode === 'risk' ? <section className="production-map-snap-sheet expanded risk-sheet" data-map-snap-sheet>
      <header className="production-map-simple-heading"><div><b>Предупредить об опасности</b><p>{pickedPoint ? 'Место выбрано · добавьте пояснение' : 'Коснитесь места на карте'}</p></div><button type="button" onClick={() => onModeChange('view')}>Отменить</button></header>
      <div className="production-map-sheet-body">{composer}</div>
    </section> : <section className={`production-map-snap-sheet home-sheet${savedExpanded ? ' expanded' : ''}`} data-map-snap-sheet>
      <section className="production-route-launch" aria-label="Прогулки и маршруты">
        <button type="button" className="production-route-start" data-route-action="start" onClick={startWalk}><NavigationArrow weight="fill" aria-hidden="true" /><span>Начать прогулку</span></button>
        <button type="button" className="production-route-plan" data-route-action="plan" onClick={startPlanning}><PencilSimple weight="regular" aria-hidden="true" /><span>Маршрут</span></button>
        <button type="button" className="production-route-risk" data-route-action="risk" onClick={startRisk}><ShieldWarning weight="regular" aria-hidden="true" /><span>Опасность</span></button>
      </section>
      <button className="production-map-sheet-toggle" type="button" aria-expanded={savedExpanded} aria-controls="production-map-saved-body" onClick={() => setSavedExpanded((expanded) => !expanded)}>
        <span className="production-map-grabber" aria-hidden="true" />
        <span><b>Сохранённое на карте</b><small>{counts.routes} маршрутов · {counts.places} мест · {counts.risks} предупреждений</small></span>
        {savedExpanded ? <CaretDown weight="bold" aria-hidden="true" /> : <CaretUp weight="bold" aria-hidden="true" />}
      </button>
      <div id="production-map-saved-body" className="production-map-sheet-body" hidden={!savedExpanded}>
        <div className="production-map-filters" role="group" aria-label="Что показывать на карте">
          <button type="button" data-map-filter="all" aria-pressed={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Все <span>{counts.routes + counts.places + counts.risks}</span></button>
          <button type="button" data-map-filter="routes" aria-pressed={filter === 'routes'} className={filter === 'routes' ? 'active' : ''} onClick={() => setFilter('routes')}>Маршруты <span>{counts.routes}</span></button>
          <button type="button" data-map-filter="places" aria-pressed={filter === 'places'} className={filter === 'places' ? 'active' : ''} onClick={() => setFilter('places')}>Места <span>{counts.places}</span></button>
          <button type="button" data-map-filter="risks" aria-pressed={filter === 'risks'} className={filter === 'risks' ? 'active risk' : 'risk'} onClick={() => setFilter('risks')}>Опасности <span>{counts.risks}</span></button>
        </div>
        <div data-map-saved-content>{savedContent}</div>
      </div>
    </section>}
  </section>;
}
