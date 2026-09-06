'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { LiveMap, type MapFeature, type MapBounds, type MapFocusPoint, type MapLayerFilter, type MapUserLocation, type ZoneFeature } from '@/components/LiveMap';

export type ProductionMapMode = 'view' | 'route' | 'risk';
import { measuredRouteDistance, validRouteGaps } from '@/lib/routeGeometry';
import {findDurationWalk} from '@/lib/durationWalk';
import type {OwnerRouteView} from '@/lib/mapUi';
import { useMapLibrary } from '@/components/map/useMapLibrary';
import { MapLibraryPanel } from '@/components/map/MapLibraryPanel';
import type { SavedPlace } from '@/lib/mapLibrary';
import { routeSessionKey, persistentFlows, readRouteSession, hasRouteWork, moveRoutePoint, closeRouteLoop, type RouteFlow, type StoredRouteSession } from '@/lib/mapSession';

export type RouteDraftMeta = {
  routeSource: 'recorded' | 'planned';
  pathGaps: number[];
  startedAt?: string;
  durationSeconds: number;
  distanceMeters: number;
};

type SearchResult = {
  id: string;
  title: string;
  detail?: string;
  category?: string;
  accuracyMeters?:number;
  privateNote?:string;
  kind: 'route' | 'risk' | 'place' | 'organization';
  point: { lat: number; lng: number } | null;
};

type ProductionMapWorkspaceProps = {
  petId: string;
  guest: boolean;
  authHeaders: () => Record<string,string>;
  draftTitle?: string;
  draftNote?: string;
  editingRouteId?:string|null;
  onRestoreDraftText?: (title: string, note: string, editingRouteId?:string) => void;
  savedRevision?: number;
  routeEditSeed?: {token:number;points:number[][]}|null;
  onReuseRoute?: (id:string)=>void;
  onActivityChange?: (status: 'recording'|'paused'|null) => void;
  dogName: string;
  avatar: ReactNode;
  zones: ZoneFeature[];
  features: MapFeature[];
  recordedRoutes?:OwnerRouteView[];
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

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
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
  petId, guest, authHeaders,
  draftTitle = '', draftNote = '', editingRouteId, onRestoreDraftText, savedRevision = 0, onActivityChange, routeEditSeed, onReuseRoute,
  dogName,
  avatar,
  zones,
  features, recordedRoutes=[],
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
  const libraryStore = useMapLibrary(petId,guest,authHeaders);
  const [targetCollection,setTargetCollection] = useState('saved');
  const [savedPlaceNotice,setSavedPlaceNotice] = useState('');
  const [placeUndo,setPlaceUndo] = useState<{collectionId:string;placeId:string}|null>(null);
  const [durationOpen,setDurationOpen]=useState(false);
  const [wantedMinutes,setWantedMinutes]=useState(30);
  const [durationResult,setDurationResult]=useState<ReturnType<typeof findDurationWalk>|undefined>(undefined);
  const [filter, setFilter] = useState<MapLayerFilter>('all');
  const [layers,setLayers]=useState({routes:true,places:true,risks:true});
  const [layersReady,setLayersReady]=useState(false);
  useEffect(()=>{try{const value=JSON.parse(localStorage.getItem(`pso.map.layers.v1:${petId}`)||'null');if(value&&['routes','places','risks'].every(k=>typeof value[k]==='boolean'))setLayers(value);}catch{/* Keep all current layers. */}setLayersReady(true);},[petId]);
  useEffect(()=>{if(layersReady)try{localStorage.setItem(`pso.map.layers.v1:${petId}`,JSON.stringify(layers));}catch{/* Keep current view. */}},[petId,layers,layersReady]);
  function selectLayerPreset(preset:MapLayerFilter){setFilter(preset);setLayers({routes:preset==='all'||preset==='routes',places:preset==='all'||preset==='places',risks:preset==='all'||preset==='risks'});}
  const isRisk=(type?:string|null)=>type==='risk'||type==='risk_zone';
  const [savedExpanded, setSavedExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [searchRequest, setSearchRequest] = useState<{query:string;lat:number;lng:number;revision:number;bounds?:MapBounds} | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const returnCameraRef = useRef<{lat:number;lng:number}|null>(null);
  const savedRevisionRef = useRef(savedRevision);
  const [remoteSearchResults, setRemoteSearchResults] = useState<SearchResult[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'quota'>('idle');
  const [selectedSearchPoint, setSelectedSearchPoint] = useState<SearchResult | null>(null);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [userLocation, setUserLocation] = useState<MapUserLocation | null>(null);
  const [focusPoint, setFocusPoint] = useState<MapFocusPoint | null>(null);
  const [mapBounds,setMapBounds]=useState<MapBounds|null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 55.751244, lng: 37.618423 });
  const [routeFlow, setRouteFlow] = useState<RouteFlow>('idle');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [folded, setFolded] = useState(false);
  const [undoPoints, setUndoPoints] = useState<number[][] | null>(null);
  const [pathGaps, setPathGaps] = useState<number[]>([]);
  const pointCountRef = useRef(routePoints.length);
  useLayoutEffect(()=>{pointCountRef.current = routePoints.length;},[routePoints.length]);
  const nextPointBreakRef = useRef(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const routeWatchIdRef = useRef<number | null>(null);
  const lastRecordedPointRef = useRef<number[] | null>(null);
  const lastRecordedAtRef = useRef<number | null>(null);
  const discardReturnFlowRef = useRef<RouteFlow>('idle');
  const discardReturnFocusRef = useRef<HTMLElement | null>(null);
  const discardDialogRef = useRef<HTMLElement | null>(null);

  const routeFocused = routeFlow !== 'idle' && !folded;
  const routeDistance = measuredRouteDistance(routePoints, pathGaps);
  useEffect(() => { onActivityChange?.(routeFlow==='recording'?'recording':['paused','gps-error'].includes(routeFlow)?'paused':null); }, [onActivityChange,routeFlow]);

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
      pathGaps,
      startedAt: recorded && startedAt ? new Date(startedAt).toISOString() : undefined,
      durationSeconds: recorded ? elapsedSeconds : 0,
      distanceMeters: Math.round(routeDistance),
    });
  }, [elapsedSeconds, onRouteMetaChange, routeDistance, routeFlow, startedAt, pathGaps]);

  useEffect(() => {
    if (routeFlow !== 'recording') return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [routeFlow]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(routeSessionKey(petId));
      if (!raw) return;
      const stored = readRouteSession(raw, petId);
      if (!stored) { window.localStorage.setItem(`${routeSessionKey(petId)}:recovery`, raw); window.localStorage.removeItem(routeSessionKey(petId)); return; }
      setFolded(true);
      onRestoreDraftText?.(stored.title || '', stored.note || '', stored.editingRouteId);
      onReplaceRoutePoints(stored.points);
      setElapsedSeconds(Math.max(0, Number(stored.elapsedSeconds) || 0));
      setStartedAt(Number.isFinite(stored.startedAt) ? Number(stored.startedAt) : null);
      setRouteFlow(stored.flow === 'recording' ? 'paused' : stored.flow);
      setPathGaps(validRouteGaps(stored.gaps, stored.points.length));
      nextPointBreakRef.current = stored.points.length > 0;
      lastRecordedPointRef.current = null;
      setLocationStatus(stored.flow === 'recording'
        ? 'Прогулка восстановлена и поставлена на паузу.'
        : stored.flow === 'planning' ? 'Черновик маршрута восстановлен.' : 'Незавершённый маршрут восстановлен.');
    } catch {
      setLocationStatus('Не удалось восстановить черновик. Исходная запись не удалена.');
    } finally {
      setHydrated(true);
    }
  // Restore once. Parent callbacks intentionally follow the mounted app instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [petId]);

  useEffect(() => {
    if (!hydrated) return;
    if (persistentFlows.includes(routeFlow) || routeFlow === 'gps-error') {
      const session: StoredRouteSession = {
        version: 3,
        title: draftTitle,
        note: draftNote,
        editingRouteId:editingRouteId||undefined,
        gaps: pathGaps,
        petId,
        flow: routeFlow === 'gps-error' ? 'paused' : routeFlow as StoredRouteSession['flow'],
        elapsedSeconds,
        points: routePoints,
        updatedAt: Date.now(),
        startedAt: startedAt ?? undefined,
      };
      try {
        if (hasRouteWork(session)) window.localStorage.setItem(routeSessionKey(petId), JSON.stringify(session));
        else window.localStorage.removeItem(routeSessionKey(petId));
      } catch { setLocationStatus('Не получилось сохранить черновик на устройстве. Не закрывайте страницу до сохранения маршрута.'); }
      return;
    }
    if (routeFlow === 'idle') window.localStorage.removeItem(routeSessionKey(petId));
  }, [elapsedSeconds, hydrated, petId, routeFlow, routePoints, startedAt, draftTitle, draftNote, pathGaps, editingRouteId]);

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
    if (savedRevisionRef.current === savedRevision) return;
    savedRevisionRef.current = savedRevision;
    setRouteFlow('idle'); setFolded(false); setElapsedSeconds(0); setStartedAt(null);
    setLocationStatus('Маршрут сохранён. Он появился на карте.');
    try { window.localStorage.removeItem(routeSessionKey(petId)); } catch { /* Saved remotely. */ }
  }, [savedRevision, petId]);
  useEffect(() => {
    if (mode === 'view' && routeFlow !== 'idle') setFolded(true);
  }, [mode, routeFlow]);

  useEffect(() => {
    if (mode !== 'route' || routeFlow !== 'idle' || !hydrated || routeEditSeed) return;
    onClearDraft();
    setElapsedSeconds(0);
    setStartedAt(null);
    setDiscardPrompt(false);
    setPathGaps([]);
    setRouteFlow('planning');
    setLocationStatus('Передвиньте карту и добавьте точку из центра.');
  }, [mode, onClearDraft, routeFlow, hydrated,routeEditSeed]);
  useEffect(()=>{
    if(!routeEditSeed)return;
    onReplaceRoutePoints(routeEditSeed.points);setFolded(false);setElapsedSeconds(0);setPathGaps([]);setStartedAt(null);setRouteFlow('planning');
  // A new seed is an explicit request to reuse/edit a saved route; callbacks change on every parent render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[routeEditSeed?.token]);

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
      return { id: zone.id, title: zone.title, accuracyMeters:Math.max(500,zone.radius_meters||zone.radiusMeters||500), privateNote:zone.note, kind: risk ? 'risk' : 'place', point: lat === null || lng === null ? null : { lat, lng } };
    });
    const featureResults = features.map((feature): SearchResult => {
      const risk = feature.type === 'point' && (feature.zone_type === 'risk_zone' || feature.zone_type === 'risk');
      const lat = numberOrNull(feature.lat);
      const lng = numberOrNull(feature.lng);
      return {
        id: feature.id,
        title: feature.title,
        accuracyMeters:feature.type==='point'?Math.max(500,feature.radiusMeters||500):undefined,
        kind: feature.type === 'route' ? 'route' : risk ? 'risk' : 'place',
        point: feature.type === 'route' ? routeStart(feature) : lat === null || lng === null ? null : { lat, lng },
      };
    });
    return [...zoneResults, ...featureResults].filter((item) => item.title.toLocaleLowerCase('ru-RU').includes(normalized));
  }, [features, query, zones]);

  const searchResults = useMemo(() => [...localSearchResults, ...remoteSearchResults], [localSearchResults, remoteSearchResults]);

  function searchArea() {
    if (query.trim().length < 2) return;
    setSelectedSearchPoint(null); setSearchOpen(true);
    setSearchRequest({query:query.trim(),...mapCenter,revision:Date.now(),bounds:mapBounds||undefined});
  }
  useEffect(() => {
    if (!searchRequest) return;
    const controller = new AbortController();
    setSearchState('loading'); setRemoteSearchResults([]);
    const params = new URLSearchParams({q:searchRequest.query,lat:searchRequest.lat.toFixed(3),lng:searchRequest.lng.toFixed(3)});
    if(searchRequest.bounds)params.set('bounds',[searchRequest.bounds.south,searchRequest.bounds.west,searchRequest.bounds.north,searchRequest.bounds.east].join(','));
    (async () => {
      try {
        const response = await fetch(`/api/map/search?${params}`, {signal:controller.signal});
        const payload = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) { setSearchState(response.status===429?'quota':'error'); return; }
        setRemoteSearchResults(Array.isArray(payload.results)?payload.results:[]); setSearchState('ready');
      } catch { if (!controller.signal.aborted) setSearchState('error'); }
    })();
    return () => controller.abort();
  }, [searchRequest]);

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

  const [placeOrigin,setPlaceOrigin] = useState<'search'|'library'>('search');
  function chooseLibraryPlace(place:SavedPlace) {
    setSavedExpanded(false);
    chooseSearchResult({id:place.id,title:place.title,detail:place.detail,category:place.category,kind:place.source.provider==='osm'?'organization':'place',point:place.point,accuracyMeters:place.accuracyMeters,privateNote:place.note});
    setPlaceOrigin('library');
  }
  async function saveSelectedPlace() {
    if(!selectedSearchPoint?.point)return;
    const existing=libraryStore.library.places.find(p=>p.id===selectedSearchPoint.id);
    const place:SavedPlace=existing||{id:crypto.randomUUID(),title:selectedSearchPoint.title,detail:selectedSearchPoint.detail||'',category:selectedSearchPoint.category||'место',point:selectedSearchPoint.point,source:{provider:selectedSearchPoint.kind==='organization'?'osm':'pso',id:selectedSearchPoint.id},note:selectedSearchPoint.privateNote||'',accuracyMeters:selectedSearchPoint.accuracyMeters};
    const before=libraryStore.library.collections.find(c=>c.id===targetCollection)?.placeIds||[];
    const next=await libraryStore.mutate({id:crypto.randomUUID(),kind:'savePlace',collectionId:targetCollection,place});
    if(!next)return;
    const saved=next.places.find(p=>p.source.provider===place.source.provider&&p.source.id===place.source.id)!;
    setSavedPlaceNotice(`Сохранено в «${next.collections.find(c=>c.id===targetCollection)?.title}»`);
    setPlaceUndo(before.includes(saved.id)?null:{collectionId:targetCollection,placeId:saved.id});
  }
  function chooseSearchResult(result: SearchResult) {
    setPlaceOrigin('search');
    setSavedPlaceNotice('');setPlaceUndo(null);
    setLayers(value=>({...value,[result.kind==='route'?'routes':result.kind==='risk'?'risks':'places']:true}));
    if (result.point) setFocusPoint({ ...result.point, token: Date.now() });
    returnCameraRef.current = mapCenter;
    setSelectedSearchPoint(result);
    setSearchOpen(false);
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
    nextPointBreakRef.current = pointCountRef.current > 0;
    lastRecordedPointRef.current = null;
    lastRecordedAtRef.current = null;
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
        nextPointBreakRef.current=pointCountRef.current>0;lastRecordedPointRef.current=null;lastRecordedAtRef.current=null;
        setLocationStatus('Сигнал пока неточный · жду более надёжную точку');
        return;
      }
      const travelled = previous ? distanceMeters(previous, point) : 0;
      const secondsSinceLast = lastRecordedAtRef.current ? Math.max(1, (now - lastRecordedAtRef.current) / 1000) : null;
      const plausibleDistance = secondsSinceLast === null || travelled <= Math.max(50, secondsSinceLast * 12);
      const movementThreshold = Math.max(5, Math.min(next.accuracy / 2, 15));
      if(!plausibleDistance){nextPointBreakRef.current=pointCountRef.current>0;lastRecordedPointRef.current=null;lastRecordedAtRef.current=null;setLocationStatus('GPS дал скачок. Жду следующую надёжную точку.');return;}
      if (!previous || travelled >= movementThreshold) {
        if (nextPointBreakRef.current && pointCountRef.current>0) setPathGaps(gaps=>[...gaps,pointCountRef.current]);
        nextPointBreakRef.current = false;
        pointCountRef.current += 1;
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
    if (routeFlow !== 'idle') { resumeRoute(); return; }
    setFolded(false);
    onModeChange('route');
    onClearDraft();
    setElapsedSeconds(0);
    setPathGaps([]);pointCountRef.current=0;nextPointBreakRef.current=false;
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
    if(routeFlow==='gps-error' && (routePoints.length>0 || elapsedSeconds>0 || draftTitle.trim() || draftNote.trim())) {setDiscardPrompt(true);return;}
    if (routeFlow !== 'idle' && routeFlow !== 'gps-error') { resumeRoute(); return; }
    setFolded(false);
    stopRouteWatch();
    onModeChange('route');
    onClearDraft();
    setElapsedSeconds(0);
    setStartedAt(null);
    setDiscardPrompt(false);
    setPathGaps([]);
    setRouteFlow('planning');
    setLocationStatus('Передвиньте карту и добавьте точку из центра.');
  }

  function addCenterPoint() {
    onAppendRoutePoint([Number(mapCenter.lng.toFixed(5)), Number(mapCenter.lat.toFixed(5))]);
    setLocationStatus('Точка добавлена. Передвиньте карту к следующему месту.');
  }

  function undoLastPoint() {
    setUndoPoints(routePoints);
    onReplaceRoutePoints(routePoints.slice(0, -1));
    setLocationStatus(routePoints.length <= 1 ? 'Все точки убраны.' : 'Последняя точка убрана.');
  }

  function reviewPlannedRoute() {
    setRouteFlow('plan-review');
    setLocationStatus('Маршрут готов. Добавьте название и сохраните его.');
  }

  function requestDiscard() {
    if (!routePoints.length && !elapsedSeconds && !draftTitle.trim() && !draftNote.trim()) { discardRoute(); return; }
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
    setPathGaps([]);
    setFolded(false);
    setElapsedSeconds(0);
    setStartedAt(null);
    setDiscardPrompt(false);
    lastRecordedPointRef.current = null;
    lastRecordedAtRef.current = null;
    setLocationStatus('Черновик маршрута удалён.');
    window.localStorage.removeItem(routeSessionKey(petId));
  }

  function foldRoute() {
    setFolded(true);
    onModeChange('view');
    setLocationStatus(routeFlow === 'recording' ? 'Запись продолжается. Открыть управление можно ниже.' : 'Маршрут свёрнут. Можно продолжить в любой момент.');
  }
  function resumeRoute() {
    setFolded(false);
    onModeChange('route');
  }
  function changePoints(points: number[][]) {
    setUndoPoints(routePoints);
    onReplaceRoutePoints(points);
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
        zones={zones.filter(z=>isRisk(z.type)?layers.risks:layers.places)}
        features={[...features.filter(f=>f.type==='route'?layers.routes:isRisk(f.zone_type)?layers.risks:layers.places),...(layers.places?libraryStore.library.places.map(p=>({id:p.id,title:p.title,type:'point' as const,pointKind:p.accuracyMeters?'area' as const:'ownerPlace' as const,radiusMeters:p.accuracyMeters,lat:p.point.lat,lng:p.point.lng,zone_type:p.category,visibility:'private' as const})):[])]}
        picked={pickedPoint}
        routePoints={routePoints}
        routeGaps={pathGaps}
        onMapClick={mode === 'risk' ? onMapClick : routeFlow === 'planning' && !folded ? (event) => onAppendRoutePoint([event.latlng.lng,event.latlng.lat]) : undefined}
        onCenterChange={setMapCenter}
        onBoundsChange={setMapBounds}
        searchBounds={searchRequest?.bounds}
        filter="all"
        selectedFeatureId={selectedSearchPoint?.id}
        onSelectFeature={id=>{
          if(routeFocused)return;
          const place=libraryStore.library.places.find(p=>p.id===id);if(place){chooseLibraryPlace(place);return;}
          const feature=features.find(f=>f.id===id);const zone=zones.find(z=>z.id===id);
          if(feature)chooseSearchResult({id,title:feature.title,accuracyMeters:feature.type==='point'?Math.max(500,feature.radiusMeters||500):undefined,kind:feature.type==='route'?'route':'place',point:feature.type==='route'?routeStart(feature):{lat:Number(feature.lat),lng:Number(feature.lng)}});
          else if(zone)chooseSearchResult({id,title:zone.title,accuracyMeters:Math.max(500,zone.radius_meters||zone.radiusMeters||500),detail:'Примерная область',privateNote:zone.note,kind:isRisk(zone.type)?'risk':'place',point:{lat:Number(zone.approximate_lat),lng:Number(zone.approximate_lng)}});
        }}
        userLocation={routeFlow === 'record-review' || routeFlow === 'plan-review' ? null : userLocation}
        focusPoint={focusPoint}
        searchPoint={selectedSearchPoint?.point && !selectedSearchPoint.accuracyMeters ? { ...selectedSearchPoint.point, title: selectedSearchPoint.title, detail: selectedSearchPoint.detail } : null}
        fitDraftRoute={routeFlow === 'record-review' || routeFlow === 'plan-review'}
        accessibleLabel={routeFlow === 'planning' ? 'Карта для построения маршрута. Перемещайте карту стрелками или коснитесь нужного места.' : routeFlow === 'recording' || routeFlow === 'paused' ? 'Карта записываемой прогулки' : routeFlow === 'record-review' || routeFlow === 'plan-review' ? 'Обзор всего маршрута перед сохранением' : `Карта прогулок ${dogName}`}
      />
      {routeFlow === 'planning' && <span className="production-map-center-pin" aria-hidden="true"><MapPin weight="fill" /></span>}

      {(!routeFocused || routeFlow === 'planning') && <>
        {!routeFocused && <header className="production-map-topbar">
          <button className="production-map-profile" type="button" onClick={onOpenProfile} aria-label={`Открыть профиль ${dogName}`}>
            <span className="production-map-avatar">{avatar}</span>
            <span><b>Карта · {dogName}</b><small>маршруты, места и предупреждения</small></span>
          </button>
          <button className="production-map-locate" type="button" onClick={locateUser} disabled={locating} aria-label="Найти меня">
            <Crosshair weight={userLocation ? 'fill' : 'regular'} aria-hidden="true" />
            <span>{locating ? 'Ищу' : 'Найти меня'}</span>
          </button>
        </header>}

        {(mode === 'view' || routeFlow === 'planning') && <div className="production-map-search">
          <MagnifyingGlass weight="regular" aria-hidden="true" />
          <label htmlFor="production-map-search-input">Найти организацию, место или маршрут</label>
          <input id="production-map-search-input" role="combobox" aria-autocomplete="list" aria-expanded={Boolean(query && searchOpen)} aria-controls="production-map-search-results" aria-activedescendant={activeSearchIndex >= 0 ? `production-map-result-${activeSearchIndex}` : undefined} aria-describedby="production-map-search-status" value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); setRemoteSearchResults([]); setSearchRequest(null); setSearchState('idle'); }} onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && searchResults.length) { event.preventDefault(); setActiveSearchIndex((index) => (index + 1) % searchResults.length); }
            if (event.key === 'ArrowUp' && searchResults.length) { event.preventDefault(); setActiveSearchIndex((index) => (index <= 0 ? searchResults.length - 1 : index - 1)); }
            if (event.key === 'Enter') { event.preventDefault(); if (searchOpen && activeSearchIndex >= 0 && searchResults[activeSearchIndex]) chooseSearchResult(searchResults[activeSearchIndex]); else searchArea(); }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setSearchOpen(false); setActiveSearchIndex(-1); event.currentTarget.blur(); requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-production-map-workspace] .production-map-sheet-toggle')?.focus()); }
          }} placeholder="Клиника, парк или маршрут" autoComplete="off" />
          <button type="button" disabled={query.trim().length<2} onClick={searchArea}>Найти</button>
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Очистить поиск"><X weight="bold" aria-hidden="true" /></button>}
          <span id="production-map-search-status" className="sr-only" role="status" aria-live="polite">{query ? searchState === 'loading' ? 'Ищу организации и места' : searchResults.length ? `Найдено: ${searchResults.length}` : 'Ничего не найдено' : ''}</span>
          {query && searchOpen && <div id="production-map-search-results" className="production-map-search-results" role="listbox" aria-label="Результаты поиска">
            {searchResults.length ? searchResults.map((result, index) => <button id={`production-map-result-${index}`} key={`${result.kind}-${result.id}`} type="button" role="option" aria-selected={index === activeSearchIndex} onMouseEnter={() => setActiveSearchIndex(index)} onClick={() => chooseSearchResult(result)}><span>{result.kind === 'route' ? <MapTrifold aria-hidden="true" /> : result.kind === 'risk' ? <ShieldWarning aria-hidden="true" /> : result.kind === 'organization' ? <MagnifyingGlass aria-hidden="true" /> : <MapPin aria-hidden="true" />}</span><span className="production-map-result-copy"><b>{result.title}</b>{result.detail && <em>{result.detail}</em>}</span><small>{result.kind === 'route' ? 'маршрут' : result.kind === 'risk' ? 'опасность' : result.category || 'место'}</small></button>) : searchState === 'loading' ? <p>Ищу организации и места…</p> : searchState === 'error' ? <p>Поиск мест временно недоступен. Сохранённые точки всё ещё можно найти.</p> : searchState === 'quota' ? <p>Лимит поиска исчерпан. Подождите и повторите.</p> : searchState === 'idle' ? <p>Нажмите «Найти» для поиска в этой области.</p> : <p>Ничего не найдено. Попробуйте название или тип места.</p>}
          </div>}
        </div>}
      </>}

      {searchRequest && !selectedSearchPoint && <div className="map-search-area"><span>Поиск в выбранной области · OpenStreetMap</span><button type="button" onClick={searchArea}>Искать в этой области</button></div>}
      {selectedSearchPoint && <article className="map-place-panel" aria-label="Выбранное место"><button type="button" onClick={() => {setSelectedSearchPoint(null);setSearchOpen(placeOrigin==='search');if(placeOrigin==='library')setSavedExpanded(true);if(returnCameraRef.current)setFocusPoint({...returnCameraRef.current,token:Date.now()});}}>{placeOrigin==='library'?'К подборке':'К результатам'}</button><h2>{selectedSearchPoint.title}</h2><p>{selectedSearchPoint.detail || selectedSearchPoint.category}{selectedSearchPoint.accuracyMeters?` · примерная область около ${selectedSearchPoint.accuracyMeters} м`:''}</p>{selectedSearchPoint.privateNote&&<p>Моя заметка: {selectedSearchPoint.privateNote}</p>}{selectedSearchPoint.kind!=='route'&&<><label>Подборка<select value={targetCollection} onChange={e=>setTargetCollection(e.target.value)}>{libraryStore.library.collections.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><button type="button" disabled={libraryStore.state!=='ready'||libraryStore.busy} onClick={saveSelectedPlace}>Сохранить место</button>{libraryStore.error&&<p role="alert">{libraryStore.error}</p>}{savedPlaceNotice&&<p role="status">{savedPlaceNotice}</p>}{placeUndo&&<button type="button" disabled={libraryStore.busy} onClick={async()=>{if(await libraryStore.mutate({id:crypto.randomUUID(),kind:'membership',...placeUndo,present:false})){setPlaceUndo(null);setSavedPlaceNotice('Добавление отменено');}}}>Отменить добавление</button>}</>}<p>{selectedSearchPoint.kind==='organization'?'Источник: OpenStreetMap. Условия посещения с собакой: нет данных.':'Сохранённая запись Псё'}</p>{selectedSearchPoint.kind==='route'&&<button type="button" onClick={()=>{onReuseRoute?.(selectedSearchPoint.id);setSelectedSearchPoint(null);}}>Повторить маршрут</button>}{selectedSearchPoint.point && selectedSearchPoint.kind!=='route' && <button type="button" disabled={['recording','paused','record-review'].includes(routeFlow)} onClick={() => {const point=selectedSearchPoint.point!;if(routeFlow==='idle')startPlanning();else resumeRoute();onAppendRoutePoint([point.lng,point.lat]);setSelectedSearchPoint(null);}}>Добавить в прогулку</button>}</article>}
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
          <button type="button" onClick={foldRoute} aria-label="Свернуть маршрут">Свернуть</button>
          {(routeFlow === 'recording' || routeFlow === 'paused' || routeFlow === 'record-review' || routeFlow === 'planning' || routeFlow === 'plan-review') && <button type="button" className="route-discard-trigger" onClick={requestDiscard}>Отменить</button>}
        </header>

        <div className="production-route-controller-body" data-route-controller-body>
        {(routeFlow === 'recording' || routeFlow === 'paused') && <>
          <dl className="production-route-metrics">
            <div><dt>Время</dt><dd>{formatDuration(elapsedSeconds)}</dd></div>
            <div><dt>Расстояние</dt><dd>{formatDistance(routeDistance)}</dd></div>
            <div><dt>Сигнал</dt><dd>{routeFlow === 'recording' ? 'Запись' : 'Пауза'}</dd></div>
          </dl>
          <p className="production-route-open-note"><ShieldCheck weight="regular" aria-hidden="true" />Пока идёт запись, оставьте Псё открытым. Черновик сохранится, если вы смените вкладку.</p>
        </>}

        {routeFlow === 'gps-error' && <section className="production-route-error" role="alert">
          <NavigationArrow weight="regular" aria-hidden="true" />
          <div><b>Псё не видит ваше местоположение</b><p>Разрешите геопозицию в Telegram и попробуйте снова или постройте путь вручную.</p></div>
        </section>}

        {routeFlow === 'planning' && <>
          {routePoints.length > 0 && <ol className="map-waypoint-list" aria-label="Точки маршрута">{routePoints.map((point,index)=><li key={index}><span>{index===0?'Начало':`Точка ${index+1}`}<small>{point[1].toFixed(4)}, {point[0].toFixed(4)}</small></span><button type="button" disabled={index===0} aria-label={`Точка ${index+1}: выше`} onClick={()=>changePoints(moveRoutePoint(routePoints,index,index-1))}><CaretUp /></button><button type="button" disabled={index===routePoints.length-1} aria-label={`Точка ${index+1}: ниже`} onClick={()=>changePoints(moveRoutePoint(routePoints,index,index+1))}><CaretDown /></button><button type="button" aria-label={`Удалить точку ${index+1}`} onClick={()=>changePoints(routePoints.filter((_,i)=>i!==index))}><X /></button></li>)}</ol>}
          <div className="map-editor-tools"><button type="button" disabled={routePoints.length<2} onClick={()=>changePoints(closeRouteLoop(routePoints))}>Вернуться к началу</button>{undoPoints && <button type="button" onClick={()=>{onReplaceRoutePoints(undoPoints);setUndoPoints(null)}}>Отменить изменение</button>}</div>
          <div className="production-route-plan-help"><PencilSimple weight="regular" aria-hidden="true" /><div><b>{routePoints.length ? 'Добавьте следующий поворот' : 'Отметьте начало маршрута'}</b><p>Передвиньте карту так, чтобы метка оказалась в нужном месте, затем добавьте точку.</p></div></div>
        </>}

        {(routeFlow === 'record-review' || routeFlow === 'plan-review') && <div className="production-route-review">
          <div className="production-route-review-summary"><Footprints weight="regular" aria-hidden="true" /><div><b>{routeFlow === 'record-review' ? 'Прогулка записана' : 'Маршрут построен'}</b><p>{routeFlow === 'record-review' ? `${formatDuration(elapsedSeconds)} · ` : 'Нарисованный путь · '}{formatDistance(routeDistance)} · {formatPointCount(routePoints.length)}</p></div></div>
          {pathGaps.length>0 && <p role="status">В записи есть перерывы GPS. Пропущенные участки не входят в расстояние и не соединены на карте.</p>}
          {composer}
        </div>}
        </div>

        {(routeFlow === 'recording' || routeFlow === 'paused' || routeFlow === 'gps-error' || routeFlow === 'planning') && <footer className={`production-route-controller-actions ${routeFlow}`} data-route-controller-actions>
          {routeFlow === 'recording' && <button type="button" className="primary" onClick={pauseWalk}><Pause weight="fill" aria-hidden="true" />Пауза</button>}
          {routeFlow === 'paused' && <>
            <button type="button" className="primary" onClick={watchRoute}><Play weight="fill" aria-hidden="true" />Продолжить</button>
            <button type="button" className="secondary" disabled={!canSaveDraft} onClick={finishWalk}><Stop weight="fill" aria-hidden="true" />{canSaveDraft ? 'Завершить' : 'Пройдите несколько метров'}</button>
          </>}
          {routeFlow === 'gps-error' && <>
            <button type="button" className="primary" onClick={watchRoute}>Попробовать снова</button>
            <button type="button" className="secondary" onClick={canSaveDraft?finishWalk:startPlanning}>{canSaveDraft?"Сохранить записанную часть":"Построить заранее"}</button>
            <button type="button" className="text-action" onClick={discardRoute}>Вернуться на карту</button>
          </>}
          {routeFlow === 'planning' && <>
            <button type="button" className="primary" onClick={addCenterPoint}><MapPin weight="fill" aria-hidden="true" />Добавить точку</button>
            <button type="button" className="secondary" disabled={!routePoints.length} onClick={undoLastPoint}><ArrowCounterClockwise weight="regular" aria-hidden="true" />Убрать точку</button>
            <button type="button" className="secondary" disabled={!canSaveDraft} onClick={reviewPlannedRoute}>Готово</button>
          </>}
        </footer>}
      </>}
    </section> : mode === 'risk' ? <section className="production-map-snap-sheet expanded risk-sheet" data-map-snap-sheet>
      <header className="production-map-simple-heading"><div><b>Предупредить об опасности</b><p>{pickedPoint ? 'Место выбрано · добавьте пояснение' : 'Коснитесь места на карте'}</p></div><button type="button" onClick={() => onModeChange('view')}>Отменить</button></header>
      <div className="production-map-sheet-body">{composer}</div>
    </section> : <section className={`production-map-snap-sheet home-sheet${savedExpanded ? ' expanded' : ''}`} data-map-snap-sheet>
      {folded && <div className="map-resume-draft" role="status"><span><b>{routeFlow==='recording'?'Прогулка записывается':'Есть незавершённый маршрут'}</b><small>{formatPointCount(routePoints.length)} · {formatDistance(routeDistance)}</small></span><button type="button" onClick={resumeRoute}>Продолжить</button></div>}
      <section className="production-route-launch" aria-label="Прогулки и маршруты">
        <button type="button" className="production-route-start" data-route-action="start" onClick={startWalk}><NavigationArrow weight="fill" aria-hidden="true" /><span>Начать прогулку</span></button>
        <button type="button" className="production-route-plan" data-route-action="plan" onClick={startPlanning}><PencilSimple weight="regular" aria-hidden="true" /><span>Маршрут</span></button>
        <button type="button" className="production-route-risk" data-route-action="risk" onClick={startRisk}><ShieldWarning weight="regular" aria-hidden="true" /><span>Опасность</span></button>
      </section>
      <button className="map-duration-toggle" type="button" aria-expanded={durationOpen} onClick={()=>setDurationOpen(v=>!v)}>Прогулка по времени</button>
      {durationOpen&&<section className="map-duration-planner"><p>Начало — центр карты. Можно передвинуть карту, найти адрес или нажать «Найти меня».</p><label>Сколько минут<input type="number" min="5" max="180" step="5" value={wantedMinutes} onChange={e=>{setWantedMinutes(Number(e.target.value));setDurationResult(undefined);}} /></label><button type="button" onClick={()=>setDurationResult(findDurationWalk(recordedRoutes,mapCenter,wantedMinutes))}>Подобрать записанный круг</button>{durationResult===null&&<p role="status">Подходящего записанного круга у выбранного начала нет. Выберите другую область или постройте маршрут вручную.</p>}{durationResult&&<div role="status"><b>{durationResult.route.title}</b><p>Около {durationResult.estimatedMinutes} мин пешком без остановок · начало в {durationResult.startMeters} м от центра. Вариант из прошлой прогулки; оценка рассчитана для 4 км/ч, это не проверка текущей проходимости.</p><button type="button" disabled={routeFlow!=='idle'} onClick={()=>{onReuseRoute?.(durationResult.route.id);setDurationOpen(false);}}>Посмотреть и изменить</button></div>}</section>}
      <button className="production-map-sheet-toggle" type="button" aria-expanded={savedExpanded} aria-controls="production-map-saved-body" onClick={() => setSavedExpanded((expanded) => !expanded)}>
        <span className="production-map-grabber" aria-hidden="true" />
        <span><b>Сохранённое на карте</b><small>{counts.routes} маршрутов · {counts.places} мест · {counts.risks} предупреждений</small></span>
        {savedExpanded ? <CaretDown weight="bold" aria-hidden="true" /> : <CaretUp weight="bold" aria-hidden="true" />}
      </button>
      <div id="production-map-saved-body" className="production-map-sheet-body" hidden={!savedExpanded}>
        <div className="production-map-filters" role="group" aria-label="Что показывать на карте">
          <button type="button" data-map-filter="all" aria-pressed={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => selectLayerPreset('all')}>Все <span>{counts.routes + counts.places + counts.risks}</span></button>
          <button type="button" data-map-filter="routes" aria-pressed={filter === 'routes'} className={filter === 'routes' ? 'active' : ''} onClick={() => selectLayerPreset('routes')}>Маршруты <span>{counts.routes}</span></button>
          <button type="button" data-map-filter="places" aria-pressed={filter === 'places'} className={filter === 'places' ? 'active' : ''} onClick={() => selectLayerPreset('places')}>Места <span>{counts.places}</span></button>
          <button type="button" data-map-filter="risks" aria-pressed={filter === 'risks'} className={filter === 'risks' ? 'active risk' : 'risk'} onClick={() => selectLayerPreset('risks')}>Опасности <span>{counts.risks}</span></button>
        </div>
        <fieldset className="map-layer-legend"><legend>Слои и обозначения</legend>{(['routes','places','risks'] as const).map(k=><label key={k}><input type="checkbox" checked={layers[k]} onChange={e=>setLayers(current=>({...current,[k]:e.target.checked}))} />{k==='routes'?'Линия — маршруты':k==='places'?'Метка — места':'Область — предупреждения'}</label>)}</fieldset>
        <MapLibraryPanel store={libraryStore} onChoose={chooseLibraryPlace} canPlan={routeFlow==='idle'} onPlan={points=>{startPlanning();onReplaceRoutePoints(points);setSavedExpanded(false);}} />
        <div data-map-saved-content>{savedContent}</div>
      </div>
    </section>}
  </section>;
}
