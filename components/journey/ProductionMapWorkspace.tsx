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
import {parseRoutePlanning,stopsKey,downloadRouteGpx,type RoutePlanning,type RouteStop} from '@/lib/routePlanning';
import { measuredRouteDistance, validRouteGaps } from '@/lib/routeGeometry';
import {findDurationWalk} from '@/lib/durationWalk';
import type {OwnerRouteView} from '@/lib/mapUi';
import { useMapLibrary } from '@/components/map/useMapLibrary';
import { MapLibraryPanel } from '@/components/map/MapLibraryPanel';
import type { SavedPlace } from '@/lib/mapLibrary';
import { routeSessionKey, persistentFlows, readRouteSession, hasRouteWork, type RouteFlow, type StoredRouteSession } from '@/lib/mapSession';

export type RouteDraftMeta = {
  routeSource: 'recorded' | 'planned';
  planning?:RoutePlanning;
  ready?:boolean;
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
  routeEditSeed?: {token:number;points:number[][];planning?:RoutePlanning;review?:boolean;pathGaps?:number[];routeSource?:'recorded'|'planned';durationSeconds?:number;startedAt?:string}|null;
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
  const [workspaceTab,setWorkspaceTab]=useState<'places'|'walks'|'saved'>('places');
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

  const [planningMode,setPlanningMode]=useState<'manual'|'walking'>('manual');
  const [routeStops,setRouteStops]=useState<RouteStop[]>([]);
  const [candidate,setCandidate]=useState<RouteStop|null>(null);
  const [calculationKey,setCalculationKey]=useState('');
  const [calculationState,setCalculationState]=useState<'idle'|'loading'|'preview'|'ready'|'error'>('idle');
  type WalkResult={path:number[][];distanceMeters:number;estimatedMinutes:number;stairs:boolean;snaps:{point:number[];distanceMeters:number}[]};
  const [walkResult,setWalkResult]=useState<WalkResult|null>(null);
  const [calculationError,setCalculationError]=useState('');
  const calculationAbort=useRef<AbortController|null>(null);
  const activeStops=useMemo(()=>planningMode==='walking'?routeStops:routePoints.map(point=>({point,title:routeStops.find(s=>s.point[0]===point[0]&&s.point[1]===point[1])?.title})),[planningMode,routeStops,routePoints]);
  const activeStopsKey=stopsKey(activeStops);
  const stopKeyRef=useRef(activeStopsKey);
  useLayoutEffect(()=>{stopKeyRef.current=activeStopsKey;},[activeStopsKey]);
  useEffect(()=>()=>calculationAbort.current?.abort(),[]);
  const plannerReady=planningMode==='manual'||(calculationKey===activeStopsKey&&routePoints.length>=2&&calculationState!=='loading'&&calculationState!=='preview');
  const planning=useMemo<RoutePlanning|undefined>(()=>['planning','plan-review'].includes(routeFlow)?{version:1,mode:planningMode,stops:activeStops,...(walkResult?{stairs:walkResult.stairs,estimatedMinutes:walkResult.estimatedMinutes}:{})}:undefined,[routeFlow,planningMode,activeStops,walkResult]);
  function resetPlanner(){calculationAbort.current?.abort();setRouteStops([]);setPlanningMode('walking');setCalculationKey('');setCalculationState('idle');setWalkResult(null);setCandidate(null);setCalculationError('');setUndoStops(null);}
  function editStops(stops:RouteStop[]){calculationAbort.current?.abort();setUndoStops(activeStops);setRouteStops(stops);setCalculationError('');setCalculationState('idle');setWalkResult(null);if(planningMode==='manual')onReplaceRoutePoints(stops.map(s=>s.point));}
  const [undoStops,setUndoStops]=useState<RouteStop[]|null>(null);
  function appendStop(stop:RouteStop){editStops([...activeStops,stop]);setCandidate(null);setSelectedSearchPoint(null);setLocationStatus('Остановка добавлена. Проверьте порядок и рассчитайте путь.');}
  async function calculateWalk(){
    if(guest){setCalculationError('Для расчёта по дорожкам войдите в Псё. Ручной путь можно сохранить и без входа.');return;}
    if(activeStops.length<2)return;
    calculationAbort.current?.abort();const controller=new AbortController();calculationAbort.current=controller;const key=activeStopsKey;setCalculationKey('');setCalculationState('loading');setCalculationError('');
    try{const response=await fetch('/api/map/walking',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({points:activeStops.map(s=>s.point)}),signal:controller.signal});const result=await response.json();if(controller.signal.aborted||stopKeyRef.current!==key)return;
    if(!response.ok){const messages:Record<string,string>={AUTH_REQUIRED:'Войдите в Псё для расчёта по дорожкам.',NO_NEARBY_PATH:'У одной из точек нет дорожки поблизости. Переместите её на карту дорожек.',NO_PATH:'Связный пеший путь не найден. Измените остановки или используйте ручное построение.',AREA_LIMIT:'Для такого большого района автоматический расчёт недоступен. Ручное построение сохраняет все точки.',POINT_LIMIT:'Для автоматического расчёта выберите от 2 до 100 остановок. В ручном режиме все точки остаются доступны.',POINTS_TOO_CLOSE:'Остановки слишком близко. Добавьте другую точку.',ROUTING_QUOTA:'Расчёт сейчас занят или исчерпан дневной лимит. Подождите и повторите; черновик сохранён.'};throw Error(messages[result.error]||'Не удалось рассчитать дорожки. Черновик сохранён — повторите или выберите ручной путь.');}
    setWalkResult(result);setCalculationState('preview');
    }catch(error){if(controller.signal.aborted)return;setCalculationError(error instanceof Error?error.message:'Не удалось рассчитать путь.');setCalculationState('error');}
  }
  function applyWalk(){if(!walkResult)return;const stops=activeStops.map((s,i)=>({...s,point:walkResult.snaps[i].point}));setRouteStops(stops);setCalculationKey(stopsKey(stops));setCalculationState('ready');onReplaceRoutePoints(walkResult.path);setPathGaps([]);setLocationStatus('Пеший путь применён. Можно посмотреть и сохранить маршрут.');}
  function changePlanningMode(next:'manual'|'walking'){if(next===planningMode)return;calculationAbort.current?.abort();const stops=activeStops;setRouteStops(stops);setPlanningMode(next);setCalculationState('idle');setCalculationKey('');setCalculationError('');setWalkResult(null);if(next==='manual')onReplaceRoutePoints(stops.map(s=>s.point));}

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
      planning,
      ready:recorded||plannerReady,
      pathGaps,
      startedAt: recorded && startedAt ? new Date(startedAt).toISOString() : undefined,
      durationSeconds: recorded ? elapsedSeconds : 0,
      distanceMeters: Math.round(routeDistance),
    });
  }, [elapsedSeconds, onRouteMetaChange, routeDistance, routeFlow, startedAt, pathGaps, planning, plannerReady]);

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
      const plan=parseRoutePlanning(stored.planning);setPlanningMode(plan?.mode||'manual');setRouteStops(plan?.stops||stored.points.map(point=>({point})));setCalculationKey(stored.calculationKey||'');setCalculationState('ready');setWalkResult(plan?{path:stored.points,distanceMeters:Math.round(measuredRouteDistance(stored.points)),estimatedMinutes:plan.estimatedMinutes||Math.ceil(measuredRouteDistance(stored.points)/75),stairs:!!plan.stairs,snaps:plan.stops.map(s=>({point:s.point,distanceMeters:0}))}:null);
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
        planning,calculationKey,
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
  }, [elapsedSeconds, hydrated, petId, routeFlow, routePoints, startedAt, draftTitle, draftNote, pathGaps, editingRouteId,planning,calculationKey]);

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
    setLocationStatus('Маршрут сохранён. Откройте его в сохранённых маршрутах.');setSavedExpanded(true);setWorkspaceTab('saved');
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
    resetPlanner();setRouteFlow('planning');
    setLocationStatus('Выберите остановку на карте или найдите место.');
  }, [mode, onClearDraft, routeFlow, hydrated,routeEditSeed]);
  useEffect(()=>{
    if(!routeEditSeed)return;
    onReplaceRoutePoints(routeEditSeed.points);setFolded(false);setElapsedSeconds(routeEditSeed.review?routeEditSeed.durationSeconds||0:0);setPathGaps(routeEditSeed.pathGaps||[]);setStartedAt(routeEditSeed.review&&routeEditSeed.startedAt?Date.parse(routeEditSeed.startedAt):null);setRouteFlow(routeEditSeed.review?(routeEditSeed.routeSource==='recorded'?'record-review':'plan-review'):'planning');const plan=routeEditSeed.planning;setPlanningMode(plan?.mode||'manual');setRouteStops(plan?.stops||routeEditSeed.points.map(point=>({point})));setCalculationKey(plan?stopsKey(plan.stops):'');setCalculationState('ready');setCandidate(null);setWalkResult(plan?{path:routeEditSeed.points,distanceMeters:Math.round(measuredRouteDistance(routeEditSeed.points)),estimatedMinutes:plan.estimatedMinutes||Math.ceil(measuredRouteDistance(routeEditSeed.points)/75),stairs:!!plan.stairs,snaps:plan.stops.map(s=>({point:s.point,distanceMeters:0}))}:null);
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
    resetPlanner();setRouteFlow('planning');
    setLocationStatus('Выберите остановку на карте или найдите место.');
  }

  function addCenterPoint() {
    setCandidate({point:[Number(mapCenter.lng.toFixed(5)),Number(mapCenter.lat.toFixed(5))]});
    setLocationStatus('Проверьте точку и подтвердите добавление.');
  }

  function reviewPlannedRoute() {
    if(!plannerReady)return;setRouteFlow('plan-review');
    setLocationStatus('Маршрут готов. Добавьте название и сохраните его.');
  }

  function requestDiscard() {
    if (!routePoints.length && !activeStops.length && !elapsedSeconds && !draftTitle.trim() && !draftNote.trim()) { discardRoute(); return; }
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
    setRouteFlow('idle');resetPlanner();
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
<div className="map-workspace-tools">      {(!routeFocused || routeFlow === 'planning') && <>
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
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setSearchOpen(false); setActiveSearchIndex(-1); event.currentTarget.blur(); requestAnimationFrame(()=>document.querySelector<HTMLElement>('[data-production-map-workspace] .map-home-tabs button[aria-pressed="true"], [data-production-map-workspace] .production-map-sheet-toggle')?.focus()); }
          }} placeholder="Клиника, парк или маршрут" autoComplete="off" />
          <button type="button" disabled={query.trim().length<2} onClick={searchArea}>Найти</button>
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Очистить поиск"><X weight="bold" aria-hidden="true" /></button>}
          <span id="production-map-search-status" className="sr-only" role="status" aria-live="polite">{query ? searchState === 'loading' ? 'Ищу организации и места' : searchResults.length ? `Найдено: ${searchResults.length}` : 'Ничего не найдено' : ''}</span>
          {query && searchOpen && <div id="production-map-search-results" className="production-map-search-results" role="listbox" aria-label="Результаты поиска">
            {searchResults.length ? searchResults.map((result, index) => <button id={`production-map-result-${index}`} key={`${result.kind}-${result.id}`} type="button" role="option" aria-selected={index === activeSearchIndex} onMouseEnter={() => setActiveSearchIndex(index)} onClick={() => chooseSearchResult(result)}><span>{result.kind === 'route' ? <MapTrifold aria-hidden="true" /> : result.kind === 'risk' ? <ShieldWarning aria-hidden="true" /> : result.kind === 'organization' ? <MagnifyingGlass aria-hidden="true" /> : <MapPin aria-hidden="true" />}</span><span className="production-map-result-copy"><b>{result.title}</b>{result.detail && <em>{result.detail}</em>}</span><small>{result.kind === 'route' ? 'маршрут' : result.kind === 'risk' ? 'опасность' : result.category || 'место'}</small></button>) : searchState === 'loading' ? <p>Ищу организации и места…</p> : searchState === 'error' ? <p>Поиск мест временно недоступен. Сохранённые точки всё ещё можно найти.</p> : searchState === 'quota' ? <p>Лимит поиска исчерпан. Подождите и повторите.</p> : searchState === 'idle' ? <p>Нажмите «Найти» для поиска в этой области.</p> : <p>Ничего не найдено. Попробуйте название или тип места.</p>}
          </div>}
        </div>}
      </>}

      {searchRequest && !selectedSearchPoint && <div className="map-search-area"><span>Поиск в выбранной области · OpenStreetMap</span><button type="button" onClick={searchArea}>Искать в этой области</button></div>}      <div className="production-map-status" role="status" aria-live="polite">{locationStatus}</div></div>
    <section className="production-map-canvas" aria-label={`Карта прогулок ${dogName}`}>
      <LiveMap
        zones={zones.filter(z=>isRisk(z.type)?layers.risks:layers.places)}
        features={[...features.filter(f=>f.type==='route'?layers.routes:isRisk(f.zone_type)?layers.risks:layers.places),...(layers.places?libraryStore.library.places.map(p=>({id:p.id,title:p.title,type:'point' as const,pointKind:p.accuracyMeters?'area' as const:'ownerPlace' as const,radiusMeters:p.accuracyMeters,lat:p.point.lat,lng:p.point.lng,zone_type:p.category,visibility:'private' as const})):[])]}
        picked={candidate?{lng:candidate.point[0],lat:candidate.point[1]}:pickedPoint}
        routePoints={calculationState==='preview'&&walkResult?walkResult.path:routePoints}
        routeStops={routeFlow==='planning'||routeFlow==='plan-review'?activeStops.map(s=>s.point):[]}
        routeGaps={pathGaps}
        onMapClick={mode === 'risk' ? onMapClick : routeFlow === 'planning' && !folded ? (event) => setCandidate({point:[event.latlng.lng,event.latlng.lat]}) : undefined}
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




    </section>

<div className="map-work-area">      {selectedSearchPoint && <article className="map-place-panel" aria-label="Выбранное место"><button type="button" onClick={() => {setSelectedSearchPoint(null);setSearchOpen(placeOrigin==='search');if(placeOrigin==='library')setSavedExpanded(true);if(returnCameraRef.current)setFocusPoint({...returnCameraRef.current,token:Date.now()});}}>{placeOrigin==='library'?'К подборке':'К результатам'}</button><h2>{selectedSearchPoint.title}</h2><p>{selectedSearchPoint.detail || selectedSearchPoint.category}{selectedSearchPoint.accuracyMeters?` · примерная область около ${selectedSearchPoint.accuracyMeters} м`:''}</p>{selectedSearchPoint.privateNote&&<p>Моя заметка: {selectedSearchPoint.privateNote}</p>}{selectedSearchPoint.kind!=='route'&&<><label>Подборка<select value={targetCollection} onChange={e=>setTargetCollection(e.target.value)}>{libraryStore.library.collections.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><button type="button" disabled={libraryStore.state!=='ready'||libraryStore.busy} onClick={saveSelectedPlace}>Сохранить место</button>{libraryStore.error&&<p role="alert">{libraryStore.error}</p>}{savedPlaceNotice&&<p role="status">{savedPlaceNotice}</p>}{placeUndo&&<button type="button" disabled={libraryStore.busy} onClick={async()=>{if(await libraryStore.mutate({id:crypto.randomUUID(),kind:'membership',...placeUndo,present:false})){setPlaceUndo(null);setSavedPlaceNotice('Добавление отменено');}}}>Отменить добавление</button>}</>}<p>{selectedSearchPoint.kind==='organization'?'Источник: OpenStreetMap. Условия посещения с собакой: нет данных.':'Сохранённая запись Псё'}</p>{selectedSearchPoint.kind==='route'&&<button type="button" onClick={()=>{onReuseRoute?.(selectedSearchPoint.id);setSelectedSearchPoint(null);}}>Повторить маршрут</button>}{selectedSearchPoint.point && selectedSearchPoint.kind!=='route' && <button type="button" disabled={['recording','paused','record-review'].includes(routeFlow)} onClick={() => {const point=selectedSearchPoint.point!;if(routeFlow==='idle')startPlanning();else resumeRoute();setCandidate({point:[point.lng,point.lat],title:selectedSearchPoint.title});setSelectedSearchPoint(null);}}>Добавить в прогулку</button>}</article>}
    {routeFocused ? <section className="production-route-controller" data-route-controller aria-label={routeTitle}>
      {discardPrompt ? <section ref={discardDialogRef} className="production-route-discard" role="alertdialog" aria-modal="true" aria-labelledby="route-discard-title" aria-describedby="route-discard-description">
        <Trash weight="regular" aria-hidden="true" />
        <div><b id="route-discard-title">Удалить незавершённый маршрут?</b><p id="route-discard-description">Записанные точки и время восстановить не получится.</p></div>
        <button type="button" className="secondary" onClick={continueAfterDiscard}>Продолжить маршрут</button>
        <button type="button" className="danger" onClick={discardRoute}>Удалить черновик</button>
      </section> : <>
        <header className="production-route-controller-heading">
          <div><b>{routeTitle}</b><p>{routeFlow === 'planning' || routeFlow === 'plan-review' ? `${formatPointCount(activeStops.length)} · ${plannerReady?formatDistance(routeDistance):'нужно рассчитать путь'}` : `${formatDuration(elapsedSeconds)} · ${formatDistance(routeDistance)}`}</p></div>
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
          <div className="route-planning-method" role="group" aria-label="Способ построения"><button type="button" aria-pressed={planningMode==='walking'} onClick={()=>changePlanningMode('walking')}>По дорожкам</button><button type="button" aria-pressed={planningMode==='manual'} onClick={()=>changePlanningMode('manual')}>Вручную</button></div>
          {planningMode==='manual'&&<p className="muted">Рисуем путь через ваши точки. Проверка проходов не выполняется.</p>}
          {candidate&&<section className="route-candidate" aria-label="Добавить остановку"><b>{candidate.title||'Выбранная точка'}</b><p>{candidate.point[1].toFixed(5)}, {candidate.point[0].toFixed(5)}</p><button type="button" className="primary" onClick={()=>appendStop(candidate)}>Добавить остановку</button><button type="button" onClick={()=>setCandidate(null)}>Другая точка</button></section>}
          <ol className="map-waypoint-list" aria-label="Точки маршрута">{activeStops.map((stop,index)=><li key={index}><button className="route-stop-label" type="button" onClick={()=>setFocusPoint({lat:stop.point[1],lng:stop.point[0],token:Date.now()})}><b>{index+1}. {stop.title|| (index===0?'Начало':'Остановка')}</b><small>{stop.point[1].toFixed(4)}, {stop.point[0].toFixed(4)}</small></button><button type="button" disabled={index===0} aria-label={`Точка ${index+1}: выше`} onClick={()=>{const list=[...activeStops];[list[index-1],list[index]]=[list[index],list[index-1]];editStops(list);}}><CaretUp /></button><button type="button" disabled={index===activeStops.length-1} aria-label={`Точка ${index+1}: ниже`} onClick={()=>{const list=[...activeStops];[list[index+1],list[index]]=[list[index],list[index+1]];editStops(list);}}><CaretDown /></button><button type="button" aria-label={`Удалить точку ${index+1}`} onClick={()=>editStops(activeStops.filter((_,i)=>i!==index))}><X /></button></li>)}</ol>
          <div className="map-editor-tools"><button type="button" onClick={()=>{setSearchOpen(true);document.querySelector<HTMLInputElement>('#production-map-search-input')?.focus();}}>Найти и добавить место</button><button type="button" disabled={activeStops.length<2} onClick={()=>{const first=activeStops[0],last=activeStops.at(-1)!;if(first.point[0]!==last.point[0]||first.point[1]!==last.point[1])editStops([...activeStops,{...first,title:'Возврат к началу'}]);}}>Вернуться к началу</button>{undoStops&&<button type="button" onClick={()=>{const previous=undoStops;editStops(previous);setUndoStops(null);}}>Отменить изменение</button>}</div>
          {calculationError&&<p className="route-calculation-error" role="alert">{calculationError}</p>}
          {planningMode==='walking'&&<div className="route-calculation"><button type="button" className="primary" disabled={activeStops.length<2||calculationState==='loading'} onClick={()=>void calculateWalk()}>{calculationState==='loading'?'Рассчитываю дорожки…':'Рассчитать пеший путь'}</button>{calculationState==='preview'&&walkResult&&<section role="status"><b>{formatDistance(walkResult.distanceMeters)} · ≈ {walkResult.estimatedMinutes} мин</b><p>Точки будут привязаны к дорожкам: до {Math.max(...walkResult.snaps.map(s=>s.distanceMeters))} м от выбранных мест.{walkResult.stairs?' Есть лестницы.':''}</p><button type="button" className="primary" onClick={applyWalk}>Применить этот путь</button></section>}<p>OpenStreetMap · оценка для 4,5 км/ч без остановок. Условия прохода с собакой не проверены.</p>{!plannerReady&&routePoints.length>1&&<p>На карте прежний путь или предпросмотр. До применения нового расчёта сохранить его нельзя.</p>}</div>}

        </>}

        {(routeFlow === 'record-review' || routeFlow === 'plan-review') && <div className="production-route-review">
          <div className="production-route-review-summary"><Footprints weight="regular" aria-hidden="true" /><div><b>{routeFlow === 'record-review' ? 'Прогулка записана' : 'Маршрут построен'}</b><p>{routeFlow === 'record-review' ? `${formatDuration(elapsedSeconds)} · ` : planningMode==='walking'?'Пешком · ':'Нарисованный путь · '}{formatDistance(routeDistance)} · {formatPointCount(routeFlow==='plan-review'?activeStops.length:routePoints.length)}</p></div></div>
          {pathGaps.length>0 && <p role="status">В записи есть перерывы GPS. Пропущенные участки не входят в расстояние и не соединены на карте.</p>}
          {routeFlow==='plan-review'&&planningMode==='walking'&&<p>≈ {Math.ceil(routeDistance/75)} мин без остановок · OpenStreetMap{walkResult?.stairs?' · есть лестницы':''}</p>}
          {routeFlow==='plan-review'&&<button type="button" onClick={()=>setRouteFlow('planning')}>Изменить остановки</button>}
          <button type="button" onClick={()=>downloadRouteGpx(draftTitle||'Прогулка',routePoints,pathGaps,planning?.stops)}>Скачать GPX</button>
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
            <button type="button" className="secondary" disabled={!activeStops.length} onClick={()=>editStops(activeStops.slice(0,-1))}><ArrowCounterClockwise weight="regular" aria-hidden="true" />Убрать точку</button>
            <button type="button" className="secondary" disabled={!canSaveDraft||!plannerReady} onClick={reviewPlannedRoute}>Готово</button>
          </>}
        </footer>}
      </>}
    </section> : mode === 'risk' ? <section className="production-map-snap-sheet expanded risk-sheet" data-map-snap-sheet>
      <header className="production-map-simple-heading"><div><b>Предупредить об опасности</b><p>{pickedPoint ? 'Место выбрано · добавьте пояснение' : 'Коснитесь места на карте'}</p></div><button type="button" onClick={() => onModeChange('view')}>Отменить</button></header>
      <div className="production-map-sheet-body">{composer}</div>
    </section> : <section className={`production-map-snap-sheet home-sheet${savedExpanded ? ' expanded' : ''}`} data-map-snap-sheet>
      {folded && <div className="map-resume-draft" role="status"><span><b>{routeFlow==='recording'?'Прогулка записывается':'Есть незавершённый маршрут'}</b><small>{formatPointCount(routePoints.length)} · {formatDistance(routeDistance)}</small></span><button type="button" onClick={resumeRoute}>Продолжить</button></div>}
      <nav className="map-home-tabs" aria-label="Работа с картой">{(['places','walks','saved'] as const).map(t=><button key={t} type="button" aria-pressed={workspaceTab===t} onClick={()=>{setWorkspaceTab(t);setSavedExpanded(t==='saved');}}>{t==='places'?'Места':t==='walks'?'Прогулки':'Сохранённое'}</button>)}</nav>
      {workspaceTab==='places'&&<div className="map-nearby-places"><h2>Места рядом</h2><button type="button" onClick={()=>document.querySelector<HTMLInputElement>('#production-map-search-input')?.focus()}>Найти место или адрес</button>{libraryStore.library.places.slice(0,3).map(p=><button className="map-nearby-row" type="button" key={p.id} onClick={()=>chooseLibraryPlace(p)}><b>{p.title}</b><span>{p.category}</span></button>)}<button type="button" className="text-action" onClick={startRisk}>Предупредить об опасности</button></div>}
      <div hidden={workspaceTab!=='walks'}>
      <section className="production-route-launch" aria-label="Прогулки и маршруты">
        <button type="button" className="production-route-start" data-route-action="start" onClick={startWalk}><NavigationArrow weight="fill" aria-hidden="true" /><span>Начать прогулку</span></button>
        <button type="button" className="production-route-plan" data-route-action="plan" onClick={startPlanning}><PencilSimple weight="regular" aria-hidden="true" /><span>Маршрут</span></button>
        <button type="button" className="production-route-risk" data-route-action="risk" onClick={startRisk}><ShieldWarning weight="regular" aria-hidden="true" /><span>Опасность</span></button>
      </section>
      <button className="map-duration-toggle" type="button" aria-expanded={durationOpen} onClick={()=>setDurationOpen(v=>!v)}>Прогулка по времени</button>
      {durationOpen&&<section className="map-duration-planner"><p>Начало — центр карты. Можно передвинуть карту, найти адрес или нажать «Найти меня».</p><label>Сколько минут<input type="number" min="5" max="180" step="5" value={wantedMinutes} onChange={e=>{setWantedMinutes(Number(e.target.value));setDurationResult(undefined);}} /></label><button type="button" onClick={()=>setDurationResult(findDurationWalk(recordedRoutes,mapCenter,wantedMinutes))}>Подобрать записанный круг</button>{durationResult===null&&<p role="status">Подходящего записанного круга у выбранного начала нет. Выберите другую область или постройте маршрут вручную.</p>}{durationResult&&<div role="status"><b>{durationResult.route.title}</b><p>Около {durationResult.estimatedMinutes} мин пешком без остановок · начало в {durationResult.startMeters} м от центра. Вариант из прошлой прогулки; оценка рассчитана для 4 км/ч, это не проверка текущей проходимости.</p><button type="button" disabled={routeFlow!=='idle'} onClick={()=>{onReuseRoute?.(durationResult.route.id);setDurationOpen(false);}}>Посмотреть и изменить</button></div>}</section>}
      </div>
      <div hidden={workspaceTab!=='saved'}>
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
      </div>
    </section>}
    </div>
  </section>;
}
