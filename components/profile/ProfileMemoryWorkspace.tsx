'use client';

import type { ChangeEvent, CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CaretRight,
  CheckCircle,
  ClockCounterClockwise,
  Dog,
  FirstAid,
  ForkKnife,
  Info,
  Microphone,
  NotePencil,
  PawPrint,
  Pulse,
  ShieldCheck,
  Sparkle,
  UploadSimple,
  UsersThree,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { breedCatalog, type DogProfile } from '@/lib/data';
import styles from './ProfileMemoryWorkspace.module.css';

type Surface = 'overview' | 'health' | 'character' | 'social' | 'passport' | 'history' | 'capture';
type EditorDomain = 'health' | 'character' | 'social' | 'passport';
type ObservationPoint = { id: string; createdAt: string; mood?: string; appetite?: string; stool?: string; energy?: string; note?: string };
type DocumentPoint = { id: string; title: string; clinic?: string | null; originalName: string; createdAt: string };
type ReminderPoint = { id: string; title: string; status: string; dueAt: string; completedAt?: string };
type AvatarCapabilities = { identityEnabled: boolean; uploadsEnabled: boolean; generationEnabled: boolean; providerReady: boolean };

type Props = {
  profile: DogProfile;
  breedLabel: string;
  imageUrl: string;
  observations: ObservationPoint[];
  documents: DocumentPoint[];
  reminders: ReminderPoint[];
  voiceCapture: ReactNode;
  identityOpen: boolean;
  avatarCapabilities: AvatarCapabilities;
  avatarDraftUrl: string;
  avatarDraftSource: 'uploaded' | 'generated' | null;
  avatarState: 'idle' | 'rendering' | 'ready';
  avatarOwnerPrompt: string;
  avatarConsent: boolean;
  error?: string;
  onBack: () => void;
  onOpenIdentity: () => void;
  onCloseIdentity: () => void;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAvatarPromptChange: (value: string) => void;
  onAvatarConsentChange: (value: boolean) => void;
  onGenerateAvatar: () => void;
  onActivateAvatar: () => void;
  onDiscardAvatarDraft: () => void;
  onUseNoAvatar: () => void;
  onRollbackAvatar: () => void;
  onSaveProfile: (profile: DogProfile) => Promise<string | null>;
  onAddDocument: (trigger: HTMLButtonElement) => void;
  onAskAssistant: () => void;
};

function readableDate(value?: string) {
  if (!value) return 'дата не указана';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'дата не указана';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
}

function observationTitle(item?: ObservationPoint) {
  if (!item) return 'Псё пока учится понимать собаку';
  if (item.appetite && !/обыч|норм/i.test(item.appetite)) return `Аппетит: ${item.appetite}`;
  if (item.energy && !/обыч|норм/i.test(item.energy)) return `Энергия: ${item.energy}`;
  if (item.stool && !/обыч|норм/i.test(item.stool)) return `Пищеварение: ${item.stool}`;
  if (item.mood) return `Состояние: ${item.mood}`;
  return item.note || 'Добавлено новое наблюдение';
}

function observationDetail(item?: ObservationPoint) {
  if (!item) return 'Расскажи Псё о сегодняшнем состоянии — отдельную анкету заполнять не нужно.';
  const details = [item.appetite && `аппетит ${item.appetite}`, item.energy && `энергия ${item.energy}`, item.stool && `стул ${item.stool}`].filter(Boolean);
  return item.note || (details.length ? details.join(' · ') : 'Подтверждённое наблюдение владельца.');
}

function traitPosition(value: string, fallback = 50) {
  const text = value.toLowerCase();
  if (!text) return fallback;
  if (/осторож|тревож|мягк|спокой/.test(text)) return 36;
  if (/увер|общит|актив|легко|быстро/.test(text)) return 68;
  if (/независ|охран|упрям/.test(text)) return 78;
  return fallback;
}

function valueOrEmpty(value?: string, empty = 'Пока не заполнено') {
  return value?.trim() || empty;
}

function EditorField(props: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return <label className={styles.editorField}><span>{props.label}</span>{props.multiline
    ? <textarea value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} maxLength={800} />
    : <input value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} maxLength={180} />}</label>;
}

function EditorSelect(props: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className={styles.editorField}><span>{props.label}</span><select value={props.value} onChange={(event) => props.onChange(event.target.value)}><option value="">Не указано</option>{props.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

export function ProfileMemoryWorkspace(props: Props) {
  const [surface, setSurface] = useState<Surface>('overview');
  const [editor, setEditor] = useState<EditorDomain | null>(null);
  const [editorDraft, setEditorDraft] = useState<DogProfile | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const editorDialogRef = useRef<HTMLDialogElement | null>(null);
  const identityTriggerRef = useRef<HTMLButtonElement | null>(null);
  const editorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const latest = props.observations[0];
  const activeReminders = props.reminders.filter((item) => item.status !== 'completed' && item.status !== 'done');
  const hasIdentity = Boolean(props.imageUrl);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (props.identityOpen && !dialog.open) dialog.showModal();
    if (!props.identityOpen && dialog.open) dialog.close();
  }, [props.identityOpen]);

  useEffect(() => {
    const dialog = editorDialogRef.current;
    if (!dialog) return;
    if (editor && !dialog.open) dialog.showModal();
    if (!editor && dialog.open) dialog.close();
  }, [editor]);

  const history = useMemo(() => {
    const observations = props.observations.map((item) => ({
      id: `observation-${item.id}`,
      kind: 'health',
      date: item.createdAt,
      title: observationTitle(item),
      detail: observationDetail(item),
    }));
    const documents = props.documents.map((item) => ({
      id: `document-${item.id}`,
      kind: 'care',
      date: item.createdAt,
      title: item.title,
      detail: item.clinic || item.originalName,
    }));
    const reminders = props.reminders.filter((item) => item.completedAt).map((item) => ({
      id: `reminder-${item.id}`,
      kind: 'care',
      date: item.completedAt || item.dueAt,
      title: item.title,
      detail: 'Дело выполнено',
    }));
    return [...observations, ...documents, ...reminders]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }, [props.documents, props.observations, props.reminders]);

  const openIdentity = () => {
    identityTriggerRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    props.onOpenIdentity();
  };

  const closeIdentity = () => {
    props.onCloseIdentity();
    window.setTimeout(() => identityTriggerRef.current?.focus(), 0);
  };

  const openEditor = (domain: EditorDomain, trigger?: HTMLButtonElement | null) => {
    editorTriggerRef.current = trigger || (document.activeElement instanceof HTMLButtonElement ? document.activeElement : null);
    setEditorDraft({ ...props.profile, habits: props.profile.habits.map((habit) => ({ ...habit })) });
    setEditor(domain);
  };

  const closeEditor = () => {
    setEditor(null);
    setEditorDraft(null);
    window.setTimeout(() => editorTriggerRef.current?.focus(), 0);
  };

  const updateEditorProfile = (patch: Partial<DogProfile>) => setEditorDraft((current) => current ? { ...current, ...patch } : current);

  const saveEditor = async () => {
    if (editorSaving || !editorDraft) return;
    setEditorSaving(true);
    const saved = await props.onSaveProfile(editorDraft);
    setEditorSaving(false);
    if (saved) closeEditor();
  };

  const header = (title: string) => (
    <header className={styles.screenHeader}>
      <div className={styles.screenHeaderNav}>
        <button type="button" aria-label="Вернуться к обзору" onClick={() => setSurface('overview')}><ArrowLeft weight="bold" /></button>
        <span className={styles.dogContext}><span className={!hasIdentity ? styles.dogContextEmpty : ''}>{hasIdentity ? <img src={props.imageUrl} alt="" /> : <PawPrint weight="duotone" />}</span>{props.profile.dogName}</span>
      </div>
      <h1>{title}</h1>
    </header>
  );

  return (
    <section className={styles.stage} data-profile-memory data-surface={surface}>
      <div className={styles.phone}>
        <div className={styles.screen}>
          {surface === 'overview' && <>
            <header className={styles.overviewHeader}>
              <button type="button" aria-label="Вернуться на главную" onClick={props.onBack}><ArrowLeft weight="bold" /></button>
              <button className={styles.petSwitcherTrigger} type="button" onClick={openIdentity} aria-label={`Настроить образ ${props.profile.dogName}`}>
                <span className={!hasIdentity ? styles.petSwitcherEmpty : ''}>{hasIdentity ? <img src={props.imageUrl} alt="" /> : <PawPrint weight="duotone" />}</span>
                <b>{props.profile.dogName}</b><CaretRight weight="bold" />
              </button>
            </header>

            <section className={styles.livingHero}>
              <button ref={identityTriggerRef} type="button" className={`${styles.identityStage} ${styles.identityButton}`} onClick={openIdentity} aria-label={`Изменить фото или образ ${props.profile.dogName}`}>
                <div className={styles.identityCopy}>
                  <span className={styles.identityEyebrow}>Память о собаке</span>
                  <h1>{props.profile.dogName}</h1>
                  <p>{props.breedLabel}{props.profile.age ? ` · ${props.profile.age}` : props.profile.lifeStage ? ` · ${props.profile.lifeStage}` : ''}</p>
                  <span className={styles.identityPhrase}><PawPrint weight="fill" /> {valueOrEmpty(props.profile.bio || props.profile.habits[0]?.value, 'Добавить личную деталь')}</span>
                </div>
                <span className={`${styles.avatar} ${!hasIdentity ? styles.avatarEmpty : ''}`}>
                  {hasIdentity ? <img src={props.imageUrl} alt={`Фото ${props.profile.dogName}`} /> : <><PawPrint weight="duotone" /><b>Добавить образ</b></>}
                </span>
              </button>

              <article className={styles.nowRecord}>
                <div className={styles.nowHeading}>
                  <span><Pulse weight="bold" /></span>
                  <div><small>Псё заметил</small><h2>{observationTitle(latest)}</h2><p>{observationDetail(latest)}</p></div>
                </div>
                <div className={styles.freshness}><span>{latest ? 'Последние данные' : 'Данных пока мало'}</span><b>{latest ? readableDate(latest.createdAt) : 'добавить наблюдение'}</b></div>
                <button type="button" onClick={() => latest ? setSurface('health') : setSurface('capture')}><span>{latest ? 'Посмотреть основания' : 'Рассказать, как дела'}</span><ArrowRight weight="bold" /></button>
              </article>
            </section>

            <section className={styles.domainList} aria-labelledby="memory-title">
              <h2 id="memory-title">Память о {props.profile.dogName}</h2>
              <button type="button" onClick={() => setSurface('health')}><span className={latest ? styles.domainAttention : ''}><FirstAid weight="duotone" /></span><div><b>Здоровье</b><strong>{latest ? observationTitle(latest) : 'Наблюдений пока нет'}</strong><small>{latest ? `Обновлено ${readableDate(latest.createdAt)}` : 'Постоянные факты и динамика отдельно'}</small></div><CaretRight /></button>
              <button type="button" onClick={() => setSurface('character')}><span><Sparkle weight="duotone" /></span><div><b>Характер</b><strong>{valueOrEmpty(props.profile.temperament, 'Портрет только формируется')}</strong><small>{props.profile.energyLevel || props.profile.trainability ? 'Подтверждено владельцем' : 'Можно заполнить постепенно'}</small></div><CaretRight /></button>
              <button type="button" onClick={() => setSurface('social')}><span><UsersThree weight="duotone" /></span><div><b>С окружающими</b><strong>{valueOrEmpty(props.profile.socialMode, 'Правила знакомства не добавлены')}</strong><small>{props.profile.triggers ? 'Есть важные триггеры' : 'Ситуации и повадки по контексту'}</small></div><CaretRight /></button>
              <button type="button" onClick={() => setSurface('passport')}><span><Dog weight="duotone" /></span><div><b>Паспорт и внешность</b><strong>{props.breedLabel}</strong><small>{props.profile.microchip ? 'Микрочип добавлен' : 'Микрочип не добавлен'}</small></div><CaretRight /></button>
              <button type="button" onClick={() => setSurface('history')}><span><ClockCounterClockwise weight="duotone" /></span><div><b>История</b><strong>{history.length ? `${history.length} последних событий` : 'История пока пустая'}</strong><small>Наблюдения, документы и выполненные дела</small></div><CaretRight /></button>
            </section>

            <button type="button" className={styles.tellAction} onClick={() => setSurface('capture')}><span><Microphone weight="bold" /></span><div><b>Рассказать Псё</b><p>Обычная фраза превратится в проверяемые факты, а не в мусор заметок.</p></div><CaretRight /></button>
          </>}

          {surface === 'health' && <section className={styles.domainSurface}>
            {header('Здоровье')}
            <article className={styles.attentionRecord}>
              <div>{latest ? <WarningCircle weight="fill" /> : <Info weight="fill" />}<h2>{latest ? observationTitle(latest) : 'Начнём с личной нормы'}</h2></div>
              <p>{latest ? observationDetail(latest) : 'Псё отделяет постоянные медицинские факты от наблюдений во времени и не делает выводов без данных.'}</p>
              <button type="button" onClick={() => setSurface('capture')}>Добавить новое наблюдение <ArrowRight /></button>
            </article>
            <p className={styles.evidence}><ShieldCheck weight="fill" /> {latest ? `Данные обновлены ${readableDate(latest.createdAt)} · источник: владелец` : 'Пока недостаточно данных для сравнения с личной нормой'}</p>
            <section className={styles.measureSection}><h2>Показатели</h2><div className={styles.measureStrip}>
              <article><span>Аппетит</span><b>{valueOrEmpty(latest?.appetite, 'Нет данных')}</b><small>{latest ? readableDate(latest.createdAt) : '—'}</small></article>
              <article><span>Вес</span><b>{valueOrEmpty(props.profile.weight, 'Не указан')}</b><small>Постоянный профиль</small></article>
              <article><span>Энергия</span><b>{valueOrEmpty(latest?.energy || props.profile.energyLevel, 'Нет данных')}</b><small>{latest?.energy ? readableDate(latest.createdAt) : 'Профиль'}</small></article>
            </div></section>
            <section className={styles.systemList}><h2>Системы</h2>
              <div><i className={`${styles.systemState} ${latest?.appetite || latest?.stool ? styles.system_watch : styles.system_stale}`} /><div><b>Пищеварение</b><strong>{latest?.appetite || latest?.stool ? [latest.appetite, latest.stool].filter(Boolean).join(' · ') : 'Наблюдений нет'}</strong><small>Аппетит, вода, стул и рвота</small></div></div>
              <div><i className={`${styles.systemState} ${props.profile.healthNotes ? styles.system_watch : styles.system_stale}`} /><div><b>Кожа и шерсть</b><strong>{valueOrEmpty(props.profile.healthNotes, 'Наблюдений нет')}</strong><small>Зуд, покраснения и изменения шерсти</small></div></div>
              <div><i className={`${styles.systemState} ${latest?.energy ? styles.system_ok : styles.system_stale}`} /><div><b>Движение</b><strong>{valueOrEmpty(latest?.energy, 'Наблюдений нет')}</strong><small>Походка, боль и выносливость</small></div></div>
            </section>
            <section className={styles.longTerm}><h2>Постоянные данные</h2>
              <div><span>Аллергии</span><b>{valueOrEmpty(props.profile.allergies, 'Не указаны')}</b></div>
              <div><span>Лекарства</span><b>{valueOrEmpty(props.profile.medication, 'Нет активных')}</b></div>
              <div><span>Прививки</span><b>{valueOrEmpty(props.profile.vaccineStatus, 'Статус не указан')}</b></div>
              <div><span>Обработки</span><b>{valueOrEmpty(props.profile.parasiteStatus, 'Статус не указан')}</b></div>
              <div><span>Документы</span><b>{props.documents.length ? `${props.documents.length} в истории` : 'Пока нет'}</b></div>
            </section>
            <div className={styles.domainActions}><button className={styles.primaryAction} type="button" onClick={() => setSurface('capture')}><NotePencil /> Добавить наблюдение</button><button className={styles.secondaryAction} type="button" data-profile-memory-action="add-document" onClick={(event) => props.onAddDocument(event.currentTarget)}><UploadSimple /> Добавить документ</button><button className={styles.secondaryAction} type="button" onClick={(event) => openEditor('health', event.currentTarget)}><FirstAid /> Изменить постоянные данные</button></div>
          </section>}

          {surface === 'character' && <section className={styles.domainSurface}>
            {header('Характер')}
            <article className={styles.characterPortrait}><h2>{valueOrEmpty(props.profile.temperament, `Портрет ${props.profile.dogName} формируется`)}</h2><p>{props.profile.bio || 'Характер — полустабильный портрет. Одно утро не переписывает его автоматически.'}</p></article>
            <p className={styles.evidence}><ShieldCheck weight="fill" /> {props.profile.temperament ? 'Подтверждено владельцем' : 'Нужны примеры из разных ситуаций'}</p>
            <section className={styles.traits}><h2>Грани характера</h2>
              {[
                ['Уверенность', props.profile.temperament, 'осторожный', 'смелый'],
                ['Общительность', props.profile.socialMode, 'сам по себе', 'ко всем'],
                ['Возбуждение', props.profile.energyLevel, 'ровный', 'возбудимый'],
                ['Обучаемость', props.profile.trainability, 'нужна мотивация', 'быстро схватывает'],
              ].map(([label, value, from, to]) => <div className={styles.traitRow} key={label}><button type="button" onClick={(event) => openEditor('character', event.currentTarget)}><span>{label}</span><b>{valueOrEmpty(value)}</b><CaretRight /></button><div className={styles.traitAxis} style={{ '--position': `${traitPosition(value)}%` } as CSSProperties}><i /><span>{from}</span><span>{to}</span></div></div>)}
            </section>
            <section className={styles.motivators}><h2>Что помогает</h2><div><b>Стиль игры</b><span>{valueOrEmpty(props.profile.playStyle)}</span></div><div><b>Оставаться одному</b><span>{valueOrEmpty(props.profile.aloneTime)}</span></div></section>
            <p className={styles.domainNote}><Info /> Устойчивое изменение Псё предложит подтвердить — профиль не меняется молча.</p>
            <button className={styles.primaryAction} type="button" onClick={(event) => openEditor('character', event.currentTarget)}><NotePencil /> Уточнить портрет</button>
          </section>}

          {surface === 'social' && <section className={styles.domainSurface}>
            {header('С окружающими')}
            <article className={styles.socialIntro}><h2>Как знакомиться с {props.profile.dogName}</h2><p>{valueOrEmpty(props.profile.socialMode, 'Правило контакта пока не указано.')}</p><button type="button" onClick={(event) => openEditor('social', event.currentTarget)}>Изменить правило</button></article>
            <section className={styles.patternGroup}><h2>Люди и животные</h2>
              <article><div><b>Дети</b><strong>{valueOrEmpty(props.profile.childFriendly)}</strong><small>Подтверждено владельцем</small></div></article>
              <article><div><b>Собаки</b><strong>{valueOrEmpty(props.profile.dogFriendly)}</strong><small>Контекст важнее общей оценки</small></div></article>
              <article><div><b>Кошки</b><strong>{valueOrEmpty(props.profile.catFriendly)}</strong><small>Контекст важнее общей оценки</small></div></article>
            </section>
            <section className={styles.patternGroup}><h2>Триггеры и помощь</h2><article><div><b>Что может напрячь</b><strong>{valueOrEmpty(props.profile.triggers)}</strong><small>Сохраняется как правило безопасности</small></div></article>{props.profile.habits.map((habit) => <article key={habit.id}><div><b>{habit.title}</b><strong>{habit.value}</strong><small>Слова владельца</small></div></article>)}</section>
            <p className={styles.domainNote}><Info /> Повадка хранится как контекст → реакция → что помогает, а не как ярлык «хорошо/плохо».</p>
            <button className={styles.primaryAction} type="button" onClick={(event) => openEditor('social', event.currentTarget)}><NotePencil /> Уточнить повадки</button>
          </section>}

          {surface === 'passport' && <section className={styles.domainSurface}>
            {header('Паспорт и внешность')}
            <div className={styles.passportIdentity}><button type="button" className={`${styles.passportPhoto} ${styles.passportPhotoButton}`} onClick={openIdentity}>{hasIdentity ? <img src={props.imageUrl} alt={`Фото ${props.profile.dogName}`} /> : <span><PawPrint weight="duotone" />Добавить образ</span>}</button><div><h2>{props.profile.dogName}</h2><p>{props.breedLabel}</p><span>{valueOrEmpty(props.profile.sex, 'Пол не указан')} · {valueOrEmpty(props.profile.age || props.profile.lifeStage, 'Возраст не указан')}</span></div></div>
            <section className={styles.passportFacts}><header><h2>Основное</h2><button type="button" onClick={(event) => openEditor('passport', event.currentTarget)}>Редактировать</button></header>
              <div><span>Порода</span><b>{props.breedLabel}</b></div><div><span>Вес</span><b>{valueOrEmpty(props.profile.weight)}</b></div><div><span>Размер</span><b>{valueOrEmpty(props.profile.size)}</b></div><div><span>Шерсть</span><b>{valueOrEmpty(props.profile.coatType)}</b></div><div><span>Окрас</span><b>{valueOrEmpty(props.profile.colorMarks)}</b></div><div><span>Микрочип</span><b>{valueOrEmpty(props.profile.microchip)}</b></div><div><span>Клиника</span><b>{valueOrEmpty(props.profile.vetClinic)}</b></div>
            </section>
            <button className={styles.primaryAction} type="button" onClick={(event) => openEditor('passport', event.currentTarget)}><NotePencil /> Изменить постоянные данные</button>
          </section>}

          {surface === 'history' && <section className={styles.domainSurface}>
            {header('История')}
            {history.length ? <div className={styles.timeline}>{history.map((item) => <article key={item.id}><i className={item.kind === 'health' ? styles.timeline_health : styles.timeline_care} /><time>{readableDate(item.date)}</time><h2>{item.title}</h2><p>{item.detail}</p></article>)}</div> : <article className={styles.emptyHistory}><ClockCounterClockwise /><h2>История пока пустая</h2><p>Наблюдения, документы и выполненные дела появятся здесь автоматически.</p></article>}
            <button className={styles.primaryAction} type="button" onClick={() => setSurface('capture')}><Microphone /> Рассказать Псё</button>
          </section>}

          {surface === 'capture' && <section className={styles.captureSurface}>
            {header('Рассказать Псё')}
            <div className={styles.captureIntro}><h2>Говори как обычно</h2><p>Псё сначала покажет, какие факты нашло. Ничего не попадёт в память без подтверждения.</p></div>
            <div className={styles.voiceCaptureSlot}>{props.voiceCapture}</div>
            <p className={styles.atomicNote}><ShieldCheck /> Постоянный факт, наблюдение и повадка сохраняются раздельно. Неподтверждённое не влияет на выводы.</p>
            <button type="button" className={styles.secondaryAction} onClick={props.onAskAssistant}>Обсудить ситуацию с ассистентом</button>
          </section>}
        </div>
      </div>

      <dialog ref={dialogRef} className={styles.identityDialog} aria-labelledby="identity-dialog-title" onCancel={(event) => { event.preventDefault(); closeIdentity(); }} onClose={() => { if (props.identityOpen) props.onCloseIdentity(); }}>
        <div className={styles.identitySheet}>
          <header><div><h2 id="identity-dialog-title">Образ {props.profile.dogName}</h2><p>Выбери фото, создай художественный образ или оставь профиль без изображения.</p></div><button type="button" aria-label="Закрыть" onClick={closeIdentity}><X weight="bold" /></button></header>
          {props.avatarDraftUrl && props.avatarDraftSource && <section className={styles.identityPreview}><img src={props.avatarDraftUrl} alt="Предпросмотр нового образа" /><div><b>{props.avatarDraftSource === 'uploaded' ? 'Фото готово' : 'Черновик готов'}</b><p>Текущий образ не изменится, пока ты не подтвердишь выбор.</p></div><button type="button" className={styles.identityPrimary} onClick={props.onActivateAvatar}>Использовать этот образ</button><button type="button" className={styles.identityQuiet} onClick={props.onDiscardAvatarDraft}>Не использовать</button></section>}
          {!props.avatarDraftUrl && <div className={styles.identityChoices}>
            <label className={!props.avatarCapabilities.uploadsEnabled ? styles.isDisabled : ''}><input type="file" disabled={!props.avatarCapabilities.uploadsEnabled} accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={props.onPhotoChange} /><UploadSimple weight="bold" /><span><b>Использовать фото</b><small>{props.avatarCapabilities.uploadsEnabled ? 'Приватная загрузка · до 8 МБ' : 'Загрузка пока недоступна'}</small></span><CaretRight /></label>
            {props.avatarCapabilities.generationEnabled ? <details><summary><Sparkle weight="bold" /><span><b>Создать образ</b><small>Добровольный художественный вариант</small></span><CaretRight /></summary><div className={styles.generatorForm}><label htmlFor="profile-avatar-prompt">Каким должен быть образ</label><textarea id="profile-avatar-prompt" value={props.avatarOwnerPrompt} onChange={(event) => props.onAvatarPromptChange(event.target.value)} maxLength={280} placeholder="Например, сохранить белое пятно на груди" /><label className={styles.identityConsent}><input type="checkbox" checked={props.avatarConsent} onChange={(event) => props.onAvatarConsentChange(event.target.checked)} /><span>Разрешаю передать описание и выбранное фото сервису генерации. Это художественный образ, не точная копия.</span></label><button type="button" className={styles.identityPrimary} disabled={!props.avatarConsent || props.avatarState === 'rendering'} onClick={props.onGenerateAvatar}>{props.avatarState === 'rendering' ? 'Создаю черновик…' : 'Создать черновик'}</button></div></details> : <div className={styles.identityUnavailable} aria-label="Создание образа пока недоступно"><Sparkle weight="bold" /><span><b>Создать образ</b><small>Появится после подключения генератора изображений</small></span></div>}
            <button type="button" onClick={props.onUseNoAvatar}><PawPrint weight="bold" /><span><b>Без изображения</b><small>Нейтральный профиль без случайной собаки</small></span><CaretRight /></button>
          </div>}
          {props.error && <p className={styles.identityError} role="alert">{props.error}</p>}
          <footer>{props.profile.avatarSource !== 'none' && <button type="button" onClick={props.onRollbackAvatar}><ClockCounterClockwise /> Вернуть предыдущий</button>}<p><ShieldCheck /> Фото хранится приватно и не публикуется автоматически.</p></footer>
        </div>
      </dialog>

      <dialog ref={editorDialogRef} className={styles.editorDialog} aria-labelledby="profile-editor-title" onCancel={(event) => { event.preventDefault(); closeEditor(); }} onClose={() => { if (editor) setEditor(null); }}>
        {editor && editorDraft && <form className={styles.editorSheet} onSubmit={(event) => { event.preventDefault(); void saveEditor(); }}>
          <header><div><h2 id="profile-editor-title">{editor === 'health' ? 'Здоровье и уход' : editor === 'character' ? 'Характер' : editor === 'social' ? 'С окружающими' : 'Паспорт и внешность'}</h2><p>Изменения относятся только к {props.profile.dogName} и сохраняются в её приватном профиле.</p></div><button type="button" aria-label="Закрыть редактор" onClick={closeEditor}><X weight="bold" /></button></header>

          <div className={styles.editorFields}>
            {editor === 'health' && <>
              <EditorField label="Питание" value={editorDraft.diet} onChange={(diet) => updateEditorProfile({ diet })} placeholder="Корм, режим, что нельзя" />
              <EditorField label="Аллергии и непереносимости" value={editorDraft.allergies} onChange={(allergies) => updateEditorProfile({ allergies })} placeholder="Если есть" />
              <EditorField label="Лекарства и курсы" value={editorDraft.medication} onChange={(medication) => updateEditorProfile({ medication })} placeholder="Название, режим — только со слов владельца" />
              <EditorField label="Ветклиника" value={editorDraft.vetClinic} onChange={(vetClinic) => updateEditorProfile({ vetClinic })} placeholder="Клиника, врач, телефон" />
              <EditorSelect label="Прививки" value={editorDraft.vaccineStatus} options={['актуально', 'скоро нужно', 'просрочено', 'не знаю']} onChange={(vaccineStatus) => updateEditorProfile({ vaccineStatus })} />
              <EditorSelect label="Обработка от паразитов" value={editorDraft.parasiteStatus} options={['актуально', 'скоро нужно', 'просрочено', 'не знаю']} onChange={(parasiteStatus) => updateEditorProfile({ parasiteStatus })} />
              <EditorField label="Важное о здоровье" value={editorDraft.healthNotes} onChange={(healthNotes) => updateEditorProfile({ healthNotes })} placeholder="Хронические состояния, операции, важные инструкции" multiline />
            </>}

            {editor === 'character' && <>
              <EditorSelect label="Темперамент" value={editorDraft.temperament} options={['осторожный', 'уверенный', 'мягкий', 'самостоятельный', 'общительный']} onChange={(temperament) => updateEditorProfile({ temperament })} />
              <EditorSelect label="Энергия" value={editorDraft.energyLevel} options={['спокойная', 'умеренная', 'активная', 'очень активная']} onChange={(energyLevel) => updateEditorProfile({ energyLevel })} />
              <EditorSelect label="Обучаемость" value={editorDraft.trainability} options={['нужна мотивация', 'постепенно осваивает', 'быстро схватывает']} onChange={(trainability) => updateEditorProfile({ trainability })} />
              <EditorField label="Как любит играть" value={editorDraft.playStyle} onChange={(playStyle) => updateEditorProfile({ playStyle })} placeholder="Нюховые игры, перетяжки, бег…" />
              <EditorField label="Как остаётся один" value={editorDraft.aloneTime} onChange={(aloneTime) => updateEditorProfile({ aloneTime })} placeholder="Что помогает успокоиться" />
              <EditorField label="Личная деталь" value={editorDraft.bio} onChange={(bio) => updateEditorProfile({ bio })} placeholder="То, что узнают близкие" multiline />
            </>}

            {editor === 'social' && <>
              <EditorSelect label="Как начинать знакомство" value={editorDraft.socialMode} options={['сначала спросить владельца', 'можно подойти спокойно', 'лучше держать дистанцию', 'контакт не нужен']} onChange={(socialMode) => updateEditorProfile({ socialMode })} />
              <EditorSelect label="С детьми" value={editorDraft.childFriendly} options={['спокойно', 'осторожно', 'нужна дистанция', 'не знаю']} onChange={(childFriendly) => updateEditorProfile({ childFriendly })} />
              <EditorSelect label="С собаками" value={editorDraft.dogFriendly} options={['дружелюбно', 'только спокойные собаки', 'нужна дистанция', 'не знаю']} onChange={(dogFriendly) => updateEditorProfile({ dogFriendly })} />
              <EditorSelect label="С кошками" value={editorDraft.catFriendly} options={['спокойно', 'интересуется', 'нужна дистанция', 'не знаю']} onChange={(catFriendly) => updateEditorProfile({ catFriendly })} />
              <EditorField label="Триггеры" value={editorDraft.triggers} onChange={(triggers) => updateEditorProfile({ triggers })} placeholder="Самокаты, резкие звуки, тесный лифт…" multiline />
            </>}

            {editor === 'passport' && <>
              <EditorField label="Имя" value={editorDraft.dogName} onChange={(dogName) => updateEditorProfile({ dogName })} />
              <label className={styles.editorField}><span>Порода</span><select value={editorDraft.breedId} onChange={(event) => { const breed = breedCatalog.find((item) => item.id === event.target.value); if (breed) updateEditorProfile({ breedId: breed.id, breedGroupId: breed.groupId }); }}>{breedCatalog.map((breed) => <option key={breed.id} value={breed.id}>{breed.title}</option>)}</select></label>
              {editorDraft.breedId === 'custom' && <EditorField label="Своя порода или тип" value={editorDraft.breedCustom} onChange={(breedCustom) => updateEditorProfile({ breedCustom })} placeholder="Как вы называете породу" />}
              <EditorField label="Возраст или дата рождения" value={editorDraft.age} onChange={(age) => updateEditorProfile({ age })} placeholder="Например, 3 года или 12.05.2023" />
              <EditorSelect label="Пол" value={editorDraft.sex} options={['сука', 'кобель']} onChange={(sex) => updateEditorProfile({ sex })} />
              <EditorSelect label="Стерилизация" value={editorDraft.neutered} options={['да', 'нет', 'не знаю']} onChange={(neutered) => updateEditorProfile({ neutered })} />
              <EditorField label="Вес" value={editorDraft.weight} onChange={(weight) => updateEditorProfile({ weight })} placeholder="Например, 8,4 кг" />
              <EditorSelect label="Размер" value={editorDraft.size} options={['миниатюрный', 'маленький', 'средний', 'крупный', 'очень крупный']} onChange={(size) => updateEditorProfile({ size })} />
              <EditorField label="Шерсть" value={editorDraft.coatType} onChange={(coatType) => updateEditorProfile({ coatType })} placeholder="Короткая, длинная, почти без шерсти…" />
              <EditorField label="Окрас и особые отметины" value={editorDraft.colorMarks} onChange={(colorMarks) => updateEditorProfile({ colorMarks })} placeholder="Белое пятно на груди…" />
              <EditorField label="Микрочип" value={editorDraft.microchip} onChange={(microchip) => updateEditorProfile({ microchip })} placeholder="Номер или не установлен" />
            </>}
          </div>

          {props.error && <p className={styles.editorError} role="alert">{props.error}</p>}
          <footer><button type="button" className={styles.editorCancel} onClick={closeEditor}>Отмена</button><button type="submit" className={styles.editorSave} disabled={editorSaving || !editorDraft.dogName.trim()}>{editorSaving ? 'Сохраняю…' : 'Сохранить'}</button></footer>
        </form>}
      </dialog>
    </section>
  );
}
