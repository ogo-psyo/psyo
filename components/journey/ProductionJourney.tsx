'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  ArrowRight,
  BellSimple,
  CalendarCheck,
  CaretRight,
  ChatCircleDots,
  Check,
  FileArrowUp,
  FilePdf,
  FirstAid,
  Heart,
  MapTrifold,
  Package,
  PaperPlaneTilt,
  PawPrint,
  PencilSimple,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkle,
  UsersThree,
  Warning,
  X,
} from '@phosphor-icons/react';

export type JourneyProfileEntry = {
  id: string;
  kind: 'document' | 'care' | 'observation';
  when: string;
  title: string;
  detail: string;
  meta?: string;
  href?: string;
  onOpen?: () => void;
};

export type JourneyObservationPoint = {
  id: string;
  createdAt: string;
  mood?: string;
  appetite?: string;
  stool?: string;
  energy?: string;
  note?: string;
};

export type JourneyCandidate = {
  id: string;
  name: string;
  distance: string;
  availability: string;
  note: string;
  onOpen: () => void;
};

export type JourneyThing = {
  id: string;
  title: string;
  detail: string;
  tone: 'mint' | 'rose' | 'green';
};

type BaseProps = {
  route: 'today' | 'profile' | 'map' | 'nearby' | 'things';
  dogName: string;
  breedLabel: string;
  avatar: ReactNode;
  onNavigate: (route: 'today' | 'profile' | 'map' | 'nearby' | 'things' | 'calendar' | 'health') => void;
  children?: ReactNode;
};

type ProductionJourneyProps = BaseProps & {
  careTitle?: string;
  careDetail?: string;
  careDone?: boolean;
  onCareAction?: () => void;
  nearbyTitle?: string;
  nearbyDetail?: string;
  documentCount?: number;
  latestDocument?: string;
  latestDocumentDetail?: string;
  latestObservation?: string;
  profileFacts?: string[];
  profileEntries?: JourneyProfileEntry[];
  observationPoints?: JourneyObservationPoint[];
  onAddDocument?: (trigger: HTMLButtonElement) => void;
  onEditProfile?: () => void;
  onAddObservation?: () => void;
  onOpenCare?: () => void;
  onAskAssistant?: () => void;
  map?: ReactNode;
  riskTitle?: string;
  routeTitle?: string;
  candidates?: JourneyCandidate[];
  discoverable?: boolean;
  onOpenSocial?: () => void;
  things?: JourneyThing[];
  onAddThing?: () => void;
};

const wellbeingMetricLabels = {
  mood: 'Настроение',
  appetite: 'Аппетит',
  stool: 'Пищеварение',
  energy: 'Энергия',
} as const;

type WellbeingMetric = keyof typeof wellbeingMetricLabels;

function wellbeingValue(metric: WellbeingMetric, raw?: string): number | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (metric === 'mood') {
    if (value.includes('радост')) return 4;
    if (value.includes('спокой')) return 3;
    if (value.includes('тревож')) return 2;
    if (value.includes('вял')) return 1;
  }
  if (metric === 'appetite') {
    if (value.includes('обыч')) return 3;
    if (value.includes('выше')) return 2.5;
    if (value.includes('ниже')) return 2;
    if (value.includes('не ел') || value.includes('не ела')) return 1;
  }
  if (metric === 'stool') {
    if (value.includes('обыч')) return 3;
    if (value.includes('мяг')) return 2;
    if (value.includes('жид')) return 1;
    if (value.includes('не был') || value.includes('не было')) return 2;
  }
  if (metric === 'energy') {
    if (value.includes('обыч')) return 3;
    if (value.includes('много')) return 2.5;
    if (value.includes('мало')) return 2;
    if (value.includes('сонн') || value.includes('нет сил')) return 1;
  }
  return 2.5;
}

function observationScore(point: JourneyObservationPoint) {
  const values = (Object.keys(wellbeingMetricLabels) as WellbeingMetric[])
    .map((metric) => wellbeingValue(metric, point[metric]))
    .filter((value): value is number => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function trendCopy(points: JourneyObservationPoint[]) {
  if (!points.length) return { title: 'Данных для динамики пока нет', detail: 'Первое наблюдение станет точкой отсчёта.' };
  if (points.length === 1) return { title: 'Есть первая точка отсчёта', detail: 'После следующего наблюдения покажем, что изменилось.' };
  const current = observationScore(points.at(-1)!);
  const previous = observationScore(points.at(-2)!);
  if (current === null || previous === null) return { title: 'Наблюдения сохранены', detail: 'Для вывода нужны два наблюдения с отмеченными показателями.' };
  const delta = current - previous;
  if (delta <= -.55) return { title: 'Есть заметное снижение', detail: 'Сравните последние записи и при необходимости обсудите изменения с ветеринаром.' };
  if (delta >= .55) return { title: 'Последняя запись спокойнее', detail: 'Отмеченные показатели ближе к обычному состоянию.' };
  return { title: 'Без заметных изменений', detail: 'Последние наблюдения находятся примерно на одном уровне.' };
}

function ProfileWellbeingTrend({ dogName, points, entries, onAddObservation }: { dogName: string; points: JourneyObservationPoint[]; entries: JourneyProfileEntry[]; onAddObservation?: () => void }) {
  const ordered = [...points].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-7);
  const scored = ordered.map((point) => ({ point, score: observationScore(point) })).filter((item): item is { point: JourneyObservationPoint; score: number } => item.score !== null);
  const plot = scored.map((item, index) => ({
    x: scored.length === 1 ? 160 : 24 + (index * 272) / (scored.length - 1),
    y: 92 - ((item.score - 1) / 3) * 68,
    item,
  }));
  const line = plot.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const copy = trendCopy(ordered);
  const summaryTitle = scored.length > 1 ? `Последние ${scored.length} наблюдений` : scored.length === 1 ? 'Первая отметка' : 'Наблюдений пока нет';
  const summaryDetail = scored.length > 1 ? 'Линия показывает изменения относительно обычного состояния.' : scored.length === 1 ? 'Следующая запись превратит точку в динамику.' : `Добавьте первую отметку о ${dogName}.`;
  const latest = ordered.at(-1);
  const previous = ordered.at(-2);
  const documents = entries.filter((entry) => entry.kind === 'document').length;
  const care = entries.filter((entry) => entry.kind === 'care').length;
  const metricChanges = latest ? (Object.keys(wellbeingMetricLabels) as WellbeingMetric[]).flatMap((metric) => {
    const current = wellbeingValue(metric, latest[metric]);
    if (current === null) return [];
    const before = previous ? wellbeingValue(metric, previous[metric]) : null;
    const direction = before === null ? 'есть первая отметка' : current > before + .35 ? 'выше прошлой отметки' : current < before - .35 ? 'ниже прошлой отметки' : 'без изменений';
    return [{ metric, label: wellbeingMetricLabels[metric], value: latest[metric]!, direction }];
  }) : [];
  const dateLabel = latest ? new Date(latest.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : null;
  const chartDates = scored.length ? [scored[0], scored.at(-1)!].map(({ point }) => new Date(point.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })) : [];

  return <section className="profile-wellbeing" data-profile-wellbeing>
    <div className="profile-wellbeing-heading"><div><h2>Динамика самочувствия</h2><p>{scored.length ? `${scored.length} ${scored.length === 1 ? 'наблюдение' : 'наблюдений'} · последние записи` : `Наблюдений о ${dogName} пока нет`}</p></div><button type="button" onClick={onAddObservation}>Добавить</button></div>
    <details>
      <summary>
        <div className="profile-wellbeing-copy"><b>{summaryTitle}</b><span>{summaryDetail}</span></div>
        <div className={`profile-wellbeing-chart${plot.length < 2 ? ' sparse' : ''}`} aria-label={plot.length > 1 ? `График динамики по ${plot.length} наблюдениям` : copy.title} role="img">
          <span className="profile-wellbeing-baseline">обычно</span>
          <svg viewBox="0 0 320 112" preserveAspectRatio="none" aria-hidden="true">
            <line x1="18" y1="47" x2="302" y2="47" className="baseline" />
            {line && <path d={line} className="trend-line" />}
            {plot.map(({ x, y, item }) => <circle key={item.point.id} cx={x} cy={y} r="5" />)}
          </svg>
          {chartDates.length > 0 && <span className="profile-wellbeing-dates"><span>{chartDates[0]}</span>{scored.length > 1 && <span>{chartDates[1]}</span>}</span>}
          {!plot.length && <span className="profile-wellbeing-empty">Добавьте первое наблюдение</span>}
        </div>
        <span className="profile-wellbeing-open">Выводы <CaretRight weight="regular" /></span>
      </summary>
      <div className="profile-wellbeing-insights">
        <div className="profile-wellbeing-verdict"><b>{copy.title}</b><p>{copy.detail}</p>{dateLabel && <small>Последняя запись — {dateLabel}</small>}</div>
        {metricChanges.length > 0 && <ul>{metricChanges.map((item) => <li key={item.metric}><span>{item.label}</span><b>{item.value}</b><small>{item.direction}</small></li>)}</ul>}
        {latest?.note && <p className="profile-wellbeing-note"><b>Контекст последней записи</b>{latest.note}</p>}
        {(documents > 0 || care > 0) && <p className="profile-wellbeing-context">Рядом в истории: {documents ? `${documents} ${documents === 1 ? 'документ' : 'документа'}` : ''}{documents && care ? ' · ' : ''}{care ? `${care} ${care === 1 ? 'выполненное дело' : 'выполненных дела'}` : ''}.</p>}
        <small className="profile-wellbeing-caution">Это сводка ваших наблюдений, а не медицинское заключение.</small>
      </div>
    </details>
  </section>;
}

function DogAvatar({ avatar, small = false }: { avatar: ReactNode; small?: boolean }) {
  return <div className={`v3-dog-avatar production-journey-avatar${small ? ' small' : ''}`}>{avatar}</div>;
}

function Header({ dogName, title, detail, avatar, onOpenProfile }: { dogName: string; title: string; detail: string; avatar: ReactNode; onOpenProfile?: () => void }) {
  return <header className="v3-header production-journey-header">
    <div><span className="v3-wordmark">Псё</span><small>{detail}</small></div>
    {onOpenProfile ? <button type="button" aria-label={`Открыть профиль ${dogName}`} onClick={onOpenProfile}><DogAvatar avatar={avatar} small /></button> : <DogAvatar avatar={avatar} small />}
    <h1>{title}</h1>
  </header>;
}

function TodayScreen(props: ProductionJourneyProps) {
  const careTitle = props.careTitle || 'Сегодня всё сделано';
  const nearbyTitle = props.nearbyTitle || 'Дать Гав';
  return <main className="v3-screen v3-all production-journey-screen" data-production-journey="today">
    <Header dogName={props.dogName} title={`${props.dogName} сегодня`} detail="ваш день вместе" avatar={props.avatar} onOpenProfile={() => props.onNavigate('profile')} />
    <section className="v3-orbit production-journey-orbit" aria-label={`Главное о ${props.dogName} сегодня`}>
      <div className="v3-orbit-halo" />
      <div className="v3-orbit-copy"><span>{props.careDone ? 'всё спокойно' : 'одно дело'}</span><strong>{props.careDone ? `У ${props.dogName} хороший день` : `День ${props.dogName} под контролем`}</strong><p>{props.careDone ? 'Можно придумать прогулку.' : 'Главное уже рядом. После него можно гулять.'}</p></div>
      <DogAvatar avatar={props.avatar} />
      <div className="v3-orbit-bubble bubble-care"><BellSimple weight="fill" /><b>{props.careDone ? 'готово' : 'сегодня'}</b><span>{careTitle}</span></div>
      <div className="v3-orbit-bubble bubble-woof"><span className="v3-wave">)))</span><b>Гав</b><span>{nearbyTitle}</span></div>
    </section>
    <section className="v3-now">
      <div><span>Главное сейчас</span><h2>{careTitle}</h2><p>{props.careDetail || 'Открой план и добавь ближайшее дело'}</p></div>
      <button type="button" onClick={props.onCareAction}><Check weight="bold" /> {props.careDone ? 'Открыть' : 'Готово'}</button>
    </section>
    <section className="v3-discovery">
      <div className="v3-discovery-art"><span /><span /><span /></div>
      <div><span>Живой сигнал</span><h2>{nearbyTitle}</h2><p>{props.nearbyDetail || 'Посмотри, кто хочет гулять рядом'}</p><button type="button" onClick={() => props.onNavigate('nearby')}>Открыть Гав <ArrowRight weight="bold" /></button></div>
    </section>
    <section className="v3-recent"><div><span>Недавно</span><b>{props.latestDocument || 'Добавить анализ из клиники'}</b><small>{props.latestDocumentDetail || 'PDF или фото останутся в истории собаки'}</small></div><FilePdf weight="duotone" /></section>
    {props.children}
  </main>;
}

function ProfileScreen(props: ProductionJourneyProps) {
  const entries = props.profileEntries || [];
  return <main className="v3-screen v3-dog production-journey-screen" data-production-journey="profile">
    <Header dogName={props.dogName} title={props.dogName} detail="профиль и история" avatar={props.avatar} onOpenProfile={props.onEditProfile} />
    <section className="profile-life-card" data-slot="card">
      <div className="profile-life-card-header" data-slot="card-header">
        <DogAvatar avatar={props.avatar} />
        <div><span className="profile-life-kicker"><PawPrint weight="regular" /> Личное пространство</span><h2 data-slot="card-title">{props.breedLabel}</h2><p data-slot="card-description">Данные, документы и важные моменты — рядом</p></div>
      </div>
      <div className="profile-life-facts" data-slot="card-content">{(props.profileFacts || []).slice(0, 3).map((fact) => <small key={fact}>{fact}</small>)}</div>
      <div className="profile-life-card-footer" data-slot="card-footer"><button type="button" onClick={props.onEditProfile}><PencilSimple weight="regular" /> Изменить</button><button type="button" onClick={props.onAskAssistant}><ChatCircleDots weight="regular" /> Спросить Псё</button></div>
    </section>
    <section className="profile-life-primary" data-slot="item-group" aria-label="Главные действия">
      <button type="button" data-slot="item" data-profile-journey-action="add-document" onClick={(event) => props.onAddDocument?.(event.currentTarget)}><span data-slot="item-media"><FileArrowUp weight="regular" /></span><span data-slot="item-content"><b data-slot="item-title">Добавить анализ</b><small data-slot="item-description">Сохранить PDF или фото из клиники</small></span><CaretRight data-slot="item-action" weight="regular" /></button>
      <button type="button" data-slot="item" onClick={props.onOpenCare}><span data-slot="item-media"><CalendarCheck weight="regular" /></span><span data-slot="item-content"><b data-slot="item-title">{props.careTitle || 'План ухода'}</b><small data-slot="item-description">{props.careDetail || 'Ближайшее дело и история выполнений'}</small></span><CaretRight data-slot="item-action" weight="regular" /></button>
    </section>
    <ProfileWellbeingTrend dogName={props.dogName} points={props.observationPoints || []} entries={entries} onAddObservation={props.onAddObservation} />
    <section className="profile-life-permanent">
      <div><span>Постоянное о собаке</span><h2>Данные, которые всегда под рукой</h2><p>Порода, характер, питание, аллергии и правила знакомства. Публично ничего не открывается само.</p></div>
      <button type="button" onClick={props.onEditProfile}>Открыть данные <ArrowRight weight="bold" /></button>
    </section>
    <aside className="v3-privacy profile-life-privacy"><ShieldCheck weight="fill" /><span><b>Личное остаётся личным</b><small>Анализы, лекарства и история не попадают в публичную карточку.</small></span></aside>
  </main>;
}

export function ProductionDocumentSheet({ dogName, onClose, returnFocusTo, children }: { dogName: string; onClose: () => void; returnFocusTo?: HTMLElement | null; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    triggerRef.current = returnFocusTo || document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      const trigger = triggerRef.current;
      window.requestAnimationFrame(() => trigger?.focus());
    };
  }, [returnFocusTo]);
  const closeSheet = () => { dialogRef.current?.close(); onClose(); };
  return <dialog ref={dialogRef} className="profile-document-dialog" aria-labelledby="profile-document-sheet-title" aria-describedby="profile-document-sheet-description" onCancel={(event) => { event.preventDefault(); closeSheet(); }} onClick={(event) => { if (event.target === event.currentTarget) closeSheet(); }}>
    <section className="profile-document-sheet" data-slot="sheet-content">
      <header data-slot="sheet-header"><span className="profile-document-sheet-mark" aria-hidden="true"><FileArrowUp weight="regular" /></span><div><h2 id="profile-document-sheet-title">Добавить в историю</h2><p id="profile-document-sheet-description">Документ останется личным и будет рядом, когда понадобится</p></div><button type="button" aria-label="Закрыть" onClick={closeSheet}><X weight="regular" /></button></header>
      <div className="profile-document-sheet-body" data-slot="sheet-body">{children}</div>
    </section>
  </dialog>;
}

function MapScreen(props: ProductionJourneyProps) {
  return <main className="v3-screen v3-map-screen production-journey-screen" data-production-journey="map">
    <Header dogName={props.dogName} title="Карта прогулок" detail="маршруты и места" avatar={props.avatar} onOpenProfile={() => props.onNavigate('profile')} />
    <section className="v3-real-map production-journey-map" aria-label="Интерактивная карта прогулок">{props.map}</section>
    <section className="v3-map-sheet">
      <div className="v3-sheet-handle" />
      <header><div><span>В вашем районе</span><h2>Полезное для прогулки</h2></div><button type="button" onClick={() => props.onNavigate('map')}>Все</button></header>
      <article className="v3-risk-row"><Warning weight="fill" /><div><b>{props.riskTitle || 'Добавить опасную зону'}</b><span>Предупреждения показывают приблизительное место</span></div><CaretRight /></article>
      <article className="v3-route-row"><MapTrifold weight="duotone" /><div><b>{props.routeTitle || 'Построить новый маршрут'}</b><span>Маршрут можно сохранить или открыть по ссылке</span></div><CaretRight /></article>
    </section>
    {props.children && <section className="production-journey-details map-details">{props.children}</section>}
  </main>;
}

function NearbyScreen(props: ProductionJourneyProps) {
  const candidates = props.candidates?.slice(0, 2) || [];
  return <main className="v3-screen v3-woof production-journey-screen" data-production-journey="nearby">
    <Header dogName={props.dogName} title="Гав" detail="кто хочет гулять" avatar={props.avatar} onOpenProfile={() => props.onNavigate('profile')} />
    <section className="v3-woof-signal production-journey-woof">
      <div className="v3-signal-rings"><span /><span /><span /><DogAvatar avatar={props.avatar} /></div>
      <div><span>{props.discoverable ? 'Ваш сигнал включён' : 'Ваш сигнал выключен'}</span><h2>{props.discoverable ? 'Гав уже слышно' : 'Дать Гав?'}</h2><p>Покажем {props.dogName} подходящим собакам поблизости. Точный адрес останется скрыт.</p><button type="button" onClick={props.onOpenSocial}><span className="v3-wave">)))</span> {props.discoverable ? 'Настроить Гав' : 'Дать Гав'}</button></div>
    </section>
    <section className="v3-woof-list">
      <header><h2>Зовут гулять</h2><button type="button" onClick={props.onOpenSocial}>Фильтры</button></header>
      {candidates.length === 0 && <article className="production-journey-empty"><div className="v3-candidate-avatar"><UsersThree weight="duotone" /></div><div><b>Пока тихо</b><span>Можно включить свой сигнал</span><p>Новые анкеты появятся без точных адресов.</p></div><button type="button" onClick={props.onOpenSocial}>Открыть</button></article>}
      {candidates.map((candidate) => <article key={candidate.id}><div className="v3-candidate-avatar">{candidate.name.slice(0, 1).toUpperCase()}</div><div><b>{candidate.name} · {candidate.distance}</b><span>{candidate.availability}</span><p>{candidate.note}</p></div><button type="button" onClick={candidate.onOpen}>Откликнуться</button></article>)}
    </section>
    <aside className="v3-privacy"><ShieldCheck weight="fill" /><span><b>Контакт только по согласию</b><small>До совпадения видны только район и профиль собаки.</small></span></aside>
    {props.children && <section className="production-journey-details">{props.children}</section>}
  </main>;
}

function ThingsScreen(props: ProductionJourneyProps) {
  const things = props.things?.slice(0, 3) || [];
  return <main className="v3-screen v3-things production-journey-screen" data-production-journey="things">
    <Header dogName={props.dogName} title={`Вещи ${props.dogName}`} detail="нужное и любимое" avatar={props.avatar} onOpenProfile={() => props.onNavigate('profile')} />
    <section className="v3-things-hero">
      <div><span>{things.length ? 'В списке сейчас' : 'Список свободен'}</span><h2>{things[0]?.title || 'Добавить нужную вещь'}</h2><p>{things[0]?.detail || 'Корм, амуниция, лекарства или услуги'}</p><button type="button" onClick={props.onAddThing}>{things.length ? 'Открыть список' : 'Добавить в список'} <ArrowRight /></button></div>
      <div className="v3-food-pack"><PawPrint weight="fill" /><b>{props.dogName.toUpperCase()}</b><small>всё нужное</small></div>
    </section>
    <section className="v3-shelf production-journey-shelf">
      <header><h2>Нужно купить</h2><button type="button" onClick={props.onAddThing}><Plus weight="bold" /> Добавить</button></header>
      <div className="v3-shelf-track">
        {things.length === 0 && <article className="thing mint"><div><ShoppingBag weight="duotone" /></div><b>Пока пусто</b><span>Добавь первую позицию</span></article>}
        {things.map((thing) => <article className={`thing ${thing.tone}`} key={thing.id}><div>{thing.tone === 'rose' ? <FirstAid weight="duotone" /> : <Package weight="duotone" />}</div><b>{thing.title}</b><span>{thing.detail}</span></article>)}
      </div>
    </section>
    <section className="v3-favorites"><h2>Любимое {props.dogName}</h2><button type="button" onClick={props.onAddThing}><Heart weight="fill" /><span><b>Добавить любимую вещь</b><small>То, что всегда берёте с собой</small></span><CaretRight /></button></section>
    {props.children && <section className="production-journey-details">{props.children}</section>}
  </main>;
}

export function ProductionJourney(props: ProductionJourneyProps) {
  if (props.route === 'today') return <TodayScreen {...props} />;
  if (props.route === 'profile') return <ProfileScreen {...props} />;
  if (props.route === 'map') return <MapScreen {...props} />;
  if (props.route === 'nearby') return <NearbyScreen {...props} />;
  return <ThingsScreen {...props} />;
}

export function ProductionAssistantSheet({
  dogName, avatar, question, answer, loading, onQuestionChange, onAsk, onClose,
}: {
  dogName: string;
  avatar: ReactNode;
  question: string;
  answer: string;
  loading: boolean;
  onQuestionChange: (value: string) => void;
  onAsk: (question?: string) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) { if (event.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return <div className="v3-assistant-backdrop production-assistant-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="v3-assistant-sheet" role="dialog" aria-modal="true" aria-labelledby="production-assistant-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="v3-sheet-handle" />
      <header><div className="v3-assistant-mark"><Sparkle weight="fill" /></div><div><span>контекст: {dogName}</span><h2 id="production-assistant-title">Спросить Псё</h2></div><button type="button" onClick={onClose} aria-label="Закрыть"><X weight="bold" /></button></header>
      <div className="v3-assistant-context"><DogAvatar avatar={avatar} small /><p>Учту профиль {dogName}, дела и добавленные документы. Не заменяю ветеринара.</p></div>
      <div className="v3-prompt-list"><button type="button" onClick={() => onAsk('Что важно проверить по последнему анализу?')}>Что важно проверить по анализу?</button><button type="button" onClick={() => onAsk('Подбери спокойный маршрут для прогулки сегодня')}>Подобрать спокойный маршрут</button><button type="button" onClick={() => onAsk('Что учесть перед знакомством собак?')}>Что учесть перед знакомством?</button></div>
      {answer && <div className="production-assistant-answer" role="status">{answer}</div>}
      <label><input ref={inputRef} value={question} onChange={(event) => onQuestionChange(event.target.value)} aria-label="Вопрос ассистенту" placeholder={`Спроси о ${dogName}…`} /><button type="button" disabled={loading || !question.trim()} aria-label="Отправить" onClick={() => onAsk()}>{loading ? <Sparkle weight="fill" /> : <PaperPlaneTilt weight="fill" />}</button></label>
    </section>
  </div>;
}
