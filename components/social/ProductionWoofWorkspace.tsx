'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ClockCountdown, Crosshair, Funnel, PawPrint, ShieldCheck, UsersThree, X } from '@phosphor-icons/react';
import type { CandidateGroup, CoarseLocation, SocialCandidate, SocialProfile, SocialScenario, WalkPace, WalkSignal } from '@/lib/socialCore';
import type { SocialRequestView } from './RequestsPanel';
import { RequestsPanel } from './RequestsPanel';
import { SocialProfileSheet } from './SocialProfileSheet';
import { GavDialog } from './GavDialog';
import { MeetingPlacePanel } from './MeetingPlacePanel';
import type { OwnerRouteView } from '@/lib/mapUi';
import { WoofLiveMap } from './WoofLiveMap';
import { CandidateDeck, CandidatePhoto } from './CandidateDeck';

type SignalDraft = { startsAt: string; pace: WalkPace; note: string; location: CoarseLocation };
type IncomingInvite = { petName: string | null; expiresAt: string };
export type WoofRecommendationEntry = {
  key: string;
  view: 'live_signal' | 'requests' | 'give_signal';
  targetId?: string;
};

type Props = {
  petId: string;
  error?: string;
  accessMessage?: string;
  routes:OwnerRouteView[];
  authHeaders:()=>Record<string,string>;
  dogName: string;
  avatar: ReactNode;
  profile: SocialProfile | null;
  signals: WalkSignal[];
  viewerLocation: CoarseLocation | null;
  viewerRadiusKm: number;
  viewerRadiusMeters: number;
  signalReason: string;
  candidates: CandidateGroup;
  requests: SocialRequestView[];
  state: 'idle' | 'loading' | 'ready' | 'error';
  busyId: string | null;
  locating: boolean;
  missingTelegramUsernameAction?: string | null;
  invite: IncomingInvite | null;
  inviteState: 'idle' | 'loading' | 'ready' | 'gone' | 'error';
  recommendationEntry?: WoofRecommendationEntry | null;
  onAcceptInvite: () => void | Promise<boolean | void>;
  onDismissInvite: () => void;
  onSaveProfile: (draft: Omit<SocialProfile, 'petId'>) => Promise<boolean>;
  result?: string;
  onHideProfile: () => void | Promise<boolean | void>;
  onLocateProfile: (ready: (location: CoarseLocation) => void) => void;
  onLocateViewer: () => void;
  onChooseViewerLocation: (location: CoarseLocation) => void;
  onChangeViewerRadius: (radiusKm: number) => void;
  onSaveSignal: (draft: SignalDraft) => Promise<boolean>;
  onCloseSignal: (status: 'completed' | 'cancelled') => void | Promise<boolean | void>;
  onRequest: (petId: string, scenario: SocialScenario, signalId?: string) => void | Promise<boolean | void>;
  onUpdateRequest: (id: string, action: 'accept' | 'reject' | 'cancel' | 'close' | 'block') => void | Promise<boolean | void>;
  onReport: (id: string, reason: string) => Promise<boolean>;
  onOpenContact: (url: string) => void;
  onRefresh: () => void | Promise<boolean | void>;
  onRetry: () => void | Promise<boolean | void>;
};

const paceCopy: Record<WalkPace, string> = { calm: 'Спокойно', balanced: 'Обычный темп', active: 'Активно' };
const traitCopy: Record<string, string> = {
  puppy: 'щенок', adult: 'взрослая', senior: 'старшая', calm: 'спокойная', balanced: 'уравновешенная',
  active: 'активная', friendly: 'дружелюбна к собакам', selective: 'выбирает компанию', cautious: 'нужно знакомиться мягко',
};

function readable(value: string | null | undefined) {
  if (!value) return null;
  return traitCopy[value] || value.replaceAll('_', ' ');
}

function timeLabel(value: string) {
  const date = new Date(value);
  const today = date.toDateString() === new Date().toDateString();
  return `${today ? 'Сегодня' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

function DogPortrait({ candidate }: { candidate: Pick<SocialCandidate, 'name' | 'avatarUrl'> }) {
  return <span className="woof-card-avatar"><CandidatePhoto src={candidate.avatarUrl} name={candidate.name}/></span>;
}

function CandidateProfile({ candidate, busy, onClose, onRequest }: {
  candidate: SocialCandidate;
  busy: boolean;
  onClose: () => void;
  onRequest: () => void;
}) {
  const traits = [readable(candidate.lifeStage), candidate.weightKg ? `${candidate.weightKg} кг` : null, readable(candidate.temperament), readable(candidate.energyLevel), readable(candidate.dogFriendly), readable(candidate.playStyle)].filter(Boolean);
  return <section className="woof-profile-sheet" role="dialog" aria-modal="true" aria-labelledby="woof-profile-title">
    <button className="woof-sheet-close" type="button" onClick={onClose} aria-label="Закрыть анкету"><X /></button>
    <div className="woof-profile-portrait"><DogPortrait candidate={candidate} /></div>
    <p className="woof-kicker">знакомство</p>
    <h2 id="woof-profile-title">{candidate.name}</h2>
    <p className="woof-profile-place">{candidate.district || 'Ваш город'}{candidate.distance ? ` · ${candidate.distance}` : ''}</p>
    <div className="woof-traits">{traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
    <div className="woof-profile-story">
      <h3>Почему можно познакомиться</h3>
      <ul>{candidate.reasons.map((reason) => <li key={reason}><Check weight="bold" />{reason}</li>)}</ul>
      <p>Контакт откроется только после взаимного согласия. Для первой встречи выбирайте публичное место.</p>
    </div>
    <button className="woof-primary" type="button" disabled={busy} onClick={onRequest}>{busy ? 'Отправляю…' : 'Хочу познакомиться'}</button>
  </section>;
}

export function ProductionWoofWorkspace(props: Props) {
  const [mode, setMode] = useState<'live' | 'meet'>('live');
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(
    props.recommendationEntry?.view === 'live_signal' ? props.recommendationEntry.targetId ?? null : null,
  );
  const [signalComposer, setSignalComposer] = useState(props.recommendationEntry?.view === 'give_signal');
  const [profileEditor, setProfileEditor] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [browsedCandidateId,setBrowsedCandidateId]=useState<string|null>(null);
  const [chosenRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [awaitingPartner, setAwaitingPartner] = useState<string | null>(null);
  const selectedRequestId = chosenRequestId || (awaitingPartner ? props.requests.find(r => (r.status === 'pending' || r.status === 'accepted') && (r.senderPetId === awaitingPartner || r.recipientPetId === awaitingPartner))?.id : null) || null;
  const [requestsOpen, setRequestsOpen] = useState(props.recommendationEntry?.view === 'requests');
  const [manualArea, setManualArea] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapPanel, setMapPanel] = useState<'selection' | 'list' | 'tools'>('selection');
  const [liveMapState, setLiveMapState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [areaQuery, setAreaQuery] = useState('');
  const [areaLocateAttempted,setAreaLocateAttempted]=useState(false);
  const areaLocateError=areaLocateAttempted&&!props.locating&&!props.viewerLocation?'Не удалось определить район. Можно указать его вручную.':'';
  const [areaResults, setAreaResults] = useState<Array<{id:string;title:string;detail?:string;point:CoarseLocation}>>([]);
  const [areaState, setAreaState] = useState<'idle'|'loading'|'error'|'ready'>('idle');
  const areaSearchRef = useRef<AbortController|null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setClockNow(Date.now()), 12000); return () => window.clearInterval(timer); }, []);
  const [liveWhen, setLiveWhen] = useState<'all' | 'now' | 'later'>('all');
  const [livePace, setLivePace] = useState<'all' | WalkPace>('all');
  const [meetRadius, setMeetRadius] = useState<'5' | '10' | '15' | 'city'>('city');
  const [meetScenario, setMeetScenario] = useState<'all' | SocialScenario>('all');
  const [meetLifeStage, setMeetLifeStage] = useState<'all' | 'puppy' | 'adult' | 'senior'>('all');
  const [meetEnergy, setMeetEnergy] = useState<'all' | 'calm' | 'balanced' | 'active'>('all');
  const [pace, setPace] = useState<WalkPace>('balanced');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [laterTime, setLaterTime] = useState('19:00');
  const [note, setNote] = useState('');
  const [location, setLocation] = useState<CoarseLocation | null>(props.profile?.coarseLocation ?? null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const signalDraftRef = useRef<SignalDraft | null>(null);
  const [viewHydrated, setViewHydrated] = useState(false);
  const viewKey = `pso.gav.view.v1:${props.petId}`;
  const feedRef = useRef<HTMLElement|null>(null);
  useEffect(()=>{
    if(!viewHydrated||mode!=='meet'||!feedRef.current)return;
    try {feedRef.current.scrollTop=Math.max(0,Number(sessionStorage.getItem(`${viewKey}:scroll`))||0);} catch { /* preference only */ }
  },[mode,viewHydrated,viewKey]);
  useEffect(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem(viewKey) || 'null');
      if (v) {
        if (['live','meet'].includes(v.mode)) setMode(v.mode);
        if (['all','now','later'].includes(v.liveWhen)) setLiveWhen(v.liveWhen);
        if (['all','calm','balanced','active'].includes(v.livePace)) setLivePace(v.livePace);
        if (['5','10','15','city'].includes(v.meetRadius)) setMeetRadius(v.meetRadius);
        if (['all','meet','walk','socialize','mating'].includes(v.meetScenario)) setMeetScenario(v.meetScenario);
        if (['all','puppy','adult','senior'].includes(v.meetLifeStage)) setMeetLifeStage(v.meetLifeStage);
        if (['all','calm','balanced','active'].includes(v.meetEnergy)) setMeetEnergy(v.meetEnergy);
        if (typeof v.note==='string') setNote(v.note);
        if(typeof v.browsedCandidateId==='string')setBrowsedCandidateId(v.browsedCandidateId);
        if (['now','later'].includes(v.when)) setWhen(v.when);
        if (typeof v.laterTime==='string') setLaterTime(v.laterTime);
        if (['calm','balanced','active'].includes(v.pace)) setPace(v.pace);
      }
    } catch { /* A missing local preference does not block live data. */ }
    setViewHydrated(true);
    return () => areaSearchRef.current?.abort();
  }, [viewKey]);
  useEffect(() => {
    if (!viewHydrated) return;
    try {sessionStorage.setItem(viewKey,JSON.stringify({mode,liveWhen,livePace,meetRadius,meetScenario,meetLifeStage,meetEnergy,note,when,laterTime,pace,browsedCandidateId}));} catch { /* Retain live state. */ }
  }, [viewHydrated,viewKey,mode,liveWhen,livePace,meetRadius,meetScenario,meetLifeStage,meetEnergy,note,when,laterTime,pace,browsedCandidateId]);
  const composerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const composerRef = useRef<HTMLElement | null>(null);
  const profileOverlayRef = useRef<HTMLDivElement | null>(null);
  const candidateOverlayRef = useRef<HTMLDivElement | null>(null);
  const requestsOverlayRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const refreshRef = useRef(props.onRefresh);
  const activePartnerIds = useMemo(() => new Set(props.requests.flatMap((request) => {
    if (request.status !== 'pending' && request.status !== 'accepted') return [];
    const mine = props.petId;
    return request.senderPetId === mine ? [request.recipientPetId] : request.recipientPetId === mine ? [request.senderPetId] : [];
  })), [props.petId, props.requests]);
  const allCandidates = useMemo(() => {
    const unique = new Map<string, SocialCandidate>();
    for (const candidate of [...props.candidates.nearby, ...props.candidates.city]) {
      if (!unique.has(candidate.petId) && !activePartnerIds.has(candidate.petId)) unique.set(candidate.petId, candidate);
    }
    return [...unique.values()];
  }, [activePartnerIds, props.candidates]);
  const filteredCandidates = useMemo(() => allCandidates.filter((candidate) => {
    const insideRadius = meetRadius === 'city'
      || (meetRadius === '15' && candidate.distance !== null)
      || (meetRadius === '10' && (candidate.distance === 'до 5 км' || candidate.distance === '5–10 км'))
      || (meetRadius === '5' && candidate.distance === 'до 5 км');
    const matchesScenario = meetScenario === 'all' || candidate.sharedScenarios.includes(meetScenario);
    const matchesLifeStage = meetLifeStage === 'all' || candidate.lifeStage === meetLifeStage;
    const matchesEnergy = meetEnergy === 'all' || candidate.energyLevel === meetEnergy;
    return insideRadius && matchesScenario && matchesLifeStage && matchesEnergy;
  }), [allCandidates, meetEnergy, meetLifeStage, meetRadius, meetScenario]);
  const filteredLiveSignals = useMemo(() => {
    const nowBoundary = clockNow + 30 * 60_000;
    return props.signals.filter((signal) => signal.isMine || ((livePace === 'all' || signal.pace === livePace)
      && (liveWhen === 'all' || (liveWhen === 'now' ? Date.parse(signal.startsAt) <= nowBoundary : Date.parse(signal.startsAt) > nowBoundary))));
  }, [clockNow, livePace, liveWhen, props.signals]);
  const selectedSignal = filteredLiveSignals.find((signal) => signal.id === selectedSignalId)
    || filteredLiveSignals.find((signal) => !signal.isMine)
    || filteredLiveSignals.find((signal) => signal.isMine)
    || null;
  const ownSignal = props.signals.find((signal) => signal.isMine) || null;
  const selectedCandidate = allCandidates.find((candidate) => candidate.petId === selectedCandidateId) || null;
  const activeModal = signalComposer ? 'composer' : profileEditor ? 'profile' : selectedCandidate ? 'candidate' : requestsOpen ? 'requests' : null;

  useEffect(() => {
    const signalLocation = ownSignal?.approximateLocation ?? props.viewerLocation;
    if (signalLocation && (!signalComposer || !location)) setLocation(signalLocation);
  }, [props.viewerLocation, ownSignal, signalComposer, location]);

  useEffect(() => { refreshRef.current = props.onRefresh; }, [props.onRefresh]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      Promise.resolve(refreshRef.current()).catch(() => undefined);
    };
    const timer = window.setInterval(refreshIfVisible, 12_000);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, []);

  const selectedRequest = props.requests.find(r => r.id === selectedRequestId);
  const activeRequests = props.requests.filter(r => r.status === 'pending' || r.status === 'accepted');
  function openRequests(id: string | null = null) { setAwaitingPartner(null); setSelectedRequestId(id); setRequestsOpen(true); }
  async function respond(candidateId: string, scenario: SocialScenario, signalId?: string) {
    const existing = activeRequests.find(r => r.senderPetId === candidateId || r.recipientPetId === candidateId);
    if (existing) { openRequests(existing.id); return true; }
    const saved = await props.onRequest(candidateId, scenario, signalId);
    if (saved) { openRequests(); setAwaitingPartner(candidateId); }
    return saved;
  }
  useEffect(() => {
    if (!activeModal) return;
    const step = activeModal === 'requests' ? `requests:${selectedRequestId || ''}` : activeModal;
    if (window.history.state?.gavOverlay === step) return;
    if (activeModal === 'requests' && selectedRequestId && !String(window.history.state?.gavOverlay || '').startsWith('requests:')) window.history.pushState({...window.history.state,gavOverlay:'requests:'}, '', window.location.href);
    window.history.pushState({...window.history.state,gavOverlay:step}, '', window.location.href);
  }, [activeModal, selectedRequestId]);
  useEffect(() => {
    const back = () => {
      const step = String(window.history.state?.gavOverlay || '');
      setAwaitingPartner(null);
      setSignalComposer(step === 'composer'); setProfileEditor(step === 'profile'); setSelectedCandidateId(null);
      setRequestsOpen(step.startsWith('requests:')); setSelectedRequestId(step.startsWith('requests:') ? step.slice(9) || null : null);
    };
    window.addEventListener('popstate', back); return () => window.removeEventListener('popstate', back);
  }, []);
  function openSignalComposer() {
    if (ownSignal && !note) {
      setPace(ownSignal.pace);setNote(ownSignal.note || '');
      const date = new Date(ownSignal.startsAt);
      if (date.getTime()>Date.now()) {setWhen('later');setLaterTime(`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`);}
    }
    setSignalComposer(true);
  }
  async function findArea() {
    areaSearchRef.current?.abort(); const controller = new AbortController();areaSearchRef.current=controller;
    setAreaState('loading');setAreaResults([]);
    const center=props.profile?.city==='saint_petersburg'?{lat:59.9386,lng:30.3141}:{lat:55.7512,lng:37.6184};
    try {
      const response=await fetch(`/api/map/search?${new URLSearchParams({q:areaQuery,lat:String(center.lat),lng:String(center.lng)})}`,{signal:controller.signal});
      const payload=await response.json();if(controller.signal.aborted)return;
      if(!response.ok){setAreaState('error');return;}
      setAreaResults(Array.isArray(payload.results)?payload.results:[]);setAreaState('ready');
    } catch {if(!controller.signal.aborted)setAreaState('error');}
  }
  function closeActiveModal() {
    if (window.history.state?.gavOverlay) window.history.go(activeModal === 'requests' && selectedRequestId ? -2 : -1);
    setAwaitingPartner(null); setSignalComposer(false); setProfileEditor(false); setSelectedCandidateId(null); setRequestsOpen(false); setSelectedRequestId(null);
  }
  function backToRequests() {
    if (selectedRequestId) window.history.back(); else closeActiveModal();
  }

  useEffect(() => {
    if (!activeModal) return;
    if(document.activeElement instanceof HTMLElement && rootRef.current?.contains(document.activeElement) && document.activeElement !== document.body) restoreFocusRef.current = document.activeElement;
    const dialog = activeModal === 'composer' ? composerRef.current
      : activeModal === 'profile' ? profileOverlayRef.current
        : activeModal === 'candidate' ? candidateOverlayRef.current
          : requestsOverlayRef.current;
    if (!dialog) return;
    const siblings = Array.from(rootRef.current?.children || []).filter((child) => child !== dialog);
    siblings.forEach((child) => { if (child instanceof HTMLElement) child.inert = true; });
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    controls[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') return; // Native dialog owns dismissal.
      const currentControls = Array.from(dialog!.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(el => el.getClientRects().length);
      if (event.key !== 'Tab' || currentControls.length === 0) return;
      const first = currentControls[0];
      const last = currentControls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      siblings.forEach((child) => { if (child instanceof HTMLElement) child.inert = false; });
      restoreFocusRef.current?.focus();
    };
  }, [activeModal]);

  function locateSignal() {
    setLocationError('');
    if (!navigator.geolocation) { setLocationError('Геолокация недоступна. Выберите район вручную в поиске.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      signalDraftRef.current = null;
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocating(false);
    }, () => { setLocating(false); setLocationError('Не удалось определить район. Ввод сохранён, можно повторить.'); }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 });
  }

  function startsAt() {
    const now = new Date();
    if (when === 'now') return now.toISOString();
    const [hours, minutes] = laterTime.split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);
    if (next.getTime() < now.getTime() - 15 * 60_000) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  async function submitSignal() {
    if (!location) return;
    if (!signalDraftRef.current) signalDraftRef.current = { startsAt: startsAt(), pace, note, location };
    const confirmed = await props.onSaveSignal(signalDraftRef.current);
    if (confirmed) { signalDraftRef.current = null; closeActiveModal(); setNote(''); }
  }

  function refreshMeetLocation() {
    if (!props.profile) {
      setProfileEditor(true);
      return;
    }
    props.onLocateProfile((nextLocation) => {
      Promise.resolve(props.onSaveProfile({ ...props.profile!, coarseLocation: nextLocation })).catch(() => undefined);
    });
  }

  useEffect(()=>{if(manualArea)rootRef.current?.querySelector<HTMLInputElement>('.woof-manual-area input')?.focus();},[manualArea]);
  const needsArea=mode==='live'&&!props.viewerLocation&&props.signalReason!=='CITY_NOT_SUPPORTED';
  const manualAreaForm=<section className="woof-manual-area" aria-label="Выбор района">
    <label>Город, район или место<input autoComplete="off" value={areaQuery} placeholder="Например, Сокол, Москва" onChange={e=>setAreaQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void findArea();}} /></label>
    <button type="button" disabled={areaQuery.trim().length<2||areaState==='loading'} onClick={findArea}>{areaState==='loading'?'Ищу…':'Найти район'}</button>
    <p role="status">{areaState==='loading'?'Ищу район…':areaState==='error'?'Поиск не ответил. Попробуйте ещё раз — название сохранилось.':areaState==='ready'&&!areaResults.length?'Не нашли это место. Добавьте город или уточните название.':''}</p>
    {areaResults.map(result=><button type="button" key={result.id} onClick={()=>{props.onChooseViewerLocation(result.point);signalDraftRef.current=null;setLocation(result.point);setManualArea(false);}}>{result.title}{result.detail?` · ${result.detail}`:''}</button>)}
  </section>;

  return <section ref={rootRef} onClickCapture={event=>{if(!activeModal){const button=(event.target as HTMLElement).closest<HTMLElement>("button");if(button)restoreFocusRef.current=button;}}} className="production-woof-workspace" data-view-mode={mode} data-map-state={liveMapState} data-map-expanded={mapExpanded} data-map-panel={mapPanel} data-needs-area={needsArea} data-production-journey="nearby" data-direction="alive-map-not-feed; approximate-location; live-signal-and-persistent-profile; no-dating-cliches">
    <div className="woof-map-layer" hidden={needsArea} aria-hidden={mode !== 'live'||needsArea}>
      {props.viewerLocation && mode === 'live' ? <WoofLiveMap expanded={mapExpanded} onToggleExpanded={()=>setMapExpanded(v=>!v)} searching={props.state==='loading'} onSearchHere={props.onChooseViewerLocation} onMapState={setLiveMapState} signals={filteredLiveSignals} viewerLocation={props.viewerLocation} viewerRadiusMeters={props.viewerRadiusMeters} selectedId={selectedSignal?.id ?? null} onSelect={(id) => {setSelectedSignalId(id);setMapPanel('selection');}} />
        : <div className="woof-map-await" aria-hidden="true" />}
    </div>

    <header className="woof-topbar">
      <div className="woof-mode-switch" aria-label="Режим Гав">
        <button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')}>Сейчас рядом</button>
        <button type="button" aria-pressed={mode === 'meet'} onClick={() => setMode('meet')}>Знакомства</button>
      </div>
      <button type="button" onClick={() => openRequests()} aria-label={`Отклики и связи: ${activeRequests.length}`}><UsersThree /><span className="woof-requests-label">Отклики и связи</span>{activeRequests.length > 0 && <span>{activeRequests.length}</span>}</button>
    </header>

    {props.result && !activeModal && <p className="woof-action-result" role="status">{props.result}</p>}
    {props.error && !activeModal && !needsArea && <p className="woof-action-error" role="alert">{props.error}</p>}

    {!activeModal && activeRequests.length > 0 && <div className="gav-resume-connection"><button type="button" onClick={() => openRequests(activeRequests.length === 1 ? activeRequests[0].id : null)}>{activeRequests.some(r => r.status === 'pending' && r.recipientPetId === props.petId) ? 'Вас зовут — посмотреть отклики' : activeRequests.some(r => r.status === 'accepted') ? 'Продолжить знакомство' : 'Ваши отклики — ждём ответа'}<span aria-hidden="true"> →</span></button></div>}

    {props.inviteState !== 'idle' && <aside className={`woof-incoming-invite state-${props.inviteState}`} aria-live="polite" role={props.inviteState === 'error' ? 'alert' : 'status'}>
      <div>
        <b>{props.inviteState === 'loading' ? 'Открываю приглашение…' : props.inviteState === 'gone' ? 'Приглашение уже закрыто' : props.inviteState === 'error' ? 'Не получилось открыть приглашение' : props.invite?.petName ? `${props.invite.petName} зовёт познакомиться` : 'Вас зовут познакомить собак'}</b>
        <p>{props.inviteState === 'ready' ? 'После принятия владельцу придёт запрос. Контакт откроется только после взаимного согласия.' : props.inviteState === 'gone' ? 'Попросите друга отправить новую ссылку.' : props.inviteState === 'error' ? 'Проверьте соединение или закройте приглашение.' : 'Проверяю срок и владельца ссылки.'}</p>
      </div>
      {props.inviteState === 'ready' && <button className="woof-primary" type="button" disabled={props.busyId === 'incoming-invite'} onClick={() => props.onAcceptInvite()}>{props.busyId === 'incoming-invite' ? 'Принимаю…' : 'Принять'}</button>}
      {props.inviteState !== 'loading' && <button type="button" onClick={props.onDismissInvite}>{props.inviteState === 'ready' ? 'Отклонить' : 'Закрыть'}</button>}
    </aside>}

    {needsArea&&<main className="woof-welcome">
      <div className="woof-welcome-symbol"><PawPrint weight="duotone" aria-hidden="true"/></div>
      <h1>{manualArea?'Где будем гулять?':'С кем пойдём гулять?'}</h1>
      <p>{manualArea?'Найдите привычное место для прогулок.':'Выберите район — посмотрим, кто ищет компанию рядом.'}</p>
      {manualArea?<>{manualAreaForm}<button type="button" className="woof-welcome-back" onClick={()=>setManualArea(false)}>Назад</button></>:<div className="woof-welcome-actions">
        <button type="button" className="woof-welcome-locate" onClick={()=>{setAreaLocateAttempted(true);props.onLocateViewer();}} disabled={props.locating}><Crosshair aria-hidden="true"/>{props.locating?'Определяю район…':'Найти рядом со мной'}</button>
        <button type="button" className="woof-welcome-manual" onClick={()=>setManualArea(true)}>Указать район</button>
      </div>}
      {areaLocateError&&!manualArea&&<p className="woof-welcome-error" role="alert">{areaLocateError}</p>}
      {props.error&&<p className="woof-welcome-error" role="alert">{props.error}</p>}
      <small className="woof-welcome-privacy"><ShieldCheck aria-hidden="true"/>Точное местоположение другим не показываем.</small>
      {props.accessMessage&&<p className="woof-welcome-access">Карту можно посмотреть без входа. Для откликов нужен вход через Telegram.</p>}
    </main>}
    {mode === 'live' && !needsArea && <div className="woof-work-area">
      {mapExpanded && <div className="woof-expanded-tools"><button type="button" aria-pressed={mapPanel==='list'} onClick={()=>setMapPanel(v=>v==='list'?'selection':'list')}>Список · {filteredLiveSignals.length}</button><button type="button" aria-pressed={mapPanel==='tools'} onClick={()=>setMapPanel(v=>v==='tools'?'selection':'tools')}>Район и фильтры</button></div>}
      <div className="woof-search-panel">
        <h1 className="sr-only">Компания для прогулки</h1>
        <div className="woof-live-tools">
          <button type="button" className="woof-area-change" onClick={()=>setManualArea(v=>!v)} aria-label="Выбрать район вручную" aria-expanded={manualArea}><Crosshair aria-hidden="true"/>Район</button>
          <details className="woof-live-filter-disclosure" open={mapExpanded && mapPanel==='tools' ? true : undefined}><summary><Funnel aria-hidden="true"/>{props.viewerRadiusKm} км · фильтры{liveWhen!=='all'||livePace!=='all'?' · выбраны':''}</summary><section className="woof-live-filters" aria-label="Фильтры поиска на карте">
            <label><span>Радиус</span><select value={String(props.viewerRadiusKm)} onChange={(event) => props.onChangeViewerRadius(Number(event.target.value))}><option value="3">3 км</option><option value="5">5 км</option><option value="10">10 км</option><option value="15">15 км</option></select></label>
            <label><span>Когда</span><select value={liveWhen} onChange={(event) => setLiveWhen(event.target.value as typeof liveWhen)}><option value="all">Любое</option><option value="now">Сейчас</option><option value="later">Позже</option></select></label>
            <label><span>Темп</span><select value={livePace} onChange={(event) => setLivePace(event.target.value as typeof livePace)}><option value="all">Любой</option><option value="calm">Спокойно</option><option value="balanced">Обычный</option><option value="active">Активно</option></select></label>
            <button type="button" onClick={props.onLocateViewer} disabled={props.locating}><Crosshair />{props.locating ? 'Определяю район…' : 'Обновить местоположение'}</button>
          </section></details>
        </div>
        {manualArea && <>{manualAreaForm}<button className="woof-area-done" type="button" onClick={()=>setManualArea(false)}>Закрыть выбор района</button></>}
        {(props.locating || props.state === 'loading') && <p className="woof-live-heading" role="status">Обновляю Гав рядом…</p>}
        {(filteredLiveSignals.length > 1 || (mapExpanded && mapPanel==='list')) && <div className="woof-signal-picker" aria-label="Гав рядом">{filteredLiveSignals.length===0 && <p>В этой области пока нет Гав.</p>}{filteredLiveSignals.map(signal=><button type="button" key={signal.id} aria-pressed={selectedSignal?.id===signal.id} onClick={()=>{setSelectedSignalId(signal.id);setMapPanel('selection');}}>{signal.name}{signal.isMine?' · ваш Гав':''}</button>)}</div>}
      </div>
      {selectedSignal && <article className="woof-signal-card" aria-live="polite">
        <div className="woof-signal-main">
          <DogPortrait candidate={{ name: selectedSignal.name, avatarUrl: selectedSignal.avatarUrl }} />
          <div><p><b>{selectedSignal.name}</b>{selectedSignal.isMine ? ' · ваш Гав' : ''}</p><span>{selectedSignal.isMine ? `До ${new Date(selectedSignal.expiresAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}` : timeLabel(selectedSignal.startsAt)} · {paceCopy[selectedSignal.pace]}</span></div>
        </div>
        {selectedSignal.note && <p className="woof-signal-note">«{selectedSignal.note}»</p>}
        <p className="woof-location-copy"><ShieldCheck />Точное место скрыто</p>
        {selectedSignal.isMine ? <div className="woof-signal-actions">
          <button ref={composerTriggerRef} className="woof-primary" type="button" onClick={openSignalComposer}>Изменить Гав</button>
          <button type="button" disabled={props.busyId === 'signal'} onClick={() => props.onCloseSignal('completed')}>Завершить</button>
        </div> : <button className="woof-primary" type="button" disabled={props.busyId === selectedSignal.petId} onClick={() => respond(selectedSignal.petId, 'walk', selectedSignal.id)}>{activeRequests.some(r => r.senderPetId === selectedSignal.petId || r.recipientPetId === selectedSignal.petId) ? 'Продолжить знакомство' : 'Откликнуться'}</button>}
      </article>}
      {selectedSignal?.isMine && props.state === 'ready' && !filteredLiveSignals.some(signal=>!signal.isMine) && <div className="woof-waiting-company"><p>{props.signals.some(signal=>!signal.isMine) ? 'Под эти фильтры других Гав нет.' : 'Рядом пока никто не дал Гав. Ваш уже виден другим.'}</p><button type="button" onClick={()=>setMode('meet')}>Посмотреть анкеты</button></div>}
      {props.accessMessage ? <article className="woof-empty-live woof-access-state" role="status"><PawPrint /><b>Познакомимся в Telegram</b><p>{props.accessMessage}</p></article> : props.state === 'error' ? <article className="woof-empty-live woof-error-state" role="alert"><PawPrint /><b>Район не загрузился</b><p>Проверьте соединение — Псё не будет выдавать ошибку за отсутствие собак.</p><button type="button" onClick={() => props.onRetry()}>Повторить</button></article>
        : props.signalReason === 'CITY_NOT_SUPPORTED' ? <article className="woof-empty-live"><PawPrint /><b>Здесь Гав ещё не работает</b><p>Сейчас живые сигналы доступны в Москве и Санкт-Петербурге.</p></article>
          : props.signalReason === 'VIEWER_LOCATION_REQUIRED' ? <article className="woof-empty-live woof-location-state"><Crosshair /><b>Покажите район рядом</b><p>Точная точка не сохраняется — для поиска используется округлённая зона.</p><button type="button" onClick={props.onLocateViewer} disabled={props.locating}>{props.locating ? 'Определяю…' : 'Показать рядом'}</button></article>
            : !selectedSignal && props.state !== 'loading' && <article className="woof-empty-live"><PawPrint /><b>{props.signals.some((signal) => !signal.isMine) ? 'Под эти фильтры пока тихо' : `В радиусе ${props.viewerRadiusKm} км пока тихо`}</b><p>{props.signals.some((signal) => !signal.isMine) ? 'Выберите любое время и темп или расширьте радиус.' : 'Ваш Гав станет первой живой точкой района.'}</p>{props.signals.some((signal) => !signal.isMine) && <button type="button" onClick={() => { setLiveWhen('all'); setLivePace('all'); props.onChangeViewerRadius(15); }}>Показать всех</button>}</article>}
      {!props.accessMessage && props.signalReason !== 'CITY_NOT_SUPPORTED' && !selectedSignal?.isMine && <button ref={composerTriggerRef} className="woof-give-button" type="button" onClick={openSignalComposer}>{ownSignal ? 'Изменить Гав' : 'Дать Гав'}<PawPrint weight="fill" /></button>}
    </div>}

    {mode === 'meet' && <main ref={feedRef} onScroll={event=>{try{sessionStorage.setItem(`${viewKey}:scroll`,String(event.currentTarget.scrollTop));}catch{/* preference only */}}} className="woof-meet-feed">
      <div className="woof-meet-intro"><h1 className="sr-only">Знакомства</h1></div>
      <div className="woof-meet-tools">
        <button type="button" aria-expanded={filtersOpen} aria-controls="woof-meet-filters" onClick={() => setFiltersOpen((value) => !value)}><Funnel />{filtersOpen ? 'Свернуть фильтры' : 'Показать фильтры'}</button>
        <button type="button" onClick={refreshMeetLocation} disabled={props.locating}><Crosshair />{props.locating ? 'Определяю…' : props.profile?.coarseLocation ? 'Обновить район' : 'Искать рядом'}</button>
        <button type="button" onClick={() => setProfileEditor(true)}>{props.profile?.discoverable ? 'Моя анкета' : 'Создать анкету'}</button>
      </div>
      {!filtersOpen && <p className="woof-filter-summary">{meetRadius==='city'?'Весь город':`До ${meetRadius} км`} · {meetScenario==='all'?'Все цели':({meet:'Знакомство',walk:'Прогулка',socialize:'Социализация',mating:'Случка'}[meetScenario])} · {meetLifeStage==='all'?'Любой возраст':readable(meetLifeStage)} · {meetEnergy==='all'?'Любой ритм':readable(meetEnergy)}</p>}
      {filtersOpen && <section id="woof-meet-filters" className="woof-meet-filters" aria-label="Фильтры знакомств">
        <label><span>Область поиска</span><select value={meetRadius} onChange={(event) => setMeetRadius(event.target.value as typeof meetRadius)}><option value="5">До 5 км</option><option value="10">До 10 км</option><option value="15">До 15 км</option><option value="city">Весь город</option></select></label>
        <label><span>Цель</span><select value={meetScenario} onChange={(event) => setMeetScenario(event.target.value as typeof meetScenario)}><option value="all">Любая</option><option value="meet">Знакомство</option><option value="walk">Прогулка</option><option value="socialize">Социализация</option><option value="mating">Случка</option></select></label>
        <label><span>Возраст</span><select value={meetLifeStage} onChange={(event) => setMeetLifeStage(event.target.value as typeof meetLifeStage)}><option value="all">Любой</option><option value="puppy">Щенок</option><option value="adult">Взрослая</option><option value="senior">Старшая</option></select></label>
        <label><span>Ритм</span><select value={meetEnergy} onChange={(event) => setMeetEnergy(event.target.value as typeof meetEnergy)}><option value="all">Любой</option><option value="calm">Спокойный</option><option value="balanced">Уравновешенный</option><option value="active">Активный</option></select></label>
        <p>{props.profile?.coarseLocation ? `Поиск считается от вашего примерного района. Точная точка не показывается.` : 'Разрешите геолокацию или укажите район в анкете — точная точка не сохраняется.'}</p>
        <button className="woof-primary" type="button" onClick={() => setFiltersOpen(false)}>Показать анкеты · {filteredCandidates.length}</button>
      </section>}
      {props.accessMessage ? <article className="woof-empty-meet" role="status"><PawPrint /><h2>Познакомимся в Telegram</h2><p>{props.accessMessage}</p></article> : props.state === 'error' ? <article className="woof-empty-meet" role="alert"><PawPrint /><h2>Анкеты не загрузились</h2><p>Это сбой соединения, а не пустой поиск.</p><button className="woof-primary" type="button" onClick={() => props.onRetry()}>Повторить</button></article>
      : props.state === 'loading' ? <p role="status">Обновляю анкеты…</p> : filteredCandidates.length > 0 ? <CandidateDeck candidates={filteredCandidates} selectedId={browsedCandidateId} onSelect={setBrowsedCandidateId} busyId={props.busyId} onRequest={respond} preferredScenario={meetScenario}/>  : <article className="woof-empty-meet"><PawPrint /><h2>{allCandidates.length ? 'Под эти фильтры никого нет' : props.profile?.discoverable ? 'Новые анкеты появятся здесь' : 'Сначала расскажите о собаке'}</h2><p>{allCandidates.length ? 'Расширьте радиус или уберите один из фильтров.' : props.profile?.discoverable ? 'Псё покажет только реальные анкеты вашего города.' : 'Характер и привычный ритм помогут найти подходящую компанию.'}</p>{allCandidates.length ? <button className="woof-primary" type="button" onClick={() => { setMeetRadius('city'); setMeetScenario('all'); setMeetLifeStage('all'); setMeetEnergy('all'); }}>Сбросить фильтры</button> : <button className="woof-primary" type="button" onClick={() => setProfileEditor(true)}>{props.profile?.discoverable ? 'Проверить мою анкету' : 'Создать анкету'}</button>}</article>}
    </main>}

    {signalComposer && <GavDialog label="Свой Гав" onClose={closeActiveModal}><section onChangeCapture={() => { signalDraftRef.current = null; }} ref={composerRef} className="woof-composer" role="dialog" aria-modal="true" aria-labelledby="woof-composer-title">
      <button className="woof-sheet-close" type="button" onClick={closeActiveModal} aria-label="Закрыть"><X /></button>
      <h2 id="woof-composer-title">Когда идём?</h2><p>{props.dogName} · {location ? props.profile?.district || "Выбранная примерная зона" : "Выберите район"}</p>
      {(props.error || locationError) && <p role="alert">{locationError || props.error}</p>}
      <div className="woof-choice-row"><button type="button" aria-pressed={when === 'now'} onClick={() => { signalDraftRef.current = null; setWhen('now'); }}>Сейчас</button><button type="button" aria-pressed={when === 'later'} onClick={() => { signalDraftRef.current = null; setWhen('later'); }}>Позже</button></div>
      {when === 'later' && <label className="woof-field"><span>Начало прогулки</span><input type="time" value={laterTime} onChange={(event) => setLaterTime(event.target.value)} /></label>}
      <fieldset className="woof-pace"><legend>Темп</legend>{(['calm', 'balanced', 'active'] as WalkPace[]).map((value) => <button type="button" key={value} aria-pressed={pace === value} onClick={() => { signalDraftRef.current = null; setPace(value); }}>{paceCopy[value]}</button>)}</fieldset>
      <label className="woof-field"><span>Короткая заметка <small>необязательно</small></span><textarea maxLength={180} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например: идём вокруг пруда" /></label>
      <button className="woof-location-button" type="button" onClick={locateSignal}><Crosshair />{locating ? 'Определяю примерную зону…' : location ? 'Примерная зона выбрана' : 'Выбрать район рядом со мной'}</button>
      <p className="woof-privacy"><ShieldCheck />На карте появится зона радиусом 700 м, а не ваша точка.</p>
      <p className="woof-expiry"><ClockCountdown />{when === 'now' ? 'Гав исчезнет автоматически через 2 часа.' : 'Гав исчезнет через 3 часа после выбранного времени.'}</p>
      <button className="woof-primary" type="button" disabled={!location || props.busyId === 'signal'} onClick={submitSignal}>{props.busyId === 'signal' ? 'Сохраняю…' : !location ? 'Сначала выберите район' : ownSignal ? 'Обновить Гав' : 'Дать Гав'}</button>
    </section></GavDialog>}

    {profileEditor && <GavDialog label="Моя анкета знакомства" onClose={closeActiveModal}><div ref={profileOverlayRef} className="woof-overlay" role="dialog" aria-modal="true" aria-label="Моя анкета знакомства"><button className="woof-overlay-x" type="button" onClick={closeActiveModal} aria-label="Закрыть"><X /></button>{props.error && <p role="alert">{props.error}</p>}<SocialProfileSheet petId={props.petId} dogName={props.dogName} profile={props.profile} busy={props.busyId === 'profile'} locating={props.locating} onSave={async draft => { const saved = await props.onSaveProfile(draft); if (saved && draft.discoverable) closeActiveModal(); return saved; }} onHide={props.onHideProfile} onLocate={props.onLocateProfile} /><button className="woof-overlay-close" type="button" onClick={closeActiveModal}>К анкетам</button></div></GavDialog>}
    {selectedCandidate && <div ref={candidateOverlayRef} className="woof-overlay" role="presentation">{props.error && <p role="alert">{props.error}</p>}<CandidateProfile candidate={selectedCandidate} busy={props.busyId === selectedCandidate.petId} onClose={() => setSelectedCandidateId(null)} onRequest={() => props.onRequest(selectedCandidate.petId, selectedCandidate.sharedScenarios[0] || 'meet')} /></div>}
    {requestsOpen && <GavDialog label={selectedRequest ? `Знакомство: ${selectedRequest.otherDog?.name || 'собака'}` : 'Отклики и связи'} onClose={closeActiveModal}><div ref={requestsOverlayRef} className="woof-overlay gav-relationship" role="dialog" aria-modal="true" aria-label="Отклики и связи"><button className="woof-overlay-x" type="button" onClick={closeActiveModal} aria-label="Закрыть"><X /></button>
      {props.error && <p role="alert">{props.error}</p>}
      <RequestsPanel key={selectedRequestId || 'list'} selectedId={selectedRequestId} onSelect={setSelectedRequestId} onBack={backToRequests} requests={props.requests} petId={props.petId} busyId={props.busyId} missingTelegramUsernameAction={props.missingTelegramUsernameAction ?? null} onAction={props.onUpdateRequest} onReport={props.onReport} onOpenChat={props.onOpenContact} onRefresh={() => props.onRefresh()}>
        {selectedRequest?.status === 'accepted' && <MeetingPlacePanel key={selectedRequest.id} requestId={selectedRequest.id} petId={props.petId} routes={props.routes} headers={props.authHeaders} center={props.viewerLocation || props.profile?.coarseLocation} partnerName={selectedRequest.otherDog?.name || 'собаки'} />}
      </RequestsPanel>
    </div></GavDialog>}
  </section>;
}
