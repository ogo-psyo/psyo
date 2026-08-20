'use client';

import { useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  ArrowRight,
  BellSimple,
  CaretRight,
  Check,
  FilePdf,
  FirstAid,
  Heart,
  House,
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
import './design-v3.css';

const DesignV3Map = dynamic(() => import('./DesignV3Map'), { ssr: false });

type Tab = 'all' | 'dog' | 'map' | 'woof' | 'things';

const tabs: Array<{ id: Tab; label: string; icon: typeof House }> = [
  { id: 'all', label: 'Всё', icon: House },
  { id: 'dog', label: 'Псё', icon: PawPrint },
  { id: 'map', label: 'Карта', icon: MapTrifold },
  { id: 'woof', label: 'Гав', icon: UsersThree },
  { id: 'things', label: 'Вещи', icon: ShoppingBag },
];

function DogAvatar({ small = false }: { small?: boolean }) {
  return <div className={`v3-dog-avatar${small ? ' small' : ''}`}><Image src="/demo-avatar.png" alt="Мята" fill sizes={small ? '56px' : '132px'} priority /></div>;
}

function Header({ title, detail }: { title: string; detail?: string }) {
  return <header className="v3-header"><div><span className="v3-wordmark">Псё</span>{detail && <small>{detail}</small>}</div><button type="button" aria-label="Открыть профиль Мяты"><DogAvatar small /></button><h1>{title}</h1></header>;
}

function AllScreen() {
  return <main className="v3-screen v3-all">
    <Header title="Мята сегодня" detail="четверг, 20 августа" />
    <section className="v3-orbit" aria-label="Главное о Мяте сегодня">
      <div className="v3-orbit-halo" />
      <div className="v3-orbit-copy"><span>всё спокойно</span><strong>У Мяты хороший день</strong><p>Одно дело вечером. А рядом зовут гулять.</p></div>
      <DogAvatar />
      <div className="v3-orbit-bubble bubble-care"><BellSimple weight="fill" /><b>19:00</b><span>таблетка</span></div>
      <div className="v3-orbit-bubble bubble-woof"><span className="v3-wave">)))</span><b>Гав</b><span>Луна · 700 м</span></div>
    </section>
    <section className="v3-now">
      <div><span>Главное сейчас</span><h2>Вечерняя таблетка</h2><p>После еды · сегодня в 19:00</p></div>
      <button type="button"><Check weight="bold" /> Готово</button>
    </section>
    <section className="v3-discovery">
      <div className="v3-discovery-art"><span /><span /><span /></div>
      <div><span>Живой сигнал</span><h2>Луна зовёт в парк</h2><p>Спокойный темп · сегодня после 19:30</p><button type="button">Откликнуться <ArrowRight weight="bold" /></button></div>
    </section>
    <section className="v3-recent"><div><span>Недавно</span><b>Добавлен анализ крови</b><small>Ветклиника «Белый клык» · вчера</small></div><FilePdf weight="duotone" /></section>
  </main>;
}

function DogScreen() {
  return <main className="v3-screen v3-dog">
    <Header title="Мята" detail="профиль и история" />
    <section className="v3-passport">
      <DogAvatar />
      <div><span>метис · 4 года</span><h2>Любит долгие маршруты и знакомится спокойно</h2><button type="button">Открыть памятку <ArrowRight /></button></div>
    </section>
    <section className="v3-dog-action-grid">
      <button type="button" className="v3-doc-action"><FilePdf weight="duotone" /><span><b>Анализы и документы</b><small>3 файла · последний вчера</small></span><Plus weight="bold" /></button>
      <button type="button" className="v3-care-action"><FirstAid weight="duotone" /><span><b>План ухода</b><small>1 дело сегодня</small></span><CaretRight weight="bold" /></button>
    </section>
    <section className="v3-timeline">
      <header><h2>История Мяты</h2><button type="button">Что заметили?</button></header>
      <article><time>Вчера</time><span className="dot pdf" /><div><b>Общий анализ крови</b><p>Ветклиника «Белый клык»</p><small>PDF · исходник сохранён</small></div></article>
      <article><time>18 авг</time><span className="dot done" /><div><b>Обработка от клещей</b><p>Отмечено выполненным</p><small>Следующий срок · 18 сентября</small></div></article>
      <article><time>16 авг</time><span className="dot note" /><div><b>Аппетит ниже обычного</b><p>Только наблюдение владельца</p><small>Без автоматически заполненных показателей</small></div></article>
    </section>
  </main>;
}

function MapScreen() {
  return <main className="v3-screen v3-map-screen">
    <Header title="Карта прогулок" detail="маршруты и места" />
    <DesignV3Map />
    <section className="v3-map-sheet">
      <div className="v3-sheet-handle" />
      <header><div><span>В вашем районе</span><h2>Полезное для прогулки</h2></div><button type="button">Все</button></header>
      <article className="v3-risk-row"><Warning weight="fill" /><div><b>Разбитое стекло у входа</b><span>Подтвердили 4 владельца · 35 мин назад</span></div><CaretRight /></article>
      <article className="v3-route-row"><MapTrifold weight="duotone" /><div><b>Тихий маршрут вдоль воды</b><span>Сохранили 18 раз · 42 минуты</span></div><CaretRight /></article>
    </section>
  </main>;
}

function WoofScreen() {
  return <main className="v3-screen v3-woof">
    <Header title="Гав" detail="кто хочет гулять" />
    <section className="v3-woof-signal">
      <div className="v3-signal-rings"><span /><span /><span /><DogAvatar /></div>
      <div><span>Ваш сигнал выключен</span><h2>Дать Гав?</h2><p>Покажем Мяту подходящим собакам поблизости. Точный адрес останется скрыт.</p><button type="button"><span className="v3-wave">)))</span> Дать Гав</button></div>
    </section>
    <section className="v3-woof-list">
      <header><h2>Зовут гулять</h2><button type="button">Фильтры</button></header>
      <article><div className="v3-candidate-avatar luna">Л</div><div><b>Луна · 700 м</b><span>сегодня после 19:30</span><p>Спокойный темп · любит собак</p></div><button type="button">Откликнуться</button></article>
      <article><div className="v3-candidate-avatar rich">Р</div><div><b>Ричи · 1,4 км</b><span>завтра утром</span><p>Активная прогулка · парк</p></div><button type="button">Откликнуться</button></article>
    </section>
    <aside className="v3-privacy"><ShieldCheck weight="fill" /><span><b>Контакт — только по согласию</b><small>До совпадения видны только район и профиль собаки.</small></span></aside>
  </main>;
}

function ThingsScreen() {
  return <main className="v3-screen v3-things">
    <Header title="Вещи Мяты" detail="нужное и любимое" />
    <section className="v3-things-hero">
      <div><span>Скоро закончится</span><h2>Корм на 6 дней</h2><p>Последняя покупка — 14 августа</p><button type="button">Добавить в список <ArrowRight /></button></div>
      <div className="v3-food-pack"><PawPrint weight="fill" /><b>МЯТА</b><small>daily food</small></div>
    </section>
    <section className="v3-shelf">
      <header><h2>Нужно купить</h2><button type="button"><Plus weight="bold" /> Добавить</button></header>
      <div className="v3-shelf-track">
        <article className="thing mint"><div><Package weight="duotone" /></div><b>Корм</b><span>до 26 августа</span></article>
        <article className="thing rose"><div><FirstAid weight="duotone" /></div><b>Капли</b><span>до 3 сентября</span></article>
        <article className="thing lilac"><div><ShoppingBag weight="duotone" /></div><b>Игрушка</b><span>когда удобно</span></article>
      </div>
    </section>
    <section className="v3-favorites"><h2>Любимое Мяты</h2><button type="button"><Heart weight="fill" /><span><b>Мяч для прогулки</b><small>всегда берём в парк</small></span><CaretRight /></button><button type="button"><Package weight="duotone" /><span><b>Шлейка для долгих маршрутов</b><small>размер M · зелёная</small></span><CaretRight /></button></section>
  </main>;
}

function AssistantSheet({ onClose }: { onClose: () => void }) {
  return <div className="v3-assistant-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="v3-assistant-sheet" role="dialog" aria-modal="true" aria-labelledby="v3-assistant-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="v3-sheet-handle" />
      <header><div className="v3-assistant-mark"><Sparkle weight="fill" /></div><div><span>контекст: Мята</span><h2 id="v3-assistant-title">Спросить Псё</h2></div><button type="button" onClick={onClose} aria-label="Закрыть"><X weight="bold" /></button></header>
      <div className="v3-assistant-context"><DogAvatar small /><p>Я могу учесть профиль Мяты, её дела и добавленные документы. Не заменяю ветеринара.</p></div>
      <div className="v3-prompt-list"><button type="button">Что важно проверить по анализу?</button><button type="button">Подобрать спокойный маршрут</button><button type="button">Что учесть перед знакомством?</button></div>
      <label><input aria-label="Вопрос ассистенту" placeholder="Спроси о Мяте…" /><button type="button" aria-label="Отправить"><PaperPlaneTilt weight="fill" /></button></label>
    </section>
  </div>;
}

export default function DesignV3Page() {
  const [tab, setTab] = useState<Tab>('all');
  const [assistantOpen, setAssistantOpen] = useState(false);
  return <div className="v3-stage">
    {/* THESIS: Псё is a living orbit around the dog, not a feature directory. OWN-WORLD: Pouf Companion mint fields, tactile controls, authored dog-first compositions. STORY: recognize Mята, act once, discover life nearby. FIRST VIEWPORT: dog orbit, one care action, one live signal, assistant above nav. FORM: grounded dog-orbit structure, assigned surface seed 5acfa967. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. */}
    <div className="v3-phone">
      {tab === 'all' && <AllScreen />}
      {tab === 'dog' && <DogScreen />}
      {tab === 'map' && <MapScreen />}
      {tab === 'woof' && <WoofScreen />}
      {tab === 'things' && <ThingsScreen />}
      <button className="v3-floating-assistant" type="button" onClick={() => setAssistantOpen(true)} aria-label="Спросить Псё"><Sparkle weight="fill" /><span>Спросить</span></button>
      <nav className="v3-nav" aria-label="Разделы Псё">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}><Icon weight={tab === id ? 'fill' : 'duotone'} /><span>{label}</span></button>)}</nav>
      {assistantOpen && <AssistantSheet onClose={() => setAssistantOpen(false)} />}
    </div>
  </div>;
}
