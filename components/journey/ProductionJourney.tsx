'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import {
  ArrowRight,
  BellSimple,
  CaretRight,
  Check,
  FilePdf,
  FirstAid,
  Heart,
  MapTrifold,
  Package,
  PaperPlaneTilt,
  PawPrint,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkle,
  UsersThree,
  Warning,
  X,
} from '@phosphor-icons/react';

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
  map?: ReactNode;
  riskTitle?: string;
  routeTitle?: string;
  candidates?: JourneyCandidate[];
  discoverable?: boolean;
  onOpenSocial?: () => void;
  things?: JourneyThing[];
  onAddThing?: () => void;
};

function DogAvatar({ avatar, small = false }: { avatar: ReactNode; small?: boolean }) {
  return <div className={`v3-dog-avatar production-journey-avatar${small ? ' small' : ''}`}>{avatar}</div>;
}

function Header({ dogName, title, detail, avatar }: { dogName: string; title: string; detail: string; avatar: ReactNode }) {
  return <header className="v3-header production-journey-header">
    <div><span className="v3-wordmark">Псё</span><small>{detail}</small></div>
    <button type="button" aria-label={`Открыть профиль ${dogName}`}><DogAvatar avatar={avatar} small /></button>
    <h1>{title}</h1>
  </header>;
}

function TodayScreen(props: ProductionJourneyProps) {
  const careTitle = props.careTitle || 'Сегодня всё сделано';
  const nearbyTitle = props.nearbyTitle || 'Дать Гав';
  return <main className="v3-screen v3-all production-journey-screen" data-production-journey="today">
    <Header dogName={props.dogName} title={`${props.dogName} сегодня`} detail="ваш день вместе" avatar={props.avatar} />
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
  return <main className="v3-screen v3-dog production-journey-screen" data-production-journey="profile">
    <Header dogName={props.dogName} title={props.dogName} detail="профиль и история" avatar={props.avatar} />
    <section className="v3-passport production-journey-passport">
      <DogAvatar avatar={props.avatar} />
      <div><span>{props.breedLabel}</span><h2>Всё важное о собаке в одном месте</h2><button type="button" onClick={() => props.onNavigate('profile')}>Открыть профиль <ArrowRight /></button></div>
    </section>
    <section className="v3-dog-action-grid">
      <button type="button" className="v3-doc-action" onClick={() => props.onNavigate('profile')}><FilePdf weight="duotone" /><span><b>Анализы и документы</b><small>{props.documentCount ? `${props.documentCount} сохранено` : 'Добавить первый файл'}</small></span><Plus weight="bold" /></button>
      <button type="button" className="v3-care-action" onClick={() => props.onNavigate('calendar')}><FirstAid weight="duotone" /><span><b>План ухода</b><small>{props.careTitle || 'Открыть дела'}</small></span><CaretRight weight="bold" /></button>
    </section>
    <section className="v3-timeline">
      <header><h2>История {props.dogName}</h2><button type="button" onClick={() => props.onNavigate('health')}>Что заметили?</button></header>
      <article><time>Недавно</time><span className="dot pdf" /><div><b>{props.latestDocument || 'Документов пока нет'}</b><p>{props.latestDocumentDetail || 'Добавь PDF или фото из клиники'}</p><small>Исходник хранится приватно</small></div></article>
      <article><time>План</time><span className="dot done" /><div><b>{props.careTitle || 'Добавить дело по уходу'}</b><p>{props.careDetail || 'Выполнения появятся в общей истории'}</p><small>Срок и повторяемость задаются в плане</small></div></article>
      <article><time>Наблюдение</time><span className="dot note" /><div><b>{props.latestObservation || 'Пока ничего не записано'}</b><p>Только то, что заметил владелец</p><small>Без автоматически заполненных показателей</small></div></article>
    </section>
    {props.children && <section className="production-journey-details">{props.children}</section>}
  </main>;
}

function MapScreen(props: ProductionJourneyProps) {
  return <main className="v3-screen v3-map-screen production-journey-screen" data-production-journey="map">
    <Header dogName={props.dogName} title="Карта прогулок" detail="маршруты и места" avatar={props.avatar} />
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
    <Header dogName={props.dogName} title="Гав" detail="кто хочет гулять" avatar={props.avatar} />
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
    <Header dogName={props.dogName} title={`Вещи ${props.dogName}`} detail="нужное и любимое" avatar={props.avatar} />
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
