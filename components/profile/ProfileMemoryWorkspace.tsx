'use client';

import type { ChangeEvent, CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
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
import {
  breedCatalog,
  energyOptions,
  friendlinessOptions,
  lifeStageOptions,
  parasiteOptions,
  playStyleOptions,
  sexOptions,
  socialOptions,
  temperamentOptions,
  vaccineOptions,
  type DogProfile,
} from '@/lib/data';
import styles from './ProfileMemoryWorkspace.module.css';

type Surface = 'overview' | 'character' | 'social' | 'passport' | 'history' | 'capture';
type EditorDomain = 'character' | 'social' | 'passport';
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
  onOpenDocument: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  documentBusyId?: string | null;
  onAskAssistant: () => void;
  onOpenPlan: () => void;
  onOpenHealth: () => void;
  onOpenHabits: () => void;
  onOpenCard: () => void;
  onOpenSettings: () => void;
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
      entityId: item.id,
      entityKind: 'observation' as const,
      kind: 'health',
      date: item.createdAt,
      title: observationTitle(item),
      detail: observationDetail(item),
    }));
    const documents = props.documents.map((item) => ({
      id: `document-${item.id}`,
      entityId: item.id,
      entityKind: 'document' as const,
      kind: 'care',
      date: item.createdAt,
      title: item.title,
      detail: item.clinic || item.originalName,
    }));
    const reminders = props.reminders.filter((item) => item.completedAt).map((item) => ({
      id: `reminder-${item.id}`,
      entityId: item.id,
      entityKind: 'reminder' as const,
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
                  <h1>{props.profile.dogName}</h1>
                  <p>{props.breedLabel}{props.profile.lifeStage ? ` · ${props.profile.lifeStage}` : ''}</p>
                  <span className={styles.identityPhrase}><PawPrint weight="fill" /> {valueOrEmpty(props.profile.temperament || props.profile.playStyle, 'Добавить характер')}</span>
                </div>
                <span className={`${styles.avatar} ${!hasIdentity ? styles.avatarEmpty : ''}`}>
                  {hasIdentity ? <img src={props.imageUrl} alt={`Фото ${props.profile.dogName}`} /> : <><b className={styles.avatarMonogram}>{props.profile.dogName.trim().slice(0, 1).toLocaleUpperCase('ru-RU') || 'П'}</b><PawPrint weight="duotone" /><small>добавить образ</small></>}
                </span>
              </button>

              <article className={styles.nowRecord} aria-label="Вывод Псё">
                <div className={styles.nowHeading}>
                  <span><Pulse weight="bold" /></span>
                  <div><h2>{observationTitle(latest)}</h2><p>{observationDetail(latest)}</p></div>
                </div>
                <div className={styles.freshness}><span>{latest ? 'Последние данные' : 'Данных пока мало'}</span><b>{latest ? readableDate(latest.createdAt) : 'добавить наблюдение'}</b></div>
                <button type="button" onClick={() => latest ? props.onOpenHealth() : setSurface('capture')}><span>{latest ? 'Посмотреть основания' : 'Рассказать, как дела'}</span><ArrowRight weight="bold" /></button>
              </article>
            </section>

            <section className={styles.domainList} aria-labelledby="memory-title">
              <h2 id="memory-title">Память о {props.profile.dogName}</h2>
              <button type="button" onClick={props.onOpenHealth}><span className={latest ? styles.domainAttention : ''}><FirstAid weight="duotone" /></span><div><b>Здоровье</b><strong>{latest ? observationTitle(latest) : 'Наблюдений пока нет'}</strong><small>{latest ? `Обновлено ${readableDate(latest.createdAt)}` : 'Постоянные факты и динамика отдельно'}</small></div><CaretRight /></button>
              <button type="button" onClick={() => setSurface('character')}><span><Sparkle weight="duotone" /></span><div><b>Характер</b><strong>{valueOrEmpty(props.profile.temperament, 'Портрет только формируется')}</strong><small>{props.profile.energyLevel || props.profile.trainability ? 'Подтверждено владельцем' : 'Можно заполнить постепенно'}</small></div><CaretRight /></button>
              <button type="button" onClick={() => setSurface('social')}><span><UsersThree weight="duotone" /></span><div><b>С окружающими</b><strong>{valueOrEmpty(props.profile.socialMode, 'Правила знакомства не добавлены')}</strong><small>{props.profile.triggers ? 'Есть важные триггеры' : 'Ситуации и повадки по контексту'}</small></div><CaretRight /></button>
              <button type="button" onClick={() => setSurface('passport')}><span><Dog weight="duotone" /></span><div><b>Паспорт и внешность</b><strong>{props.breedLabel}</strong><small>{props.profile.microchip ? 'Микрочип добавлен' : 'Микрочип не добавлен'}</small></div><CaretRight /></button>
              <button type="button" onClick={() => setSurface('history')}><span><ClockCounterClockwise weight="duotone" /></span><div><b>История</b><strong>{history.length ? `${history.length} последних событий` : 'История пока пустая'}</strong><small>Наблюдения, документы и выполненные дела</small></div><CaretRight /></button>
            </section>

            <section className={styles.domainList} aria-labelledby="care-tools-title">
              <h2 id="care-tools-title">Дела и доступ</h2>
              <button type="button" onClick={props.onOpenPlan}><span><CalendarCheck weight="duotone" /></span><div><b>План заботы</b><strong>{activeReminders.length ? `${activeReminders.length} в плане` : 'Добавить первое дело'}</strong><small>Даты, переносы и история выполнения</small></div><CaretRight /></button>
              <button type="button" onClick={props.onOpenHabits}><span><Pulse weight="duotone" /></span><div><b>Повторяемые привычки</b><strong>Прогулки, кормление и занятия</strong><small>Отдельно от особенностей характера</small></div><CaretRight /></button>
              <button type="button" data-profile-memory-action="add-document" onClick={(event) => props.onAddDocument(event.currentTarget)}><span><UploadSimple weight="duotone" /></span><div><b>Документы</b><strong>{props.documents.length ? `${props.documents.length} в истории` : 'Добавить первый документ'}</strong><small>Анализы, назначения и вакцинации</small></div><CaretRight /></button>
              <button type="button" onClick={props.onOpenCard}><span><ShieldCheck weight="duotone" /></span><div><b>Памятка</b><strong>Что увидит другой человек</strong><small>Публично ничего не открывается само</small></div><CaretRight /></button>
              <button type="button" onClick={props.onOpenSettings}><span><Info weight="duotone" /></span><div><b>Настройки и приватность</b><strong>Аккаунт, данные и поддержка</strong><small>Удаление, правила и помощь</small></div><CaretRight /></button>
            </section>

            <button type="button" className={styles.tellAction} onClick={() => setSurface('capture')}><span><Microphone weight="bold" /></span><div><b>Рассказать Псё</b><p>Обычная фраза превратится в проверяемые факты, а не в мусор заметок.</p></div><CaretRight /></button>
          </>}

          {surface === 'character' && <section className={styles.domainSurface}>
            {header('Характер')}
            <article className={styles.characterPortrait}><h2>{valueOrEmpty(props.profile.temperament, `Портрет ${props.profile.dogName} формируется`)}</h2><p>{props.profile.playStyle || 'Характер — устойчивый портрет со слов владельца. Одно наблюдение не переписывает его автоматически.'}</p></article>
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
            <div className={styles.passportIdentity}><button type="button" className={`${styles.passportPhoto} ${styles.passportPhotoButton}`} onClick={openIdentity}>{hasIdentity ? <img src={props.imageUrl} alt={`Фото ${props.profile.dogName}`} /> : <span><PawPrint weight="duotone" />Добавить образ</span>}</button><div><h2>{props.profile.dogName}</h2><p>{props.breedLabel}</p><span>{valueOrEmpty(props.profile.sex, 'Пол не указан')} · {valueOrEmpty(props.profile.lifeStage, 'Возрастная группа не указана')}</span></div></div>
            <section className={styles.passportFacts}><header><h2>Основное</h2><button type="button" onClick={(event) => openEditor('passport', event.currentTarget)}>Редактировать</button></header>
              <div><span>Порода</span><b>{props.breedLabel}</b></div><div><span>Возрастная группа</span><b>{valueOrEmpty(props.profile.lifeStage)}</b></div><div><span>Пол</span><b>{valueOrEmpty(props.profile.sex)}</b></div><div><span>Вес</span><b>{valueOrEmpty(props.profile.weight)}</b></div><div><span>Микрочип</span><b>{valueOrEmpty(props.profile.microchip)}</b></div><div><span>Клиника</span><b>{valueOrEmpty(props.profile.vetClinic)}</b></div>
            </section>
            <button className={styles.primaryAction} type="button" onClick={(event) => openEditor('passport', event.currentTarget)}><NotePencil /> Изменить постоянные данные</button>
          </section>}

          {surface === 'history' && <section className={styles.domainSurface}>
            {header('История')}
            {history.length ? <div className={styles.timeline}>{history.map((item) => <article key={item.id}><i className={item.kind === 'health' ? styles.timeline_health : styles.timeline_care} /><time>{readableDate(item.date)}</time><h2>{item.title}</h2><p>{item.detail}</p>{item.entityKind === 'document' && <div className={styles.timelineActions}><button type="button" onClick={() => props.onOpenDocument(item.entityId)}>Открыть</button><button type="button" className={styles.timelineDanger} disabled={props.documentBusyId === item.entityId} onClick={() => props.onDeleteDocument(item.entityId)}>{props.documentBusyId === item.entityId ? 'Удаляю…' : 'Удалить'}</button></div>}</article>)}</div> : <article className={styles.emptyHistory}><ClockCounterClockwise /><h2>История пока пустая</h2><p>Наблюдения, документы и выполненные дела появятся здесь автоматически.</p></article>}
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
          {props.avatarDraftUrl && props.avatarDraftSource && <section className={styles.identityPreview}><img src={props.avatarDraftUrl} alt="Предпросмотр нового образа" /><div><b>{props.avatarDraftSource === 'uploaded' ? 'Фото готово' : 'Черновик готов'}</b><p>Текущий образ не изменится, пока ты не подтвердишь выбор.</p></div><button type="button" className={styles.identityPrimary} onClick={props.onActivateAvatar}>{props.avatarDraftSource === 'uploaded' ? 'Использовать фото' : 'Использовать этот образ'}</button>{props.avatarDraftSource === 'uploaded' && props.avatarCapabilities.generationEnabled && <details><summary><Sparkle weight="bold" /><span><b>Стилизовать фото</b><small>Сохраним черты собаки и изменим подачу</small></span><CaretRight /></summary><div className={styles.generatorForm}><label htmlFor="profile-avatar-edit-prompt">Что изменить</label><textarea id="profile-avatar-edit-prompt" value={props.avatarOwnerPrompt} onChange={(event) => props.onAvatarPromptChange(event.target.value)} maxLength={280} placeholder="Например, нарисованный журнальный портрет" /><label className={styles.identityConsent}><input type="checkbox" checked={props.avatarConsent} onChange={(event) => props.onAvatarConsentChange(event.target.checked)} /><span>Разрешаю передать выбранное фото и описание сервису генерации.</span></label><button type="button" className={styles.identityPrimary} disabled={!props.avatarConsent || props.avatarState === 'rendering'} onClick={props.onGenerateAvatar}>{props.avatarState === 'rendering' ? 'Стилизую…' : 'Стилизовать фото'}</button></div></details>}<button type="button" className={styles.identityQuiet} onClick={props.onDiscardAvatarDraft}>Не использовать</button></section>}
          {!props.avatarDraftUrl && <div className={styles.identityChoices}>
            <label className={!props.avatarCapabilities.uploadsEnabled ? styles.isDisabled : ''}><input type="file" disabled={!props.avatarCapabilities.uploadsEnabled} accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={props.onPhotoChange} /><UploadSimple weight="bold" /><span><b>Использовать фото</b><small>{props.avatarCapabilities.uploadsEnabled ? 'Приватная загрузка · до 8 МБ' : 'Загрузка пока недоступна'}</small></span><CaretRight /></label>
            {props.avatarCapabilities.generationEnabled ? <details><summary><Sparkle weight="bold" /><span><b>Создать образ</b><small>По описанию из профиля</small></span><CaretRight /></summary><div className={styles.generatorForm}><label htmlFor="profile-avatar-prompt">Каким должен быть образ</label><textarea id="profile-avatar-prompt" value={props.avatarOwnerPrompt} onChange={(event) => props.onAvatarPromptChange(event.target.value)} maxLength={280} placeholder="Например, сохранить белое пятно на груди" /><label className={styles.identityConsent}><input type="checkbox" checked={props.avatarConsent} onChange={(event) => props.onAvatarConsentChange(event.target.checked)} /><span>Разрешаю передать описание сервису генерации.</span></label><button type="button" className={styles.identityPrimary} disabled={!props.avatarConsent || props.avatarState === 'rendering'} onClick={props.onGenerateAvatar}>{props.avatarState === 'rendering' ? 'Создаю черновик…' : 'Создать образ'}</button></div></details> : <div className={styles.identityUnavailable} aria-label="Создание образа пока недоступно"><Sparkle weight="bold" /><span><b>Создать образ</b><small>Появится после подключения генератора изображений</small></span></div>}
            <button type="button" onClick={props.onUseNoAvatar}><PawPrint weight="bold" /><span><b>Без изображения</b><small>Нейтральный профиль без случайной собаки</small></span><CaretRight /></button>
          </div>}
          {props.error && <p className={styles.identityError} role="alert">{props.error}</p>}
          <footer>{props.profile.avatarSource !== 'none' && <button type="button" onClick={props.onRollbackAvatar}><ClockCounterClockwise /> Вернуть предыдущий</button>}<p><ShieldCheck /> Фото хранится приватно и не публикуется автоматически.</p></footer>
        </div>
      </dialog>

      <dialog ref={editorDialogRef} className={styles.editorDialog} aria-labelledby="profile-editor-title" onCancel={(event) => { event.preventDefault(); closeEditor(); }} onClose={() => { if (editor) setEditor(null); }}>
        {editor && editorDraft && <form className={styles.editorSheet} onSubmit={(event) => { event.preventDefault(); void saveEditor(); }}>
          <header><div><h2 id="profile-editor-title">{editor === 'character' ? 'Характер' : editor === 'social' ? 'С окружающими' : 'Паспорт и внешность'}</h2><p>Изменения относятся только к {props.profile.dogName} и сохраняются в её приватном профиле.</p></div><button type="button" aria-label="Закрыть редактор" onClick={closeEditor}><X weight="bold" /></button></header>

          <div className={styles.editorFields}>
            {editor === 'character' && <>
              <EditorSelect label="Темперамент" value={editorDraft.temperament} options={[...temperamentOptions]} onChange={(temperament) => updateEditorProfile({ temperament })} />
              <EditorSelect label="Энергия" value={editorDraft.energyLevel} options={[...energyOptions]} onChange={(energyLevel) => updateEditorProfile({ energyLevel })} />
              <EditorSelect label="Обучаемость" value={editorDraft.trainability} options={['нужна мотивация', 'постепенно осваивает', 'быстро схватывает']} onChange={(trainability) => updateEditorProfile({ trainability })} />
              <EditorSelect label="Как любит играть" value={editorDraft.playStyle} options={[...playStyleOptions]} onChange={(playStyle) => updateEditorProfile({ playStyle })} />
              <EditorField label="Как остаётся один" value={editorDraft.aloneTime} onChange={(aloneTime) => updateEditorProfile({ aloneTime })} placeholder="Что помогает успокоиться" />
            </>}

            {editor === 'social' && <>
              <EditorSelect label="Как начинать знакомство" value={editorDraft.socialMode} options={[...socialOptions]} onChange={(socialMode) => updateEditorProfile({ socialMode })} />
              <EditorSelect label="С детьми" value={editorDraft.childFriendly} options={[...friendlinessOptions]} onChange={(childFriendly) => updateEditorProfile({ childFriendly })} />
              <EditorSelect label="С собаками" value={editorDraft.dogFriendly} options={[...friendlinessOptions]} onChange={(dogFriendly) => updateEditorProfile({ dogFriendly })} />
              <EditorSelect label="С кошками" value={editorDraft.catFriendly} options={[...friendlinessOptions]} onChange={(catFriendly) => updateEditorProfile({ catFriendly })} />
              <EditorField label="Триггеры" value={editorDraft.triggers} onChange={(triggers) => updateEditorProfile({ triggers })} placeholder="Самокаты, резкие звуки, тесный лифт…" multiline />
            </>}

            {editor === 'passport' && <>
              <EditorField label="Имя" value={editorDraft.dogName} onChange={(dogName) => updateEditorProfile({ dogName })} />
              <label className={styles.editorField}><span>Порода</span><select value={editorDraft.breedId} onChange={(event) => { const breed = breedCatalog.find((item) => item.id === event.target.value); if (breed) updateEditorProfile({ breedId: breed.id, breedGroupId: breed.groupId }); }}>{breedCatalog.map((breed) => <option key={breed.id} value={breed.id}>{breed.title}</option>)}</select></label>
              {editorDraft.breedId === 'custom' && <EditorField label="Своя порода или тип" value={editorDraft.breedCustom} onChange={(breedCustom) => updateEditorProfile({ breedCustom })} placeholder="Как вы называете породу" />}
              <EditorSelect label="Возрастная группа" value={editorDraft.lifeStage} options={[...lifeStageOptions]} onChange={(lifeStage) => updateEditorProfile({ lifeStage })} />
              <EditorSelect label="Пол" value={editorDraft.sex} options={[...sexOptions]} onChange={(sex) => updateEditorProfile({ sex })} />
              <EditorField label="Вес" value={editorDraft.weight} onChange={(weight) => updateEditorProfile({ weight })} placeholder="Например, 8,4 кг" />
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
