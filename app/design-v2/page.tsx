'use client';

import Image from 'next/image';
import { Geologica, Manrope } from 'next/font/google';
import {
  ArrowRight,
  BellSimple,
  Check,
  CheckCircle,
  Clock,
  FirstAidKit,
  Heart,
  House,
  MapPin,
  NotePencil,
  PawPrint,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkle,
  UsersThree,
} from '@phosphor-icons/react';
import { useState } from 'react';
import styles from './styles.module.css';

const display = Geologica({ subsets: ['cyrillic', 'latin'], variable: '--font-display' });
const body = Manrope({ subsets: ['cyrillic', 'latin'], variable: '--font-body' });

type Tab = 'today' | 'dog' | 'map' | 'nearby' | 'things';

const tabs: Array<{ id: Tab; label: string; icon: typeof House }> = [
  { id: 'today', label: 'всё', icon: House },
  { id: 'dog', label: 'псё', icon: PawPrint },
  { id: 'map', label: 'карта', icon: MapPin },
  { id: 'nearby', label: 'рядом', icon: UsersThree },
  { id: 'things', label: 'вещи', icon: ShoppingBag },
];

function TodayScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  return (
    <div className={styles.screen}>
      <section className={styles.todayHero}>
        <div className={styles.greeting}>
          <p>Добрый вечер, Руслан</p>
          <h1>У Груши всё спокойно</h1>
        </div>
        <div className={styles.heroPhoto}>
          <Image src="/design-v2/grusha.jpg" alt="Золотистый ретривер Груша" fill priority sizes="(max-width: 760px) 100vw, 520px" />
          <div className={styles.photoWash} />
          <div className={styles.dogSignature} aria-hidden="true">Груша</div>
        </div>
      </section>

      <section className={styles.nextAction}>
        <div className={styles.timeMark}>
          <Clock weight="bold" />
          <span>21:00</span>
        </div>
        <div>
          <h2>Таблетка после еды</h2>
          <p>Можно отметить до 22:00</p>
        </div>
        <button type="button" aria-label="Отметить дело выполненным">
          <Check weight="bold" />
        </button>
      </section>

      <div className={styles.quickActions} aria-label="Быстрые действия">
        <button type="button"><NotePencil weight="bold" /><span>Записать</span></button>
        <button type="button"><BellSimple weight="bold" /><span>Дело</span></button>
        <button type="button" onClick={() => onNavigate('map')}><MapPin weight="bold" /><span>Место</span></button>
      </div>

      <section className={styles.dayFlow}>
        <div className={styles.sectionTitle}>
          <h2>Сегодня</h2>
          <button type="button">Весь план <ArrowRight weight="bold" /></button>
        </div>
        <div className={styles.timeline}>
          <article>
            <span className={styles.timelineIcon}><CheckCircle weight="fill" /></span>
            <div><time>08:30</time><h3>Утренняя прогулка</h3><p>45 минут · парк у дома</p></div>
          </article>
          <article>
            <span className={styles.timelineIcon}><FirstAidKit weight="fill" /></span>
            <div><time>14:10</time><h3>Самочувствие</h3><p>Аппетит хороший, настроение бодрое</p></div>
          </article>
          <article className={styles.timelineMuted}>
            <span className={styles.timelineIcon}><Clock weight="fill" /></span>
            <div><time>Завтра</time><h3>Обработка от клещей</h3><p>Утром после завтрака</p></div>
          </article>
        </div>
      </section>
    </div>
  );
}

function DogScreen() {
  return (
    <div className={styles.screen}>
      <section className={styles.profileHero}>
        <div className={styles.profilePhoto}>
          <Image src="/design-v2/grusha.jpg" alt="Груша" fill sizes="(max-width: 760px) 52vw, 260px" />
        </div>
        <div className={styles.profileCopy}>
          <span>3 года · золотистый ретривер</span>
          <h1>Груша</h1>
          <p>Ласковая, любит воду и спокойно знакомится после разрешения.</p>
          <button type="button">Изменить профиль</button>
        </div>
      </section>

      <section className={styles.intentSection}>
        <h2>Что нужно Груше?</h2>
        <div className={styles.intentGrid}>
          <button type="button"><BellSimple weight="duotone" /><b>Запланировать уход</b><span>Лекарства, груминг, врачи</span></button>
          <button type="button"><NotePencil weight="duotone" /><b>Записать важное</b><span>Самочувствие и привычки</span></button>
          <button type="button"><ShieldCheck weight="duotone" /><b>Поделиться карточкой</b><span>Только выбранные данные</span></button>
          <button type="button"><UsersThree weight="duotone" /><b>Найти компанию</b><span>Прогулка или знакомство</span></button>
        </div>
      </section>

      <section className={styles.factStrip} aria-label="Коротко о собаке">
        <article><span>Вес</span><strong>28 кг</strong><p>стабильно</p></article>
        <article><span>Энергия</span><strong>Средняя</strong><p>любит долгие прогулки</p></article>
        <article><span>Контакт</span><strong>Спокойно</strong><p>сначала спросить</p></article>
      </section>

      <section className={styles.plainList}>
        <button type="button"><span><Heart weight="fill" /> Здоровье и питание</span><ArrowRight /></button>
        <button type="button"><span><PawPrint weight="fill" /> Характер и привычки</span><ArrowRight /></button>
        <button type="button"><span><ShieldCheck weight="fill" /> Документы и доступ</span><ArrowRight /></button>
      </section>
    </div>
  );
}

function NearbyScreen() {
  return (
    <div className={styles.screen}>
      <section className={styles.nearbyIntro}>
        <div>
          <h1>Собаки рядом</h1>
          <p>Без точных адресов. Контакт откроется только после взаимного согласия.</p>
        </div>
        <button type="button" className={styles.visibilitySwitch} aria-pressed="true">
          <span><b>Груша видна</b><small>прогулка · знакомство</small></span>
          <i><span /></i>
        </button>
      </section>

      <section className={styles.discoveryBand}>
        <MapPin weight="fill" />
        <div><span>Сначала ищем близко</span><strong>до 15 км · Москва</strong></div>
        <button type="button">Изменить</button>
      </section>

      <section className={styles.candidates}>
        <div className={styles.sectionTitle}><h2>Можно познакомиться</h2><span>2 собаки</span></div>
        <article className={styles.candidate}>
          <div className={styles.candidatePhoto}><Image src="/design-v2/luna.jpg" alt="Собака Луна" fill sizes="96px" /></div>
          <div><span>4–6 км · Хамовники</span><h3>Луна, 2 года</h3><p>Обе любят спокойные прогулки и воду</p></div>
          <button type="button">Познакомиться <ArrowRight weight="bold" /></button>
        </article>
        <article className={styles.candidate}>
          <div className={styles.candidatePhoto}><Image src="/design-v2/archie.jpg" alt="Собака Арчи" fill sizes="96px" /></div>
          <div><span>В вашем городе</span><h3>Арчи, 4 года</h3><p>Совпадает цель: социализация</p></div>
          <button type="button">Познакомиться <ArrowRight weight="bold" /></button>
        </article>
      </section>

      <section className={styles.inviteFriend}>
        <div className={styles.inviteMark}><Sparkle weight="fill" /></div>
        <div><h2>Уже знакомы?</h2><p>Отправь личную ссылку. Расстояние и фильтры не помешают найти друг друга.</p></div>
        <button type="button">Позвать друга</button>
      </section>
    </div>
  );
}

function MapScreen() {
  return (
    <div className={styles.screen}>
      <section className={styles.mapHeading}><h1>Свои места</h1><p>Точные точки видны только тебе.</p></section>
      <section className={styles.mapCanvas} aria-label="Предпросмотр карты">
        <div className={styles.parkShape} />
        <div className={`${styles.road} ${styles.roadOne}`} />
        <div className={`${styles.road} ${styles.roadTwo}`} />
        <span className={`${styles.mapPin} ${styles.pinOne}`}><PawPrint weight="fill" /></span>
        <span className={`${styles.mapPin} ${styles.pinTwo}`}><Heart weight="fill" /></span>
        <div className={styles.mapDog}><Image src="/design-v2/grusha.jpg" alt="" fill sizes="58px" /></div>
        <button type="button" className={styles.mapAdd}><Plus weight="bold" /> Сохранить место</button>
      </section>
      <section className={styles.placeList}>
        <article><span><PawPrint weight="fill" /></span><div><h3>Нескучный сад</h3><p>тихо утром · есть вода</p></div><ArrowRight /></article>
        <article><span><Heart weight="fill" /></span><div><h3>Ветеринарная клиника</h3><p>круглосуточно · 12 минут</p></div><ArrowRight /></article>
      </section>
    </div>
  );
}

function ThingsScreen() {
  return (
    <div className={styles.screen}>
      <section className={styles.thingsHeading}>
        <div><h1>Вещи Груши</h1><p>Купить, не забыть, заменить.</p></div>
        <button type="button"><Plus weight="bold" /></button>
      </section>
      <section className={styles.priorityThing}>
        <div className={styles.thingVisual}><ShoppingBag weight="duotone" /></div>
        <div><span>Скоро закончится</span><h2>Средство от клещей</h2><p>Нужно до следующей обработки</p></div>
        <button type="button">Купить</button>
      </section>
      <section className={styles.checkList}>
        <h2>Остальное</h2>
        <label><input type="checkbox" defaultChecked /><span><b>Пакеты для прогулки</b><small>куплено</small></span></label>
        <label><input type="checkbox" /><span><b>Новая адресная бирка</b><small>без спешки</small></span></label>
        <label><input type="checkbox" /><span><b>Мяч для воды</b><small>к летним прогулкам</small></span></label>
      </section>
    </div>
  );
}

export default function DesignV2Page() {
  const [tab, setTab] = useState<Tab>('today');
  return (
    <main className={`${styles.page} ${display.variable} ${body.variable}`}>
      <div className={styles.phone}>
        <header className={styles.header}>
          <button className={styles.wordmark} type="button" onClick={() => setTab('today')} aria-label="На главный экран">псё</button>
          <button className={styles.dogPicker} type="button">
            <span className={styles.pickerPhoto}><Image src="/design-v2/grusha.jpg" alt="" fill sizes="36px" /></span>
            <span>Груша</span>
          </button>
        </header>

        <div className={styles.content}>
          {tab === 'today' && <TodayScreen onNavigate={setTab} />}
          {tab === 'dog' && <DogScreen />}
          {tab === 'map' && <MapScreen />}
          {tab === 'nearby' && <NearbyScreen />}
          {tab === 'things' && <ThingsScreen />}
        </div>

        <nav className={styles.nav} aria-label="Основные разделы">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" className={tab === item.id ? styles.navActive : ''} onClick={() => setTab(item.id)} aria-current={tab === item.id ? 'page' : undefined}>
                <Icon weight={tab === item.id ? 'fill' : 'bold'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
