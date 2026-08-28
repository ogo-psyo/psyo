'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, ClockCountdown, Crosshair, Funnel, PawPrint, ShieldCheck, UsersThree, X } from '@phosphor-icons/react';
import type { CandidateGroup, CoarseLocation, SocialCandidate, SocialProfile, SocialScenario, WalkPace, WalkSignal } from '@/lib/socialCore';
import type { SocialRequestView } from './RequestsPanel';
import { RequestsPanel } from './RequestsPanel';
import { SocialProfileSheet } from './SocialProfileSheet';
import { WoofLiveMap } from './WoofLiveMap';

type SignalDraft = { startsAt: string; pace: WalkPace; note: string; location: CoarseLocation };
type IncomingInvite = { petName: string | null; expiresAt: string };

type Props = {
  dogName: string;
  avatar: ReactNode;
  profile: SocialProfile | null;
  signals: WalkSignal[];
  viewerLocation: CoarseLocation | null;
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
  onAcceptInvite: () => void | Promise<void>;
  onDismissInvite: () => void;
  onSaveProfile: (draft: Omit<SocialProfile, 'petId'>) => void | Promise<void>;
  onHideProfile: () => void | Promise<void>;
  onLocateProfile: (ready: (location: CoarseLocation) => void) => void;
  onLocateViewer: () => void;
  onSaveSignal: (draft: SignalDraft) => void | Promise<void>;
  onCloseSignal: (status: 'completed' | 'cancelled') => void | Promise<void>;
  onRequest: (petId: string, scenario: SocialScenario, signalId?: string) => void | Promise<void>;
  onUpdateRequest: (id: string, action: 'accept' | 'reject' | 'cancel' | 'close' | 'block') => void | Promise<void>;
  onReport: (id: string, reason: string) => void | Promise<void>;
  onOpenContact: (url: string) => void;
  onRefresh: () => void | Promise<void>;
  onRetry: () => void | Promise<void>;
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
  return <span className="woof-card-avatar">{candidate.avatarUrl ? <img src={candidate.avatarUrl} alt="" /> : candidate.name.slice(0, 1)}</span>;
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
      <p>Контакт откроется только после взаимного согласия. Для первой встречи Псё предложит публичное место.</p>
    </div>
    <button className="woof-primary" type="button" disabled={busy} onClick={onRequest}>{busy ? 'Отправляю…' : 'Хочу познакомиться'}</button>
  </section>;
}

export function ProductionWoofWorkspace(props: Props) {
  const [mode, setMode] = useState<'live' | 'meet'>('meet');
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [signalComposer, setSignalComposer] = useState(false);
  const [profileEditor, setProfileEditor] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [meetRadius, setMeetRadius] = useState<'5' | '10' | '15' | 'city'>('15');
  const [meetScenario, setMeetScenario] = useState<'all' | SocialScenario>('all');
  const [meetLifeStage, setMeetLifeStage] = useState<'all' | 'puppy' | 'adult' | 'senior'>('all');
  const [meetEnergy, setMeetEnergy] = useState<'all' | 'calm' | 'balanced' | 'active'>('all');
  const [pace, setPace] = useState<WalkPace>('balanced');
  const [when, setWhen] = useState<'now' | 'later'>('now');
  const [laterTime, setLaterTime] = useState('19:00');
  const [note, setNote] = useState('');
  const [location, setLocation] = useState<CoarseLocation | null>(props.profile?.coarseLocation ?? null);
  const [locating, setLocating] = useState(false);
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
    const mine = props.profile?.petId;
    return request.senderPetId === mine ? [request.recipientPetId] : request.recipientPetId === mine ? [request.senderPetId] : [];
  })), [props.profile?.petId, props.requests]);
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
  const selectedSignal = props.signals.find((signal) => signal.id === selectedSignalId)
    || props.signals.find((signal) => !signal.isMine)
    || props.signals.find((signal) => signal.isMine)
    || null;
  const ownSignal = props.signals.find((signal) => signal.isMine) || null;
  const selectedCandidate = allCandidates.find((candidate) => candidate.petId === selectedCandidateId) || null;
  const activeModal = signalComposer ? 'composer' : profileEditor ? 'profile' : selectedCandidate ? 'candidate' : requestsOpen ? 'requests' : null;

  useEffect(() => {
    if (props.viewerLocation) setLocation(props.viewerLocation);
  }, [props.viewerLocation]);

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

  function closeActiveModal() {
    if (activeModal === 'composer') setSignalComposer(false);
    if (activeModal === 'profile') setProfileEditor(false);
    if (activeModal === 'candidate') setSelectedCandidateId(null);
    if (activeModal === 'requests') setRequestsOpen(false);
  }

  useEffect(() => {
    if (!activeModal) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
      if (event.key === 'Escape') { event.preventDefault(); closeActiveModal(); return; }
      if (event.key !== 'Tab' || controls.length === 0) return;
      const first = controls[0];
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      siblings.forEach((child) => { if (child instanceof HTMLElement) child.inert = false; });
      restoreFocusRef.current?.focus();
    };
  // closeActiveModal intentionally follows the active modal captured by this effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal]);

  function locateSignal() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocating(false);
    }, () => setLocating(false), { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 });
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
    await props.onSaveSignal({ startsAt: startsAt(), pace, note, location });
    setSignalComposer(false);
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

  return <section ref={rootRef} className="production-woof-workspace" data-direction="alive-map-not-feed; approximate-location; live-signal-and-persistent-profile; no-dating-cliches">
    <div className="woof-map-layer" aria-hidden={mode !== 'live'}>
      {props.viewerLocation ? <WoofLiveMap signals={props.signals} viewerLocation={props.viewerLocation} viewerRadiusMeters={props.viewerRadiusMeters} selectedId={selectedSignal?.id ?? null} onSelect={(id) => setSelectedSignalId(id)} />
        : <div className="woof-map-await" aria-hidden="true" />}
    </div>

    <header className="woof-topbar">
      <button type="button" onClick={props.onLocateViewer} aria-label="Показать мой район" disabled={props.locating}><Crosshair /></button>
      <div className="woof-mode-switch" aria-label="Режим Гав">
        <button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')}>Сейчас рядом</button>
        <button type="button" aria-pressed={mode === 'meet'} onClick={() => setMode('meet')}>Знакомства</button>
      </div>
      <button type="button" onClick={() => setRequestsOpen(true)} aria-label={`Отклики и связи: ${props.requests.length}`}><UsersThree />{props.requests.length > 0 && <span>{props.requests.length}</span>}</button>
    </header>

    {props.inviteState !== 'idle' && <aside className={`woof-incoming-invite state-${props.inviteState}`} aria-live="polite" role={props.inviteState === 'error' ? 'alert' : 'status'}>
      <div>
        <b>{props.inviteState === 'loading' ? 'Открываю приглашение…' : props.inviteState === 'gone' ? 'Приглашение уже закрыто' : props.inviteState === 'error' ? 'Не получилось открыть приглашение' : props.invite?.petName ? `${props.invite.petName} зовёт познакомиться` : 'Вас зовут познакомить собак'}</b>
        <p>{props.inviteState === 'ready' ? 'После принятия владельцу придёт запрос. Контакт откроется только после взаимного согласия.' : props.inviteState === 'gone' ? 'Попросите друга отправить новую ссылку.' : props.inviteState === 'error' ? 'Проверьте соединение или закройте приглашение.' : 'Проверяю срок и владельца ссылки.'}</p>
      </div>
      {props.inviteState === 'ready' && <button className="woof-primary" type="button" disabled={props.busyId === 'incoming-invite'} onClick={() => props.onAcceptInvite()}>{props.busyId === 'incoming-invite' ? 'Принимаю…' : 'Принять'}</button>}
      {props.inviteState !== 'loading' && <button type="button" onClick={props.onDismissInvite}>{props.inviteState === 'ready' ? 'Отклонить' : 'Закрыть'}</button>}
    </aside>}

    {mode === 'live' && <>
      <div className="woof-live-heading"><span className="woof-live-dot" />{props.locating || props.state === 'loading' ? 'Ищу ваш район…' : `${props.signals.filter((signal) => !signal.isMine).length} поблизости`}</div>
      {selectedSignal && <article className="woof-signal-card" aria-live="polite">
        <div className="woof-signal-main">
          <DogPortrait candidate={{ name: selectedSignal.name, avatarUrl: selectedSignal.avatarUrl }} />
          <div><p><b>{selectedSignal.name}</b>{selectedSignal.isMine ? ' · ваш Гав' : ''}</p><span>{timeLabel(selectedSignal.startsAt)} · {paceCopy[selectedSignal.pace]}</span></div>
        </div>
        {selectedSignal.note && <p className="woof-signal-note">«{selectedSignal.note}»</p>}
        <p className="woof-location-copy"><ShieldCheck />{selectedSignal.district || 'Примерная зона'} · точное место скрыто</p>
        {selectedSignal.isMine ? <div className="woof-signal-actions">
          <button type="button" onClick={() => setSignalComposer(true)}>Изменить</button>
          <button type="button" disabled={props.busyId === 'signal'} onClick={() => props.onCloseSignal('completed')}>Завершить</button>
        </div> : <button className="woof-primary" type="button" disabled={props.busyId === selectedSignal.petId} onClick={() => props.onRequest(selectedSignal.petId, 'walk', selectedSignal.id)}>Откликнуться</button>}
      </article>}
      {props.state === 'error' ? <article className="woof-empty-live woof-error-state" role="alert"><PawPrint /><b>Район не загрузился</b><p>Проверьте соединение — Псё не будет выдавать ошибку за отсутствие собак.</p><button type="button" onClick={() => props.onRetry()}>Повторить</button></article>
        : props.signalReason === 'CITY_NOT_SUPPORTED' ? <article className="woof-empty-live"><PawPrint /><b>Здесь Гав ещё не работает</b><p>Сейчас живые сигналы доступны в Москве и Санкт-Петербурге.</p></article>
          : props.signalReason === 'VIEWER_LOCATION_REQUIRED' ? <article className="woof-empty-live woof-location-state"><Crosshair /><b>Покажите район рядом</b><p>Точная точка не сохраняется — для поиска используется округлённая зона.</p><button type="button" onClick={props.onLocateViewer} disabled={props.locating}>{props.locating ? 'Определяю…' : 'Показать рядом'}</button></article>
            : !selectedSignal && props.state !== 'loading' && <article className="woof-empty-live"><PawPrint /><b>В радиусе 3 км пока тихо</b><p>Ваш Гав станет первой живой точкой района.</p></article>}
      {props.signalReason !== 'CITY_NOT_SUPPORTED' && <button ref={composerTriggerRef} className="woof-give-button" type="button" onClick={() => setSignalComposer(true)}>{ownSignal ? 'Изменить Гав' : 'Дать Гав'}<PawPrint weight="fill" /></button>}
    </>}

    {mode === 'meet' && <main className="woof-meet-feed">
      <div className="woof-meet-intro"><p className="woof-kicker">найти своих</p><h1>Знакомства</h1><p>Спокойный поиск постоянной компании — без показа геопозиции.</p></div>
      <div className="woof-meet-tools">
        <button type="button" aria-expanded={filtersOpen} aria-controls="woof-meet-filters" onClick={() => setFiltersOpen((value) => !value)}><Funnel />{filtersOpen ? 'Свернуть фильтры' : 'Показать фильтры'}</button>
        <button type="button" onClick={refreshMeetLocation} disabled={props.locating}><Crosshair />{props.locating ? 'Определяю…' : props.profile?.coarseLocation ? 'Обновить район' : 'Искать рядом'}</button>
        <button type="button" onClick={() => setProfileEditor(true)}>{props.profile?.discoverable ? 'Моя анкета' : 'Создать анкету'}</button>
      </div>
      {filtersOpen && <section id="woof-meet-filters" className="woof-meet-filters" aria-label="Фильтры знакомств">
        <label><span>Область поиска</span><select value={meetRadius} onChange={(event) => setMeetRadius(event.target.value as typeof meetRadius)}><option value="5">До 5 км</option><option value="10">До 10 км</option><option value="15">До 15 км</option><option value="city">Весь город</option></select></label>
        <label><span>Цель</span><select value={meetScenario} onChange={(event) => setMeetScenario(event.target.value as typeof meetScenario)}><option value="all">Любая</option><option value="meet">Знакомство</option><option value="walk">Прогулка</option><option value="socialize">Социализация</option><option value="mating">Случка</option></select></label>
        <label><span>Возраст</span><select value={meetLifeStage} onChange={(event) => setMeetLifeStage(event.target.value as typeof meetLifeStage)}><option value="all">Любой</option><option value="puppy">Щенок</option><option value="adult">Взрослая</option><option value="senior">Старшая</option></select></label>
        <label><span>Ритм</span><select value={meetEnergy} onChange={(event) => setMeetEnergy(event.target.value as typeof meetEnergy)}><option value="all">Любой</option><option value="calm">Спокойный</option><option value="balanced">Уравновешенный</option><option value="active">Активный</option></select></label>
        <p>{props.profile?.coarseLocation ? `Поиск считается от вашего примерного района. Точная точка не показывается.` : 'Разрешите геолокацию или укажите район в анкете — точная точка не сохраняется.'}</p>
      </section>}
      {props.state === 'error' ? <article className="woof-empty-meet" role="alert"><PawPrint /><h2>Анкеты не загрузились</h2><p>Это сбой соединения, а не пустой поиск.</p><button className="woof-primary" type="button" onClick={() => props.onRetry()}>Повторить</button></article>
      : filteredCandidates.length > 0 ? <div className="woof-candidate-grid">{filteredCandidates.map((candidate) => <button className="woof-candidate-card" type="button" key={candidate.petId} onClick={() => setSelectedCandidateId(candidate.petId)}>
        <DogPortrait candidate={candidate} />
        <span><b>{candidate.name}</b><small>{[readable(candidate.lifeStage), readable(candidate.temperament), candidate.distance || candidate.district].filter(Boolean).join(' · ')}</small><em>{candidate.reasons.slice(0, 2).join(' · ')}</em></span>
      </button>)}</div> : <article className="woof-empty-meet"><PawPrint /><h2>{allCandidates.length ? 'Под эти фильтры никого нет' : props.profile?.discoverable ? 'Новые анкеты появятся здесь' : 'Сначала расскажите о собаке'}</h2><p>{allCandidates.length ? 'Расширьте радиус или уберите один из фильтров.' : props.profile?.discoverable ? 'Псё покажет только реальные анкеты вашего города.' : 'Характер и привычный ритм помогут найти подходящую компанию.'}</p>{allCandidates.length ? <button className="woof-primary" type="button" onClick={() => { setMeetRadius('city'); setMeetScenario('all'); setMeetLifeStage('all'); setMeetEnergy('all'); }}>Сбросить фильтры</button> : <button className="woof-primary" type="button" onClick={() => setProfileEditor(true)}>{props.profile?.discoverable ? 'Проверить мою анкету' : 'Создать анкету'}</button>}</article>}
    </main>}

    {signalComposer && <section ref={composerRef} className="woof-composer" role="dialog" aria-modal="true" aria-labelledby="woof-composer-title">
      <button className="woof-sheet-close" type="button" onClick={() => setSignalComposer(false)} aria-label="Закрыть"><X /></button>
      <p className="woof-kicker">временный сигнал</p><h2 id="woof-composer-title">Когда идём?</h2>
      <div className="woof-choice-row"><button type="button" aria-pressed={when === 'now'} onClick={() => setWhen('now')}>Сейчас</button><button type="button" aria-pressed={when === 'later'} onClick={() => setWhen('later')}>Позже</button></div>
      {when === 'later' && <label className="woof-field"><span>Начало прогулки</span><input type="time" value={laterTime} onChange={(event) => setLaterTime(event.target.value)} /></label>}
      <fieldset className="woof-pace"><legend>Темп</legend>{(['calm', 'balanced', 'active'] as WalkPace[]).map((value) => <button type="button" key={value} aria-pressed={pace === value} onClick={() => setPace(value)}>{paceCopy[value]}</button>)}</fieldset>
      <label className="woof-field"><span>Короткая заметка <small>необязательно</small></span><textarea maxLength={180} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например: идём вокруг пруда" /></label>
      <button className="woof-location-button" type="button" onClick={locateSignal}><Crosshair />{locating ? 'Определяю примерную зону…' : location ? 'Примерная зона выбрана' : 'Выбрать район рядом со мной'}</button>
      <p className="woof-privacy"><ShieldCheck />На карте появится зона радиусом 700 м, а не ваша точка.</p>
      <p className="woof-expiry"><ClockCountdown />{when === 'now' ? 'Гав исчезнет автоматически через 2 часа.' : 'Гав исчезнет через 3 часа после выбранного времени.'}</p>
      <button className="woof-primary" type="button" disabled={!location || props.busyId === 'signal'} onClick={submitSignal}>{props.busyId === 'signal' ? 'Сохраняю…' : !location ? 'Сначала выберите район' : ownSignal ? 'Обновить Гав' : 'Дать Гав'}</button>
    </section>}

    {profileEditor && <div ref={profileOverlayRef} className="woof-overlay" role="dialog" aria-modal="true" aria-label="Моя анкета знакомства"><button className="woof-overlay-x" type="button" onClick={() => setProfileEditor(false)} aria-label="Закрыть"><X /></button><SocialProfileSheet dogName={props.dogName} profile={props.profile} busy={props.busyId === 'profile'} locating={props.locating} onSave={props.onSaveProfile} onHide={props.onHideProfile} onLocate={props.onLocateProfile} /><button className="woof-overlay-close" type="button" onClick={() => setProfileEditor(false)}>Готово</button></div>}
    {selectedCandidate && <div ref={candidateOverlayRef} className="woof-overlay" role="presentation"><CandidateProfile candidate={selectedCandidate} busy={props.busyId === selectedCandidate.petId} onClose={() => setSelectedCandidateId(null)} onRequest={() => props.onRequest(selectedCandidate.petId, selectedCandidate.sharedScenarios[0] || 'meet')} /></div>}
    {requestsOpen && <div ref={requestsOverlayRef} className="woof-overlay" role="dialog" aria-modal="true" aria-label="Отклики и связи"><button className="woof-overlay-x" type="button" onClick={() => setRequestsOpen(false)} aria-label="Закрыть"><X /></button><RequestsPanel requests={props.requests} petId={props.profile?.petId || ''} busyId={props.busyId} missingTelegramUsernameAction={props.missingTelegramUsernameAction ?? null} onAction={props.onUpdateRequest} onReport={props.onReport} onOpenChat={props.onOpenContact} /></div>}
  </section>;
}
