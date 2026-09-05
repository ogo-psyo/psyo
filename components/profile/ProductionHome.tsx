'use client';

import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  CalendarCheck,
  CaretRight,
  ChatCircleDots,
  Check,
  FirstAid,
  MapTrifold,
  Microphone,
  PawPrint,
  ShieldCheck,
  ShoppingBag,
  UsersThree,
} from '@phosphor-icons/react';
import styles from './ProductionHome.module.css';

type Route = 'today' | 'profile' | 'map' | 'nearby' | 'things' | 'calendar' | 'health';
type Observation = {
  id: string;
  createdAt: string;
  mood?: string;
  appetite?: string;
  stool?: string;
  energy?: string;
  note?: string;
};

type Scenario = 'health' | 'care' | 'social' | 'handoff' | null;

export function ProductionHome({
  dogName,
  breedLabel,
  avatar,
  careTitle,
  careDetail,
  careActionLabel,
  recommendationSlot,
  observations,
  voiceCapture,
  onNavigate,
  onCareAction,
  onOpenCare,
  onOpenCard,
  onAskAssistant,
  onCaptureOpenChange,
}: {
  dogName: string;
  breedLabel: string;
  avatar: ReactNode;
  careTitle: string;
  careDetail: string;
  careActionLabel: string;
  recommendationSlot: ReactNode;
  observations: Observation[];
  voiceCapture: ReactNode;
  onNavigate: (route: Route) => void;
  onCareAction: () => void;
  onOpenCare: () => void;
  onOpenCard: () => void;
  onAskAssistant: () => void;
  onCaptureOpenChange?: (open: boolean) => void;
}) {
  const [scenario, setScenario] = useState<Scenario>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const latest = [...observations].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  const latestDate = latest ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(latest.createdAt)) : null;
  const todaySummary = latest?.note || latest?.mood || 'Сегодняшнее состояние ещё не отмечено';
  const metrics = [
    ['Настроение', latest?.mood],
    ['Аппетит', latest?.appetite],
    ['Пищеварение', latest?.stool],
    ['Энергия', latest?.energy],
  ];

  const openCapture = () => {
    setScenario(null);
    setCaptureOpen(true);
    onCaptureOpenChange?.(true);
  };

  const closeCapture = () => {
    setCaptureOpen(false);
    onCaptureOpenChange?.(false);
  };

  return <main className={styles.home} data-production-home data-production-journey="today">
    <header className={styles.header}>
      <span className={styles.brand} aria-label="Псё"><span aria-hidden="true"><PawPrint weight="fill" /></span>Псё</span>
      <button className={styles.identity} type="button" onClick={() => onNavigate('profile')} aria-label={`Открыть профиль ${dogName}`}>
        <span className={styles.avatar}>{avatar}</span>
        <span><b>{dogName}</b><small>{breedLabel}</small></span>
        <CaretRight weight="bold" />
      </button>
    </header>

    <section className={styles.today} aria-labelledby="today-title" data-home-today>
      <div className={styles.todayCopy}>
        <p>{latestDate ? `Последняя запись · ${latestDate}` : 'Нужна первая отметка'}</p>
        <h1 id="today-title">Как {dogName}<br />сегодня?</h1>
        <strong>{todaySummary}</strong>
      </div>
      <div className={styles.todayPortrait} aria-hidden="true">{avatar}</div>
      <button type="button" className={styles.checkinButton} onClick={openCapture} aria-expanded={captureOpen} data-home-primary>
        <Microphone weight="bold" />
        <span><b>{latest ? 'Записать новое наблюдение' : 'Отметить самочувствие'}</b><small>20–30 секунд · можно голосом</small></span>
        <ArrowRight weight="bold" />
      </button>
    </section>

    {captureOpen && <section className={styles.capture} aria-label="Быстрое наблюдение" data-home-capture>
      <header><div><h2>Самочувствие сейчас</h2><p>Расскажите обычной фразой — перед сохранением всё можно проверить.</p></div><button type="button" onClick={closeCapture}>Закрыть</button></header>
      {voiceCapture}
    </section>}

    {!captureOpen && <>
      <section className={styles.nextAction} aria-labelledby="next-action-title">
        <span className={styles.sectionLabel}>Ближайший шаг</span>
        <div><span className={styles.actionIcon}><CalendarCheck weight="duotone" /></span><div><h2 id="next-action-title">{careTitle}</h2><p>{careDetail}</p></div></div>
        <button type="button" onClick={onCareAction}>{careActionLabel}<ArrowRight weight="bold" /></button>
      </section>

      <div className={styles.secondaryActions} aria-label="Другие действия" data-home-secondary>
        <button type="button" onClick={onAskAssistant}><ChatCircleDots weight="duotone" /><span><b>Спросить о {dogName}</b><small>Ответ с учётом профиля</small></span><CaretRight /></button>
        <button type="button" onClick={onOpenCare}><CalendarCheck weight="duotone" /><span><b>План ухода</b><small>Календарь и напоминания</small></span><CaretRight /></button>
      </div>

      <section className={styles.recommendation} aria-label="Рекомендация Псё">{recommendationSlot}</section>

      <section className={styles.scenarios} aria-labelledby="scenarios-title" data-home-scenarios>
        <header><div><h2 id="scenarios-title">Псё поможет разобраться</h2><p>Выберите ситуацию — откроется объяснение и нужный раздел.</p></div><button type="button" onClick={onAskAssistant}>Спросить своими словами</button></header>
        <div className={styles.scenarioList}>
          <button type="button" aria-expanded={scenario === 'health'} onClick={() => setScenario(scenario === 'health' ? null : 'health')}><FirstAid weight="duotone" /><span><b>Изменилось самочувствие</b><small>Сохранить признаки и сравнить с историей</small></span><CaretRight /></button>
          {scenario === 'health' && <article><p>Сначала зафиксируем наблюдение, затем покажем историю и контекст для разговора с ветеринаром.</p><div><button type="button" onClick={openCapture}>Записать наблюдение</button><button type="button" onClick={() => onNavigate('health')}>Открыть историю</button></div></article>}
          <button type="button" aria-expanded={scenario === 'care'} onClick={() => setScenario(scenario === 'care' ? null : 'care')}><CalendarCheck weight="duotone" /><span><b>Организовать уход</b><small>Сроки, повторы и выполненные дела</small></span><CaretRight /></button>
          {scenario === 'care' && <article><p>Календарь собирает ближайшие дела, повторения и историю выполнения в одном месте.</p><div><button type="button" onClick={onOpenCare}>Открыть календарь</button></div></article>}
          <button type="button" aria-expanded={scenario === 'social'} onClick={() => setScenario(scenario === 'social' ? null : 'social')}><UsersThree weight="duotone" /><span><b>Найти компанию на прогулку</b><small>Карта «Гав» и активные сигналы рядом</small></span><CaretRight /></button>
          {scenario === 'social' && <article><p>В «Гав» сначала видна карта примерных зон. Точный адрес и контакт скрыты до взаимного согласия.</p><div><button type="button" onClick={() => onNavigate('nearby')}>Открыть карту «Гав»</button><button type="button" onClick={() => onNavigate('map')}>Мои места</button></div></article>}
          <button type="button" aria-expanded={scenario === 'handoff'} onClick={() => setScenario(scenario === 'handoff' ? null : 'handoff')}><ShieldCheck weight="duotone" /><span><b>Передать собаку другому</b><small>Безопасная памятка без личной истории</small></span><CaretRight /></button>
          {scenario === 'handoff' && <article><p>Выберите только нужные правила ухода и отправьте отдельную ссылку. Личные записи останутся закрыты.</p><div><button type="button" onClick={onOpenCard}>Подготовить памятку</button><button type="button" onClick={() => onNavigate('things')}><ShoppingBag /> Собрать вещи</button></div></article>}
        </div>
      </section>

      <section className={styles.snapshot} aria-labelledby="snapshot-title" data-home-snapshot>
        <header><div><h2 id="snapshot-title">Состояние {dogName}</h2><p>{latestDate ? `По записи от ${latestDate}` : 'Заполните первый check-in'}</p></div><button type="button" onClick={() => onNavigate('profile')}>Вся память <ArrowRight /></button></header>
        <div>{metrics.map(([label, value]) => <span key={label}><small>{label}</small><b>{value || 'Нет данных'}</b>{value && <Check weight="bold" />}</span>)}</div>
        <small>Псё показывает ваши наблюдения и не заменяет ветеринара.</small>
      </section>
    </>}
  </main>;
}
