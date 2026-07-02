'use client';

import { ChangeEvent, type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { GeneratedAvatar } from '@/components/GeneratedAvatar';
import { LiveMap } from '@/components/LiveMap';
import { FloatingNote, PaperSheet, WatercolorScreen } from '@/components/watercolor';
import {
  anchorCards,
  avatarStyles,
  breedCatalog,
  breedGroups,
  buildAvatarPrompt,
  coatOptions,
  defaultProfile,
  energyOptions,
  friendlinessOptions,
  getBreedGroup,
  getBreedLabel,
  getBreedCare,
  getAvatarStyle,
  lifeStageOptions,
  maxPhotos,
  nearbyDogs,
  parasiteOptions,
  playStyleOptions,
  sexOptions,
  sizeOptions,
  socialOptions,
  temperamentOptions,
  vaccineOptions,
  type AvatarStyleId,
  type BreedGroupId,
  type BreedId,
  type DogProfile,
} from '@/lib/data';
import { getSupabaseBrowser } from '@/lib/clientSupabase';
import { formatCount, formatReadinessLabel, formatReminderGroupLine, formatTodayTitle, formatWishlistMeta, formatZoneMeta, inflectPetName } from '@/lib/copy';
import { fileToLocalAvatarDataUrl, filesToPhotos, loadProfile, resetProfileStorage, saveProfile } from '@/lib/profileStorage';
import { buildAppReadiness, type ReadinessLevel } from '@/lib/readiness';
import type { ActionSuggestion } from '@/packages/contracts';

type AvatarState = 'idle' | 'rendering' | 'ready';
type Notice = 'idle' | 'saved' | 'copied' | 'loaded' | 'sharing' | 'downloaded' | 'applied';
type AuthUiState = 'idle' | 'sending' | 'sent' | 'rate_limited' | 'retryable_error';
type OnboardingStage = 'intro' | 'photo' | 'style' | 'generating' | 'reveal' | 'done';
type ReminderView = { id: string; petId: string; type: string; title: string; dueAt: string; status: string; snoozedUntil?: string; completedAt?: string };
type WishlistView = { id: string; petId: string; title: string; category: string; reason?: string; url?: string; priority: string; status: string; created_at?: string };
type ZoneView = { id: string; pet_id?: string; petId?: string; type: string; title: string; note?: string; approximate_lat?: number | string | null; approximate_lng?: number | string | null; radius_meters?: number; radiusMeters?: number; created_at?: string };
type MapFeatureView = { id: string; type: 'point' | 'route'; title: string; lat?: number | null; lng?: number | null; zone_type?: string | null; path?: { type?: string; coordinates?: number[][] } | null; visibility: 'private' | 'shared' | 'public' };
type PetSwitchOption = { id: string; name: string; breed_id?: string; breed_group_id?: string; avatar_url?: string; photo_urls?: string[] };
type AuthSession = { access_token: string; user: { email?: string } };
type ObservationView = { id: string; petId?: string; mood: string; appetite: string; stool: string; energy: string; note?: string; createdAt: string; syncStatus?: 'local' | 'saved' };
type ObservationDraft = Pick<ObservationView, 'mood' | 'appetite' | 'stool' | 'energy' | 'note'>;
type Tab = 'today' | 'calendar' | 'assistant' | 'nearby' | 'map' | 'card' | 'profile' | 'things';
type MapLayer = 'personal' | 'community';
type DrawMode = 'none' | 'point' | 'route';
type ViralCardFormat = 'story' | 'square' | 'poster';
type ViralCardMood = 'soft' | 'bold' | 'safety' | 'club';
type ViralFactKey = 'social' | 'energy' | 'care' | 'triggers' | 'area' | 'breed';
type PublicCardFieldKey = 'breed' | 'character' | 'triggers' | 'area';
type PublicCardCheck = { label: string; done: boolean; missing: string };
type OnboardingCareChoice = { type: string; title: string; dueInDays: number; label: string; dueLabel: string };
type TelegramSessionView = { mode: 'loading' | 'browser' | 'telegram' | 'error'; psyoUserId?: string; ownerId?: string; firstName?: string; username?: string; message?: string };
type TelegramWebApp = {
  initData?: string;
  platform?: string;
  colorScheme?: 'light' | 'dark';
  ready?: () => void;
  expand?: () => void;
  enableClosingConfirmation?: () => void;
  openTelegramLink?: (url: string) => void;
  HapticFeedback?: { impactOccurred?: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const styleOptions = avatarStyles.slice(0, 4);
const onboardingKey = 'pso.topapp.onboarding.v1';
const observationsStorageKey = 'pso.topapp.observations.v1';
const heroStyleOptions = avatarStyles.filter((style) => ['city', 'space', 'sticker'].includes(style.id));
const viralFactOrder: ViralFactKey[] = ['social', 'energy', 'care', 'triggers', 'area', 'breed'];
const defaultPublicCardFields: PublicCardFieldKey[] = ['breed', 'character', 'triggers', 'area'];
const publicCardFieldOptions: { key: PublicCardFieldKey; label: string; detail: string }[] = [
  { key: 'breed', label: 'Порода', detail: 'помогает узнать собаку' },
  { key: 'character', label: 'Характер', detail: 'ритм и темперамент' },
  { key: 'triggers', label: 'Что не делать', detail: 'важно для безопасности' },
  { key: 'area', label: 'Район', detail: 'только район, без адреса' },
];

const observationMoodOptions = ['спокойное', 'радостное', 'тревожное', 'вялое'];
const observationAppetiteOptions = ['обычный', 'ниже обычного', 'выше обычного', 'не ела'];
const observationStoolOptions = ['обычный', 'мягкий', 'жидкий', 'не было'];
const observationEnergyOptions = ['обычная', 'много', 'мало', 'сонная'];
const defaultObservationDraft: ObservationDraft = {
  mood: observationMoodOptions[0],
  appetite: observationAppetiteOptions[0],
  stool: observationStoolOptions[0],
  energy: observationEnergyOptions[0],
  note: '',
};

const viralCardFormats: { id: ViralCardFormat; label: string; caption: string; size: string }[] = [
  { id: 'story', label: 'История', caption: 'вертикально для Telegram и Instagram', size: '1080x1920' },
  { id: 'square', label: 'Квадрат', caption: 'карточка для ленты', size: '1080x1080' },
  { id: 'poster', label: 'Плакат', caption: 'для печати или профиля', size: '1200x1600' },
];

const viralCardMoods: { id: ViralCardMood; label: string; caption: string }[] = [
  { id: 'bold', label: 'Герой', caption: 'ярко, мемно, заметно' },
  { id: 'soft', label: 'Тёплая', caption: 'мягкая памятка о собаке' },
  { id: 'safety', label: 'Правила', caption: 'для прогулки и догситтера' },
  { id: 'club', label: 'Клуб', caption: 'премиальный бейдж' },
];

const viralMoodTheme: Record<ViralCardMood, { bg: string; fg: string; muted: string; accent: string; soft: string; label: string }> = {
  bold: { bg: '#17112a', fg: '#fff8e7', muted: '#d9c8ff', accent: '#7ee7d2', soft: '#ff8a5b', label: 'PSYO HERO CARD' },
  soft: { bg: '#fff4d7', fg: '#25192f', muted: '#6f5f6f', accent: '#ff8a5b', soft: '#a7eadf', label: 'PSYO CARE CARD' },
  safety: { bg: '#f4fbf3', fg: '#18251f', muted: '#557063', accent: '#1d927d', soft: '#ffc75d', label: 'DOG WALK RULES' },
  club: { bg: '#111513', fg: '#f7f0df', muted: '#b7c4b8', accent: '#d7ff6f', soft: '#f0a37b', label: 'PSYO KENNEL CLUB' },
};

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">не указано</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function ChoiceBubbles({ label, value, options, onChange, hint }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void; hint?: string }) {
  return (
    <section className="choice-bubble-field" aria-label={label}>
      <div><b>{label}</b>{hint && <p>{hint}</p>}</div>
      <div className="choice-bubble-row">
        {options.map((option) => <button key={option} type="button" className={value === option ? 'active' : ''} onClick={() => onChange(option)} aria-pressed={value === option}>{option}</button>)}
      </div>
    </section>
  );
}

function SuggestionBubbles({ label, options, onPick }: { label: string; options: string[]; onPick: (value: string) => void }) {
  return (
    <div className="suggestion-bubbles" aria-label={label}>
      {options.map((option) => <button key={option} type="button" onClick={() => onPick(option)}>{option}</button>)}
    </div>
  );
}

function MiniMetric({ label, value, fallback = '—' }: { label: string; value?: string; fallback?: string }) {
  return <div className="mini-metric"><span>{label}</span><b>{value || fallback}</b></div>;
}

function ObservationChoice({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div className="observation-choice" aria-label={label}>
      <b>{label}</b>
      <div>
        {options.map((option) => <button key={option} type="button" className={value === option ? 'active' : ''} onClick={() => onChange(option)} aria-pressed={value === option}>{option}</button>)}
      </div>
    </div>
  );
}

function TaskCard({ emoji, title, caption, action, onClick }: { emoji: string; title: string; caption: string; action: string; onClick?: () => void }) {
  return <article className="task-card"><span>{emoji}</span><div><b>{title}</b><p>{caption}</p></div><button onClick={onClick}>{action}</button></article>;
}

function AssistantActionButtons({ actions, onApply }: { actions: ActionSuggestion[]; onApply: (action: ActionSuggestion) => void }) {
  if (!actions.length) return null;
  return (
    <div className="assistant-action-buttons" aria-label="Предложенные действия ассистента">
      {actions.map((action, index) => (
        <button key={`${action.type}-${index}`} type="button" onClick={() => onApply(action)}>
          {action.humanLabel}
        </button>
      ))}
    </div>
  );
}

function ReadinessBadge({ level }: { level: ReadinessLevel }) {
  return <span className={`readiness-badge ${level}`}>{formatReadinessLabel(level)}</span>;
}

function TelegramPill({ session }: { session: TelegramSessionView }) {
  const label = session.mode === 'loading' ? 'проверяю…' : session.mode === 'telegram' ? 'Telegram' : session.mode === 'error' ? 'вход не готов' : 'без Telegram';
  return <span className={`telegram-pill mode-${session.mode}`}>{label}</span>;
}

function fromDbEnum(value: unknown, map: Record<string, string>) {
  const normalized = String(value || '').trim();
  return map[normalized] ?? normalized;
}

const dbVaccineStatusMap: Record<string, string> = {
  actual: 'актуально',
  due_soon: 'скоро нужно',
  overdue: 'просрочено',
  unknown: 'не знаю',
};

const dbParasiteStatusMap: Record<string, string> = {
  actual: 'актуально',
  needs_reminder: 'поставить напоминание',
  overdue: 'просрочено',
  unknown: 'не знаю',
};

const dbSocialModeMap: Record<string, string> = {
  ok: 'можно знакомиться',
  ask_first: 'сначала спросить',
  calm_dogs_only: 'только спокойные собаки',
  do_not_approach: 'лучше не подходить',
  known_only: 'только свои',
};

const dbFriendlinessMap: Record<string, string> = {
  yes: 'да',
  careful: 'осторожно',
  no: 'нет',
  unknown: 'не знаю',
};

const socialModeDisplayMap: Record<string, string> = {
  ok: 'можно знакомиться',
  ask_first: 'сначала спросить',
  calm_dogs_only: 'только спокойные собаки',
  do_not_approach: 'лучше не подходить',
  known_only: 'только свои',
};

function displaySocialMode(value?: string) {
  const clean = String(value || '').trim();
  return socialModeDisplayMap[clean] ?? clean;
}

function safePublicArea(value?: string) {
  const clean = String(value || '').trim();
  if (!clean) return 'район скрыт';
  const looksExact = /\d/.test(clean) && /(ул\.?|улиц|дом|д\.|кв\.?|корп|подъезд|просп|пер\.?|street|avenue|apt|flat)/i.test(clean);
  return looksExact ? 'район скрыт' : clean.slice(0, 80);
}

const careTypeOptions = [
  { value: 'custom', label: 'Другое' },
  { value: 'parasite', label: 'Обработка' },
  { value: 'vaccine', label: 'Вакцина' },
  { value: 'grooming', label: 'Груминг' },
  { value: 'food', label: 'Корм' },
  { value: 'training', label: 'Тренировка' },
  { value: 'vet', label: 'Ветеринар' },
];

const onboardingCareOptions: OnboardingCareChoice[] = [
  { type: 'parasite', title: 'Обработка от клещей и паразитов', dueInDays: 30, label: 'Обработка', dueLabel: 'через 30 дней' },
  { type: 'vaccine', title: 'Проверить дату вакцинации', dueInDays: 7, label: 'Вакцина', dueLabel: 'через неделю' },
  { type: 'grooming', title: 'Груминг: шерсть и когти', dueInDays: 14, label: 'Груминг', dueLabel: 'через 2 недели' },
];

function careTypeLabel(type: string) {
  return careTypeOptions.find((option) => option.value === type)?.label ?? 'Дело';
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isoFromDateInput(value: string) {
  const clean = value.trim();
  if (!clean) return new Date().toISOString();
  const date = new Date(`${clean}T10:00:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function reminderDateInputValue(reminder: ReminderView) {
  const date = new Date(reminder.snoozedUntil || reminder.dueAt);
  return Number.isFinite(date.getTime()) ? dateInputValue(date) : dateInputValue(new Date());
}

function calendarStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function dbToProfile(payload: any): Partial<DogProfile> | null {
  if (!payload?.connected || !payload?.pet) return null;
  const pet = payload.pet;
  const passport = payload.passport ?? {};
  const social = payload.social ?? {};
  return {
    backendPetId: pet.id,
    avatarImageUrl: pet.avatar_url || '',
    avatarSource: pet.avatar_url ? 'uploaded' : 'none',
    photoUrls: Array.isArray(pet.photo_urls) ? pet.photo_urls.filter(Boolean) : pet.avatar_url ? [pet.avatar_url] : [],
    dogName: pet.name || '',
    breedId: pet.breed_id || 'mixed',
    breedGroupId: pet.breed_group_id || 'mixed',
    breedCustom: pet.custom_breed || '',
    lifeStage: pet.life_stage || '',
    sex: pet.sex || '',
    weight: pet.weight_kg ? `${pet.weight_kg} кг` : '',
    microchip: passport.microchip || '',
    vetClinic: passport.vet_clinic || '',
    diet: passport.diet || '',
    allergies: passport.allergies || '',
    medication: passport.medication || '',
    healthNotes: passport.health_notes || '',
    vaccineStatus: fromDbEnum(passport.vaccine_status, dbVaccineStatusMap),
    parasiteStatus: fromDbEnum(passport.parasite_status, dbParasiteStatusMap),
    socialMode: fromDbEnum(social.social_mode, dbSocialModeMap),
    temperament: social.temperament || '',
    energyLevel: social.energy_level || '',
    playStyle: social.play_style || '',
    trainability: social.trainability || '',
    childFriendly: fromDbEnum(social.child_friendly, dbFriendlinessMap),
    dogFriendly: fromDbEnum(social.dog_friendly, dbFriendlinessMap),
    catFriendly: fromDbEnum(social.cat_friendly, dbFriendlinessMap),
    triggers: Array.isArray(social.triggers) ? social.triggers.join(', ') : '',
    aloneTime: social.alone_time_note || '',
  };
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fill: string) {
  roundRectPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function blobFromCanvas(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('png export failed')), 'image/png', 0.95);
  });
}

export default function Home() {
  const [profile, setProfile] = useState<DogProfile>(defaultProfile);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState('');
  const [demoMode, setDemoMode] = useState(false);
  const [notice, setNotice] = useState<Notice>('idle');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('today');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [email, setEmail] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [authUiState, setAuthUiState] = useState<AuthUiState>('idle');
  const [authCooldown, setAuthCooldown] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [reminders, setReminders] = useState<ReminderView[]>([]);
  const [wishlist, setWishlist] = useState<WishlistView[]>([]);
  const [zones, setZones] = useState<ZoneView[]>([]);
  const [pets, setPets] = useState<PetSwitchOption[]>([]);
  const [activePetId, setActivePetId] = useState('');
  const [observations, setObservations] = useState<ObservationView[]>([]);
  const [observationDraft, setObservationDraft] = useState<ObservationDraft>(defaultObservationDraft);
  const [observationSaving, setObservationSaving] = useState(false);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderType, setNewReminderType] = useState('custom');
  const [newReminderDueDate, setNewReminderDueDate] = useState(() => dateInputValue(new Date()));
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => dateInputValue(new Date()));
  const [newZoneTitle, setNewZoneTitle] = useState('');
  const [newZoneNote, setNewZoneNote] = useState('');
  const [newZoneType, setNewZoneType] = useState('safe_place');
  const [pickedZonePoint, setPickedZonePoint] = useState<{ lat: number; lng: number } | null>(null);
  const [activeMapLayer, setActiveMapLayer] = useState<MapLayer>('personal');
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [routePoints, setRoutePoints] = useState<number[][]>([]);
  const [mapFeatures, setMapFeatures] = useState<MapFeatureView[]>([]);
  const [newWishTitle, setNewWishTitle] = useState('');
  const [newWishReason, setNewWishReason] = useState('');
  const [newWishCategory, setNewWishCategory] = useState('gear');
  const [viralCardFormat, setViralCardFormat] = useState<ViralCardFormat>('story');
  const [viralCardMood, setViralCardMood] = useState<ViralCardMood>('bold');
  const [viralCardHeadline, setViralCardHeadline] = useState('');
  const [viralSelectedFacts, setViralSelectedFacts] = useState<ViralFactKey[]>(['social', 'energy', 'care', 'triggers']);
  const [publicCardVisibleFields, setPublicCardVisibleFields] = useState<PublicCardFieldKey[]>(defaultPublicCardFields);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [assistantActions, setAssistantActions] = useState<ActionSuggestion[]>([]);
  const [breedSearch, setBreedSearch] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>('intro');
  const [heroNameDraft, setHeroNameDraft] = useState('');
  const [onboardingCareChoice, setOnboardingCareChoice] = useState<OnboardingCareChoice>(onboardingCareOptions[0]);
  const [telegramSession, setTelegramSession] = useState<TelegramSessionView>({ mode: 'loading' });
  const guestPetIdRef = useRef<string | null>(null);
  const observationsLoadedRef = useRef(false);

  function authHeaders(): Record<string, string> {
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  function isGuestMode() { return !session?.access_token && !telegramSession.ownerId; }
  function ensureGuestPetId() {
    const id = profile.backendPetId || guestPetIdRef.current || `guest-pet-${crypto.randomUUID()}`;
    guestPetIdRef.current = id;
    if (!profile.backendPetId) updateProfile({ backendPetId: id, isPublic: false });
    return id;
  }
  function guestId(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

  function completeOnboarding(nextTab: Tab = 'today') {
    setOnboardingStage('done');
    setTab(nextTab);
    try { window.localStorage.setItem(onboardingKey, 'done'); } catch {}
  }

  function finishOnboarding(nextTab: Tab = 'today') {
    const nextName = heroNameDraft.trim();
    const petId = ensureGuestPetId();
    if (nextName) updateProfile({ dogName: nextName, backendPetId: petId, isPublic: false });
    completeOnboarding(nextTab);
  }

  function startHeroFlow() {
    setError('');
    setOnboardingStage('photo');
  }

  function skipHeroPhoto() {
    setError('');
    setOnboardingStage('style');
  }

  async function createOnboardingHero() {
    const nextName = heroNameDraft.trim();
    if (nextName) updateProfile({ dogName: nextName });
    setOnboardingStage('generating');
    await createAvatar(nextName ? { dogName: nextName } : undefined);
    setOnboardingStage('reveal');
  }

  async function saveOnboardingCarePlan(nextTab: Tab = 'today') {
    const nextName = heroNameDraft.trim();
    if (nextName) updateProfile({ dogName: nextName });
    ensureGuestPetId();
    if (activeReminders.length === 0) await createReminder(onboardingCareChoice.title, onboardingCareChoice.type, onboardingCareChoice.dueInDays);
    completeOnboarding(nextTab);
  }

  async function loadBootstrap(accessToken?: string, petId?: string) {
    const headers: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : authHeaders();
    const params = new URLSearchParams();
    if (petId) params.set('petId', petId);
    const response = await fetch(`/api/app/bootstrap${params.size ? `?${params.toString()}` : ''}`, { headers });
    const payload = await response.json();
    const dbProfile = dbToProfile(payload);
    if (Array.isArray(payload.pets)) setPets(payload.pets.map((pet: any) => ({
      id: String(pet.id),
      name: String(pet.name || 'Собака'),
      breed_id: pet.breed_id,
      breed_group_id: pet.breed_group_id,
      avatar_url: pet.avatar_url,
      photo_urls: Array.isArray(pet.photo_urls) ? pet.photo_urls : [],
    })));
    if (dbProfile) {
      setActivePetId(String(payload.activePetId || payload.pet?.id || dbProfile.backendPetId || ''));
      setProfile((current) => {
        const samePet = !petId || current.backendPetId === dbProfile.backendPetId;
        return { ...current, ...dbProfile, photos: samePet ? current.photos : [], selectedStyle: current.selectedStyle };
      });
      setReminders(payload.reminders ?? []);
      setWishlist(payload.wishlist ?? []);
      setZones(payload.zones ?? []);
      if (Array.isArray(payload.observations)) {
        const bootObservations = payload.observations.map(normalizeObservation).filter(Boolean) as ObservationView[];
        if (bootObservations.length) setObservations(bootObservations.slice(0, 12));
      }
      setNotice('loaded');
      window.setTimeout(() => setNotice('idle'), 1400);
    } else if (payload.empty) {
      setPets([]);
      setActivePetId('');
      setProfile((current) => ({ ...current, backendPetId: undefined }));
      setReminders([]);
      setWishlist([]);
      setZones([]);
      setObservations([]);
    }
  }

  useEffect(() => {
    const local = loadProfile();
    setProfile(local);
    setHeroNameDraft(local.dogName || '');
    try {
      const savedObservations = JSON.parse(window.localStorage.getItem(observationsStorageKey) || '[]');
      if (Array.isArray(savedObservations)) setObservations(savedObservations.map(normalizeObservation).filter(Boolean).slice(0, 12) as ObservationView[]);
    } catch {}
    observationsLoadedRef.current = true;
    try { if (window.localStorage.getItem(onboardingKey) === 'done') setOnboardingStage('done'); } catch {}
    const supabase = getSupabaseBrowser();
    if (!supabase) { setAuthLoading(false); loadBootstrap().catch(() => null); return; }
    supabase.auth.getSession().then(({ data }) => {
      const nextSession = data.session as AuthSession | null;
      setSession(nextSession);
      setAuthLoading(false);
      if (nextSession) loadBootstrap(nextSession.access_token).catch(() => null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextSession = next as AuthSession | null;
      setSession(nextSession);
      if (nextSession) loadBootstrap(nextSession.access_token).catch(() => null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function connectTelegramSession() {
      let webApp = window.Telegram?.WebApp;
      for (let attempt = 0; !webApp && attempt < 6; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 200));
        webApp = window.Telegram?.WebApp;
      }
      if (cancelled) return;

      webApp?.ready?.();
      webApp?.expand?.();
      webApp?.enableClosingConfirmation?.();

      const initData = webApp?.initData || '';
      if (!initData) {
        setTelegramSession({ mode: 'browser', message: 'Open inside Telegram Mini App to attach Telegram session.' });
        return;
      }

      fetch('/api/v1/session/telegram', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
        .then((response) => response.json().then((payload) => ({ response, payload })))
        .then(({ response, payload }) => {
          if (!response.ok) {
            setTelegramSession({ mode: 'error', message: payload?.detail || payload?.error || 'Telegram session unavailable' });
            return;
          }
          if (payload?.mode === 'telegram' && payload?.session?.psyoUserId) {
            setTelegramSession({
              mode: 'telegram',
              psyoUserId: payload.session.psyoUserId,
              ownerId: payload.session.ownerId,
              firstName: payload.session.firstName,
              username: payload.session.username,
            });
            if (payload.session.ownerId) loadBootstrap().catch(() => null);
            return;
          }
          setTelegramSession({ mode: 'browser', message: payload?.message });
        })
        .catch(() => setTelegramSession({ mode: 'error', message: 'Telegram bootstrap failed' }));
    }
    connectTelegramSession();
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { const result = saveProfile(profile); if (!result.ok) setError(result.message); }, [profile]);
  useEffect(() => {
    if (!observationsLoadedRef.current) return;
    try { window.localStorage.setItem(observationsStorageKey, JSON.stringify(observations.slice(0, 24))); } catch {}
  }, [observations]);
  useEffect(() => {
    if (!profile.backendPetId || (!session?.access_token && !telegramSession.ownerId)) return;
    loadObservations().catch(() => null);
  }, [profile.backendPetId, session?.access_token, telegramSession.ownerId]);
  useEffect(() => {
    if (authCooldown <= 0) return;
    const timer = window.setInterval(() => setAuthCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [authCooldown]);
  useEffect(() => {
    if (tab !== 'map' || activeMapLayer !== 'community') return;
    loadMapFeatures().catch(() => null);
  }, [activeMapLayer, tab, session?.access_token, telegramSession.ownerId]);

  const selectedStyle = useMemo(() => avatarStyles.find((style) => style.id === profile.selectedStyle) ?? avatarStyles[0], [profile.selectedStyle]);
  const selectedBreed = useMemo(() => breedCatalog.find((breed) => breed.id === profile.breedId) ?? breedCatalog[0], [profile.breedId]);
  const selectedBreedCare = useMemo(() => getBreedCare(profile.breedId), [profile.breedId]);
  const selectedBreedGroup = useMemo(() => getBreedGroup(profile.breedGroupId), [profile.breedGroupId]);
  const filteredBreeds = useMemo(() => {
    const query = breedSearch.trim().toLowerCase();
    if (query) {
      return breedCatalog.filter((breed) => [breed.title, breed.id, ...(breed.aliases ?? [])].join(' ').toLowerCase().includes(query)).slice(0, 24);
    }
    return breedCatalog.filter((breed) => breed.groupId === profile.breedGroupId || breed.id === 'mixed' || breed.id === 'custom');
  }, [breedSearch, profile.breedGroupId]);
  const breedLabel = useMemo(() => getBreedLabel(profile), [profile]);
  const avatarPrompt = useMemo(() => buildAvatarPrompt(profile), [profile]);
  const hasPhoto = profile.photos.length > 0;
  const avatarReady = avatarState === 'ready';
  const activeReminders = useMemo(() => reminders.filter((reminder) => reminder.status !== 'done'), [reminders]);
  const doneReminders = useMemo(() => reminders.filter((reminder) => reminder.status === 'done'), [reminders]);
  const wantedWishlist = useMemo(() => wishlist.filter((item) => item.status !== 'bought' && item.status !== 'not_suitable'), [wishlist]);
  const boughtWishlist = useMemo(() => wishlist.filter((item) => item.status === 'bought'), [wishlist]);
  const wishlistHints = useMemo(() => {
    const hints: { title: string; category: string; reason: string; priority: string }[] = [];
    if (profile.parasiteStatus !== 'актуально') hints.push({ title: 'Средство от клещей / паразитов', category: 'health', reason: 'Обработка ещё не закрыта — держим средство и дату под рукой.', priority: 'high' });
    if (profile.energyLevel === 'ракета' || profile.energyLevel === 'активный') hints.push({ title: 'Нюхательный коврик или спокойная головоломка', category: 'toy', reason: 'Для активной собаки полезна нагрузка без перевозбуждения.', priority: 'medium' });
    if (profile.triggers) hints.push({ title: 'Адресник + крепкая амуниция', category: 'gear', reason: `Есть триггеры: ${profile.triggers}. Лучше усилить безопасность прогулок.`, priority: 'high' });
    if (profile.coatType === 'длинная' || profile.coatType === 'кудрявая' || profile.coatType === 'двойная/пушистая') hints.push({ title: 'Щётка / груминг-набор под шерсть', category: 'grooming', reason: 'Тип шерсти требует регулярного ухода.', priority: 'medium' });
    return hints.slice(0, 3);
  }, [profile.coatType, profile.energyLevel, profile.parasiteStatus, profile.triggers]);
  const todayPlan = useMemo(() => {
    const items: { emoji: string; title: string; caption: string; severity?: 'warning' }[] = [];
    if (!profile.vaccineStatus || profile.vaccineStatus === 'не знаю') items.push({ emoji: '💉', title: 'Уточнить вакцины', caption: 'Запиши статус или поставь напоминание проверить дату у врача.' });
    if (profile.vaccineStatus === 'просрочено') items.push({ emoji: '🚩', title: 'Вакцина просрочена', caption: 'Не откладывай: проверь график с ветврачом до активных контактов.', severity: 'warning' });
    if (!profile.parasiteStatus || profile.parasiteStatus === 'не знаю') items.push({ emoji: '🛡️', title: 'Уточнить обработку', caption: 'Клещи/паразиты — сезонный риск, лучше держать дату под рукой.' });
    if (profile.parasiteStatus === 'просрочено') items.push({ emoji: '🚩', title: 'Обработка просрочена', caption: 'Поставь задачу и уточни схему у специалиста, особенно перед парками.', severity: 'warning' });
    if (!profile.socialMode) items.push({ emoji: '🐕', title: 'Правило знакомства', caption: 'Укажи, можно ли подходить другим собакам: это снижает бытовые конфликты.' });
    if (profile.triggers) items.push({ emoji: '⚠️', title: 'Триггеры сегодня', caption: profile.triggers });
    if (profile.energyLevel === 'ракета' || profile.energyLevel === 'активный') items.push({ emoji: '🎓', title: 'Нагрузка без перегрева', caption: 'Добавь нюховую или тренировочную задачу вместо одной длинной перевозбуждающей прогулки.' });
    return items.slice(0, 4);
  }, [profile.energyLevel, profile.parasiteStatus, profile.socialMode, profile.triggers, profile.vaccineStatus]);
  const profileChecklist = useMemo(() => [
    { label: 'Имя', done: Boolean(profile.dogName.trim()) },
    { label: 'Возраст/размер', done: Boolean(profile.lifeStage || profile.size) },
    { label: 'Вакцины', done: Boolean(profile.vaccineStatus && profile.vaccineStatus !== 'не знаю') },
    { label: 'Обработка', done: Boolean(profile.parasiteStatus && profile.parasiteStatus !== 'не знаю') },
    { label: 'Правило знакомства', done: Boolean(profile.socialMode) },
    { label: 'Энергия', done: Boolean(profile.energyLevel) },
  ], [profile.dogName, profile.energyLevel, profile.lifeStage, profile.parasiteStatus, profile.size, profile.socialMode, profile.vaccineStatus]);
  const completionCount = useMemo(() => profileChecklist.filter((item) => item.done).length, [profileChecklist]);
  const profileReady = completionCount >= profileChecklist.length;
  const missingProfileFields = useMemo(() => profileChecklist.filter((item) => !item.done).map((item) => item.label), [profileChecklist]);
  const publicCardHref = useMemo(() => {
    const show = (key: PublicCardFieldKey) => publicCardVisibleFields.includes(key);
    const publicImageUrl = /^https?:\/\//i.test(generatedAvatarUrl)
      ? generatedAvatarUrl
      : /^https?:\/\//i.test(profile.avatarImageUrl)
        ? profile.avatarImageUrl
        : profile.photoUrls[0] || '';
    const localImageUrl = generatedAvatarUrl || profile.avatarImageUrl || profile.photos[0]?.dataUrl || '';
    const shareImageUrl = publicImageUrl || localImageUrl;
    const params = new URLSearchParams({
      name: profile.dogName.trim() || 'Моя собака',
      breed: show('breed') ? breedLabel : 'не указано',
      character: show('character') ? profile.temperament || profile.energyLevel || 'спокойный друг' : 'не указано',
      bio: profile.bio || 'Подходите спокойно, без резких движений.',
      social: displaySocialMode(profile.socialMode) || 'сначала спросить владельца',
      triggers: show('triggers') ? profile.triggers || 'резкие движения, шум' : '',
      area: show('area') ? safePublicArea(profile.neighborhood) : 'район скрыт',
    });
    if (/^https?:\/\//i.test(shareImageUrl) || (/^data:image\//i.test(shareImageUrl) && shareImageUrl.length < 12000)) {
      params.set('image', shareImageUrl);
    }
    return `/dog/card?${params.toString()}`;
  }, [breedLabel, generatedAvatarUrl, profile.avatarImageUrl, profile.bio, profile.dogName, profile.energyLevel, profile.neighborhood, profile.photoUrls, profile.photos, profile.socialMode, profile.temperament, profile.triggers, publicCardVisibleFields]);
  const viralFacts = useMemo<Record<ViralFactKey, { label: string; value: string; ready: boolean }>>(() => ({
    social: { label: 'контакт', value: displaySocialMode(profile.socialMode) || 'сначала спросить', ready: Boolean(profile.socialMode) },
    energy: { label: 'ритм', value: profile.energyLevel || profile.temperament || 'спокойный режим', ready: Boolean(profile.energyLevel || profile.temperament) },
    care: { label: 'уход', value: profile.parasiteStatus || profile.vaccineStatus || 'проверить даты', ready: Boolean(profile.parasiteStatus || profile.vaccineStatus) },
    triggers: { label: 'важно', value: profile.triggers || 'без резких движений', ready: Boolean(profile.triggers) },
    area: { label: 'район', value: profile.neighborhood || 'гео скрыто', ready: Boolean(profile.neighborhood) },
    breed: { label: 'порода', value: breedLabel, ready: selectedBreed.id !== 'mixed' },
  }), [breedLabel, profile.energyLevel, profile.neighborhood, profile.parasiteStatus, profile.socialMode, profile.temperament, profile.triggers, profile.vaccineStatus, selectedBreed.id]);
  const visibleViralFacts = useMemo(() => viralSelectedFacts.map((key) => ({ key, ...viralFacts[key] })).slice(0, 4), [viralFacts, viralSelectedFacts]);
  const viralHeadline = useMemo(() => {
    const name = profile.dogName.trim() || 'Моя собака';
    if (viralCardHeadline.trim()) return viralCardHeadline.trim();
    if (viralCardMood === 'safety') return `${name}: как со мной общаться`;
    if (viralCardMood === 'club') return `${name} · официальный good dog`;
    if (viralCardMood === 'soft') return `${name} под заботой`;
    return `${name} — главный герой района`;
  }, [profile.dogName, viralCardHeadline, viralCardMood]);
  const viralCaption = useMemo(() => {
    const name = profile.dogName.trim() || 'моей собаки';
    const rule = displaySocialMode(profile.socialMode) || 'сначала спросить владельца';
    const hook = viralCardMood === 'safety' ? 'Сохрани перед прогулкой:' : viralCardMood === 'club' ? 'Официальная карточка хорошей собаки:' : 'Смотри, какая карточка получилась в Псё:';
    return `${hook} ${name}. Правило контакта: ${rule}.`;
  }, [profile.dogName, profile.socialMode, viralCardMood]);
  const groupedReminders = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    return activeReminders.reduce<{ overdue: ReminderView[]; today: ReminderView[]; upcoming: ReminderView[] }>((groups, reminder) => {
      const due = new Date(reminder.snoozedUntil || reminder.dueAt).getTime();
      if (Number.isFinite(due) && due < todayStart.getTime()) groups.overdue.push(reminder);
      else if (Number.isFinite(due) && due < tomorrowStart.getTime()) groups.today.push(reminder);
      else groups.upcoming.push(reminder);
      return groups;
    }, { overdue: [], today: [], upcoming: [] });
  }, [activeReminders]);
  const visibleCareReminders = useMemo(() => [
    ...groupedReminders.overdue.map((reminder) => ({ ...reminder, group: 'просрочено' })),
    ...groupedReminders.today.map((reminder) => ({ ...reminder, group: 'сегодня' })),
    ...groupedReminders.upcoming.map((reminder) => ({ ...reminder, group: 'скоро' })),
  ].slice(0, 6), [groupedReminders]);
  const remindersByDate = useMemo(() => activeReminders.reduce<Record<string, ReminderView[]>>((index, reminder) => {
    const key = reminderDateInputValue(reminder);
    index[key] = [...(index[key] ?? []), reminder];
    return index;
  }, {}), [activeReminders]);
  const calendarDays = useMemo(() => {
    const first = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth(), 1);
    const gridStart = new Date(first);
    const mondayOffset = (first.getDay() + 6) % 7;
    gridStart.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = dateInputValue(date);
      return {
        key,
        date,
        inMonth: date.getMonth() === calendarCursor.getMonth(),
        isToday: key === dateInputValue(new Date()),
        isSelected: key === selectedCalendarDate,
        reminders: remindersByDate[key] ?? [],
      };
    });
  }, [calendarCursor, remindersByDate, selectedCalendarDate]);
  const calendarTitle = useMemo(() => calendarCursor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }), [calendarCursor]);
  const selectedDateReminders = useMemo(() => (remindersByDate[selectedCalendarDate] ?? []).sort((a, b) => new Date(a.snoozedUntil || a.dueAt).getTime() - new Date(b.snoozedUntil || b.dueAt).getTime()), [remindersByDate, selectedCalendarDate]);
  const selectedDateLabel = useMemo(() => {
    const date = new Date(`${selectedCalendarDate}T10:00:00`);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }) : 'выбранный день';
  }, [selectedCalendarDate]);
  const petName = profile.dogName.trim();
  const dogLabel = petName || 'собака';
  const petNameGent = inflectPetName(profile.dogName, 'gent');
  const petNameDatv = inflectPetName(profile.dogName, 'datv');
  const missingProfileSummary = missingProfileFields.slice(0, 3).join(', ');
  const nextCareLabel = useMemo(() => {
    const next = visibleCareReminders[0];
    if (!next) return 'дел по уходу пока нет';
    return `${next.title} · ${new Date(next.snoozedUntil || next.dueAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
  }, [visibleCareReminders]);
  const todayUtilityLine = activeReminders.length
    ? `${formatCount(activeReminders.length, ['активное дело', 'активных дела', 'активных дел'])}. Ближайшее: ${nextCareLabel}.`
    : `Нет активных дел. Добавь обработку, вакцину, груминг или своё дело для ${dogLabel}.`;
  const publicCardChecks = useMemo<PublicCardCheck[]>(() => [
    { label: 'Имя', done: Boolean(profile.dogName.trim()), missing: 'имя собаки' },
    { label: 'Правило контакта', done: Boolean(profile.socialMode), missing: 'как знакомиться' },
    { label: 'Что не делать', done: Boolean(profile.triggers || profile.bio), missing: 'триггеры или короткое био' },
    { label: 'Район без адреса', done: Boolean(profile.neighborhood), missing: 'район без точного адреса' },
  ], [profile.bio, profile.dogName, profile.neighborhood, profile.socialMode, profile.triggers]);
  const publicCardReadyCount = useMemo(() => publicCardChecks.filter((item) => item.done).length, [publicCardChecks]);
  const publicCardReady = Boolean(profile.dogName.trim() && profile.socialMode && (profile.triggers || profile.bio) && profile.neighborhood);
  const publicCardMissing = useMemo(() => publicCardChecks.filter((item) => !item.done).map((item) => item.missing), [publicCardChecks]);
  const publicCardShows = (key: PublicCardFieldKey) => publicCardVisibleFields.includes(key);
  const todayOwnerChips = useMemo(() => [
    `${completionCount}/6 в профиле`,
    activeReminders.length ? formatCount(activeReminders.length, ['дело в плане', 'дела в плане', 'дел в плане']) : 'план пуст',
    publicCardReady ? 'памятку можно показать' : 'памятка не готова',
  ], [activeReminders.length, completionCount, publicCardReady]);
  const nextBestAction = useMemo(() => {
    if (!profile.backendPetId) return { emoji: '⏰', title: 'Запланировать первую заботу', caption: 'Добавь имя собаки и выбери первое дело: обработка, вакцина, груминг или своё.', action: 'Добавить питомца', target: 'profile' as Tab };
    if (!profileReady) return { emoji: '🛡️', title: 'Проверить защиту и правила', caption: missingProfileSummary ? `Не хватает: ${missingProfileSummary}. Это поможет Псё напоминать точнее.` : 'Нужна пара деталей, чтобы советы были точнее.', action: 'Уточнить', target: 'profile' as Tab };
    if (groupedReminders.overdue.length) return { emoji: '🚩', title: 'Есть просроченная забота', caption: groupedReminders.overdue[0].title, action: 'Закрыть', target: 'today' as Tab, reminderId: groupedReminders.overdue[0].id };
    if (activeReminders.length === 0) return { emoji: '⏰', title: `Запланировать первую заботу ${petNameDatv}`, caption: 'Выберите дело, дату и тип. Псё не будет придумывать напоминания без вашего решения.', action: 'Открыть календарь', target: 'calendar' as Tab };
    return { emoji: '🐾', title: `У ${petNameGent} всё спокойно`, caption: `${formatCount(activeReminders.length, ['активное дело', 'активных дела', 'активных дел'])} · профиль готов ${completionCount} из 6`, action: 'Открыть историю', target: 'calendar' as Tab };
  }, [activeReminders.length, completionCount, groupedReminders.overdue, missingProfileSummary, petNameDatv, petNameGent, profile.backendPetId, profileReady]);
  const latestObservation = observations[0];
  const observationNextStepLine = latestObservation
    ? `Последняя запись: ${latestObservation.mood}, аппетит ${latestObservation.appetite}, энергия ${latestObservation.energy}. Следующий шаг: ${nextBestAction.title.toLowerCase()}.`
    : `Запиши короткое наблюдение перед шагом «${nextBestAction.title}», чтобы видеть, что меняется день за днём.`;
  const appReadiness = useMemo(() => buildAppReadiness({
    profile,
    isAuthenticated: Boolean(session?.access_token || telegramSession.ownerId),
    profileReady,
    missingProfileFields,
    remindersCount: activeReminders.length,
    zonesCount: zones.length,
    wishlistCount: wantedWishlist.length,
    hasAssistantAnswer: Boolean(assistantAnswer),
    demoMode,
  }), [activeReminders.length, assistantAnswer, demoMode, missingProfileFields, profile, profileReady, session?.access_token, telegramSession.ownerId, wantedWishlist.length, zones.length]);
  const hasSupabaseSession = Boolean(session?.access_token);
  const hasTelegramOwner = Boolean(telegramSession.ownerId);
  const hasTelegramSession = telegramSession.mode === 'telegram';
  const hasConnectedAccount = hasSupabaseSession || hasTelegramOwner;
  const showEmailAuth = !hasConnectedAccount && telegramSession.mode === 'browser';
  const authPanelMode = hasConnectedAccount ? 'connected' : hasTelegramSession ? 'telegram-sync' : showEmailAuth ? 'email' : telegramSession.mode;
  const showAuthPanel = showEmailAuth || telegramSession.mode === 'error';
  const visibleMapFeatures = activeMapLayer === 'community' ? mapFeatures : [];

  async function switchActivePet(nextPetId: string) {
    if (!nextPetId || nextPetId === activePetId) return;
    setError('');
    setActivePetId(nextPetId);
    setReminders([]);
    setWishlist([]);
    setZones([]);
    setObservations([]);
    setPickedZonePoint(null);
    setRoutePoints([]);
    await loadBootstrap(undefined, nextPetId).catch(() => setError('Не удалось переключить собаку'));
  }


  function normalizeObservation(raw: any): ObservationView | null {
    if (!raw || typeof raw !== 'object') return null;
    const metadata = raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : {};
    const createdAt = String(raw.observedAt || raw.observed_at || raw.createdAt || raw.created_at || new Date().toISOString());
    const date = new Date(createdAt);
    const type = String(raw.type || '');
    const value = String(raw.value || '');
    return {
      id: String(raw.id || guestId('observation')),
      petId: raw.petId || raw.pet_id ? String(raw.petId || raw.pet_id) : undefined,
      mood: String(raw.mood || metadata.mood || (type === 'mood' ? value : '') || defaultObservationDraft.mood),
      appetite: String(raw.appetite || metadata.appetite || (type === 'appetite' ? value : '') || defaultObservationDraft.appetite),
      stool: String(raw.stool || metadata.stool || (type === 'stool' ? value : '') || defaultObservationDraft.stool),
      energy: String(raw.energy || metadata.energy || (type === 'energy' ? value : '') || defaultObservationDraft.energy),
      note: String(raw.note || '').trim() || undefined,
      createdAt: Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString(),
      syncStatus: raw.syncStatus === 'saved' ? 'saved' : 'local',
    };
  }

  function updateObservationDraft(patch: Partial<ObservationDraft>) {
    setObservationDraft((current) => ({ ...current, ...patch }));
    setError('');
  }

  async function loadObservations() {
    const params = new URLSearchParams({ limit: '12' });
    if (profile.backendPetId) params.set('petId', profile.backendPetId);
    const response = await fetch(`/api/observations?${params.toString()}`, { headers: authHeaders() });
    if (!response.ok) return;
    const payload = await response.json().catch(() => ({}));
    const source = Array.isArray(payload?.observations) ? payload.observations : Array.isArray(payload) ? payload : [];
    const remote = source.map(normalizeObservation).filter(Boolean) as ObservationView[];
    if (!remote.length) return;
    setObservations((current) => {
      const byId = new Map<string, ObservationView>();
      [...remote.map((item) => ({ ...item, syncStatus: 'saved' as const })), ...current].forEach((item) => byId.set(item.id, item));
      return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 12);
    });
  }

  async function submitObservation() {
    if (observationSaving) return;
    const note = observationDraft.note?.trim();
    const petId = profile.backendPetId || (isGuestMode() ? ensureGuestPetId() : undefined);
    const createdAt = new Date().toISOString();
    const optimistic: ObservationView = {
      id: guestId('observation'),
      petId,
      mood: observationDraft.mood,
      appetite: observationDraft.appetite,
      stool: observationDraft.stool,
      energy: observationDraft.energy,
      note: note || undefined,
      createdAt,
      syncStatus: 'local',
    };
    setObservationSaving(true);
    setObservations((current) => [optimistic, ...current].slice(0, 12));
    setObservationDraft(defaultObservationDraft);
    setError('');

    if (!profile.backendPetId || (!session?.access_token && !telegramSession.ownerId)) {
      setObservationSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          petId: profile.backendPetId,
          type: 'note',
          value: `настроение ${optimistic.mood}, аппетит ${optimistic.appetite}, стул ${optimistic.stool}, энергия ${optimistic.energy}`,
          note: optimistic.note || null,
          observedAt: createdAt,
          source: 'manual',
          metadata: {
            mood: optimistic.mood,
            appetite: optimistic.appetite,
            stool: optimistic.stool,
            energy: optimistic.energy,
          },
        }),
      });
      if (!response.ok) return;
      const payload = await response.json().catch(() => ({}));
      const saved = normalizeObservation(payload?.observation || payload);
      setObservations((current) => current.map((item) => item.id === optimistic.id ? { ...(saved || item), id: saved?.id || item.id, syncStatus: 'saved' } : item));
    } finally {
      setObservationSaving(false);
    }
  }

  function updateProfile(patch: Partial<DogProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
    setError('');
  }

  async function uploadPublicPhoto(file: File) {
    if (!session?.access_token) return null;
    const form = new FormData();
    form.set('photo', file);
    const response = await fetch('/api/avatar/upload', {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    const result = await response.json().catch(() => null);
    if (response.status === 403 && result?.error === 'UPLOADS_DISABLED') return null;
    if (!response.ok || !result?.publicUrl) throw new Error(result?.error || 'Не удалось загрузить фото');
    return String(result.publicUrl);
  }

  function updateBreedGroup(value: BreedGroupId) {
    const firstBreed = breedCatalog.find((breed) => breed.groupId === value)?.id ?? 'mixed';
    updateProfile({ breedGroupId: value, breedId: firstBreed as BreedId });
  }

  async function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) return setError('Нужно фото собаки: JPG, PNG или HEIC.');
    if (imageFiles.find((file) => file.size > 8 * 1024 * 1024)) return setError('Фото больше 8 МБ. Выбери файл поменьше.');
    const [photos, localAvatar] = await Promise.all([
      filesToPhotos(imageFiles, maxPhotos),
      fileToLocalAvatarDataUrl(imageFiles[0]),
    ]);
    setGeneratedAvatarUrl(''); setDemoMode(false); setAvatarState('ready');
    updateProfile({ photos, avatarImageUrl: localAvatar, avatarSource: 'uploaded', createdAt: new Date().toISOString() });
    if (session?.access_token) {
      try {
        const avatarBlob = await (await fetch(localAvatar)).blob();
        const publicUrl = await uploadPublicPhoto(new File([avatarBlob], `${imageFiles[0].name || 'dog-photo'}.jpg`, { type: avatarBlob.type || 'image/jpeg' }));
        if (publicUrl) {
          updateProfile({ avatarImageUrl: publicUrl, photoUrls: [publicUrl], avatarSource: 'uploaded' });
          setNotice('saved');
          window.setTimeout(() => setNotice('idle'), 1400);
        }
      } catch (uploadError) {
        setError('Фото видно на этом устройстве. Сохранение фото пока не сработало.');
      }
    }
    event.target.value = '';
  }

  async function createAvatar(overrides: Partial<DogProfile> = {}) {
    const avatarProfile = { ...profile, ...overrides };
    const nextAvatarPrompt = buildAvatarPrompt(avatarProfile);
    setError(''); setGeneratedAvatarUrl(''); setDemoMode(false); setAvatarState('rendering'); updateProfile({ avatarPrompt: nextAvatarPrompt });
    try {
      const form = new FormData();
      if (avatarProfile.photos.length) {
        const source = avatarProfile.photos[0];
        const blob = await (await fetch(source.dataUrl)).blob();
        form.set('photo', new File([blob], source.name || 'dog-reference.png', { type: blob.type || 'image/png' }));
      }
      form.set('prompt', nextAvatarPrompt); form.set('dogName', avatarProfile.dogName); form.set('breedId', avatarProfile.breedId); form.set('styleId', avatarProfile.selectedStyle);
      const response = await fetch('/api/avatar/generate', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok || !result.imageUrl) throw new Error('generation unavailable');
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('avatar image failed to load'));
        image.src = result.imageUrl;
      });
      setGeneratedAvatarUrl(result.imageUrl); setAvatarState('ready');
      if (String(result.imageUrl).length < 450_000) {
        updateProfile({
          avatarImageUrl: result.imageUrl,
          avatarSource: 'generated',
          photoUrls: /^https?:\/\//i.test(result.imageUrl) ? [result.imageUrl] : profile.photoUrls,
        });
      }
    } catch {
      setDemoMode(true); setAvatarState('ready');
      setError('Генерация временно недоступна — показываю пример аватара, не результат по фото.');
    }
  }

  async function saveCard() {
    if (!profile.dogName.trim()) return setError('Сначала добавь имя собаки.');
    setError('');
    if (isGuestMode()) {
      ensureGuestPetId();
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1600);
      return;
    }
    try {
      const response = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ profile: { ...profile, isPublic: true } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Не удалось сохранить карточку');
      const savedPetId = result.pet?.id || profile.backendPetId;
      updateProfile({ backendPetId: savedPetId, isPublic: true });
      if (savedPetId) setActivePetId(savedPetId);
      await loadBootstrap(undefined, savedPetId);
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1600);
    } catch (error) {
      setError('Не удалось сохранить карточку');
    }
  }
  async function signIn() {
    const supabase = getSupabaseBrowser();
    if (!supabase) return setError('Вход временно не настроен. Можно продолжить на этом устройстве.');
    if (!email.trim()) return setError('Введи email для входа.');
    if (authUiState === 'sending' || authCooldown > 0) return;
    setError('');
    setAuthUiState('sending');
    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const redirectTo = isLocalHost ? window.location.origin : configuredAppUrl || window.location.origin;
    const { error: signError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo } });
    if (signError) {
      const isRateLimit = signError.status === 429 || /rate limit|too many|429/i.test(signError.message);
      setAuthUiState(isRateLimit ? 'rate_limited' : 'retryable_error');
      setAuthCooldown(isRateLimit ? 600 : 60);
      return setError(isRateLimit ? 'Слишком много писем за короткое время. Подожди 10–15 минут и запроси новую ссылку.' : 'Не удалось отправить письмо. Проверь email и интернет, потом попробуй ещё раз.');
    }
    setSentEmail(email.trim());
    setAuthUiState('sent');
    setAuthCooldown(60);
  }

  function changeAuthEmail() {
    setAuthUiState('idle');
    setSentEmail('');
    setError('');
  }

  async function signOut() {
    await getSupabaseBrowser()?.auth.signOut();
    await fetch('/api/v1/session/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    setSession(null);
    setTelegramSession((current) => current.mode === 'telegram' ? { mode: 'browser', message: 'Telegram session signed out locally.' } : current);
    setProfile(defaultProfile);
    setReminders([]);
    setWishlist([]);
    setZones([]);
    setObservations([]);
  }

  async function createReminder(title?: string, type = newReminderType, dueInDays = 0, explicitDueDate?: string) {
    const reminderTitle = (title || newReminderTitle).trim();
    if (!reminderTitle) return setError('Напиши, что нужно сделать для собаки.');
    const dueAt = explicitDueDate ? isoFromDateInput(explicitDueDate) : title ? new Date(Date.now() + dueInDays * 86400000).toISOString() : isoFromDateInput(newReminderDueDate);
    if (!profile.backendPetId) {
      if (!isGuestMode()) return setError('Сначала сохрани профиль собаки.');
      ensureGuestPetId();
    }
    if (isGuestMode()) {
      const petId = ensureGuestPetId();
      setReminders((current) => [{ id: guestId('reminder'), petId, type, title: reminderTitle, dueAt, status: 'active' }, ...current]);
      setNewReminderTitle('');
      return;
    }
    const response = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ petId: profile.backendPetId, title: reminderTitle, dueAt, type, source: 'manual_calendar' }),
    });
    const result = await response.json();
    if (!response.ok) return setError('Не удалось создать напоминание');
    setNewReminderTitle('');
    await loadBootstrap();
  }

  async function createWishlistItem(preset?: { title: string; category?: string; reason?: string; priority?: string }) {
    const title = (preset?.title || newWishTitle).trim();
    if (!title) return setError('Добавь название позиции.');
    if (!profile.backendPetId) {
      if (!isGuestMode()) return setError('Сначала сохрани профиль собаки.');
      ensureGuestPetId();
    }
    if (isGuestMode()) {
      const petId = ensureGuestPetId();
      setWishlist((current) => [{ id: guestId('wish'), petId, title, category: preset?.category || newWishCategory, reason: preset?.reason || newWishReason || undefined, priority: preset?.priority || 'medium', status: 'wanted', created_at: new Date().toISOString() }, ...current]);
      setNewWishTitle('');
      setNewWishReason('');
      return;
    }
    const response = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        petId: profile.backendPetId,
        title,
        category: preset?.category || newWishCategory,
        reason: preset?.reason || newWishReason || null,
        priority: preset?.priority || 'medium',
        status: 'wanted',
      }),
    });
    const result = await response.json();
    if (!response.ok) return setError('Не удалось добавить вещь');
    setNewWishTitle('');
    setNewWishReason('');
    await loadBootstrap();
  }

  async function createZone(preset?: { title: string; type?: string; note?: string; radiusMeters?: number; approximateLat?: number; approximateLng?: number }) {
    const title = (preset?.title || newZoneTitle).trim();
    if (!title) return setError('Добавь название зоны.');
    if (!profile.backendPetId) {
      if (!isGuestMode()) return setError('Сначала сохрани профиль собаки.');
      ensureGuestPetId();
    }
    if (isGuestMode()) {
      const petId = ensureGuestPetId();
      setZones((current) => [{ id: guestId('zone'), petId, type: preset?.type || newZoneType, title, note: preset?.note || newZoneNote || undefined, approximate_lat: preset?.approximateLat ?? pickedZonePoint?.lat ?? null, approximate_lng: preset?.approximateLng ?? pickedZonePoint?.lng ?? null, radius_meters: preset?.radiusMeters || 500, created_at: new Date().toISOString() }, ...current]);
      setNewZoneTitle('');
      setNewZoneNote('');
      setPickedZonePoint(null);
      return;
    }
    const response = await fetch('/api/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        petId: profile.backendPetId,
        title,
        type: preset?.type || newZoneType,
        note: preset?.note || newZoneNote || null,
        radiusMeters: preset?.radiusMeters || 500,
        approximateLat: preset?.approximateLat ?? pickedZonePoint?.lat,
        approximateLng: preset?.approximateLng ?? pickedZonePoint?.lng,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось сохранить место');
    setNewZoneTitle('');
    setNewZoneNote('');
    setPickedZonePoint(null);
    await loadBootstrap();
  }

  function handleMapPick(point: { lat: number; lng: number }) {
    if (drawMode === 'route') {
      setRoutePoints((current) => [...current, [point.lng, point.lat]]);
      return;
    }
    setPickedZonePoint(point);
    if (drawMode === 'point') setDrawMode('none');
  }

  function handleMapClick(event: { latlng: { lat: number; lng: number } }) {
    handleMapPick(event.latlng);
  }

  async function loadMapFeatures() {
    const bounds = '55.55,37.35,55.95,37.90';
    const response = await fetch(`/api/map/features?bounds=${bounds}`, { headers: authHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось загрузить места на карте');
    setMapFeatures(Array.isArray(result.features) ? result.features : []);
  }

  async function createMapFeature(visibility: 'private' | 'shared' | 'public') {
    if (!profile.backendPetId) {
      if (!isGuestMode()) return setError('Сначала сохрани профиль собаки.');
      return setError('Публичный слой доступен после сохранения профиля.');
    }

    const title = (newZoneTitle || (drawMode === 'route' ? 'Маршрут прогулки' : 'Место на карте')).trim();
    const body = drawMode === 'route'
      ? { type: 'route', title, petId: profile.backendPetId, path: routePoints, visibility, description: newZoneNote || null }
      : { type: 'point', title, petId: profile.backendPetId, lat: pickedZonePoint?.lat, lng: pickedZonePoint?.lng, zone_type: newZoneType, visibility, description: newZoneNote || null };

    if (drawMode === 'route' && routePoints.length < 2) return setError('Для маршрута нужны хотя бы две точки.');
    if (drawMode !== 'route' && !pickedZonePoint) return setError('Сначала коснись карты, чтобы выбрать точку.');

    const response = await fetch('/api/map/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось сохранить место на карте');

    setNotice(visibility === 'public' ? 'saved' : 'sharing');
    setPickedZonePoint(null);
    setRoutePoints([]);
    setDrawMode('none');
    setNewZoneTitle('');
    setNewZoneNote('');
    if (visibility === 'shared' && result.shareUrl) {
      await navigator.clipboard?.writeText(result.shareUrl).catch(() => undefined);
      setNotice('copied');
    }
    await loadMapFeatures();
    await loadBootstrap();
  }

  async function saveRoute() {
    await createMapFeature(activeMapLayer === 'community' ? 'public' : 'private');
  }

  async function updateZone(id: string, patch: Partial<ZoneView> & { radiusMeters?: number; approximateLat?: number; approximateLng?: number }) {
    if (isGuestMode()) {
      setZones((current) => current.map((zone) => zone.id === id ? { ...zone, ...patch, radius_meters: patch.radiusMeters ?? patch.radius_meters ?? zone.radius_meters, approximate_lat: patch.approximateLat ?? patch.approximate_lat ?? zone.approximate_lat, approximate_lng: patch.approximateLng ?? patch.approximate_lng ?? zone.approximate_lng } : zone));
      return;
    }
    const response = await fetch(`/api/zones/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось обновить место');
    await loadBootstrap();
  }

  async function deleteZone(id: string) {
    if (isGuestMode()) { setZones((current) => current.filter((zone) => zone.id !== id)); return; }
    const response = await fetch(`/api/zones/${id}`, { method: 'DELETE', headers: authHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось удалить место');
    await loadBootstrap();
  }

  async function updateWishlistItem(id: string, patch: Partial<WishlistView>) {
    if (isGuestMode()) { setWishlist((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item)); return; }
    const response = await fetch(`/api/wishlist/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось обновить вещь');
    await loadBootstrap();
  }

  async function deleteWishlistItem(id: string) {
    if (isGuestMode()) { setWishlist((current) => current.filter((item) => item.id !== id)); return; }
    const response = await fetch(`/api/wishlist/${id}`, { method: 'DELETE', headers: authHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось удалить вещь');
    await loadBootstrap();
  }

  async function updateReminder(id: string, patch: Partial<ReminderView>) {
    if (isGuestMode()) { setReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, ...patch } : reminder)); return; }
    const response = await fetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось обновить дело');
    await loadBootstrap();
  }

  async function deleteReminder(id: string) {
    if (isGuestMode()) { setReminders((current) => current.filter((reminder) => reminder.id !== id)); return; }
    const response = await fetch(`/api/reminders/${id}`, { method: 'DELETE', headers: authHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось удалить дело');
    await loadBootstrap();
  }

  async function completeReminder(id: string) {
    if (isGuestMode()) { setReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, status: 'done', completedAt: new Date().toISOString() } : reminder)); return; }
    const response = await fetch(`/api/reminders/${id}/complete`, { method: 'POST', headers: authHeaders() });
    if (!response.ok) return setError('Не удалось закрыть напоминание');
    await loadBootstrap();
  }

  async function snoozeReminder(id: string) {
    const snoozedUntil = new Date(Date.now() + 86400000).toISOString();
    if (isGuestMode()) { setReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, status: 'snoozed', snoozedUntil } : reminder)); return; }
    const response = await fetch(`/api/reminders/${id}/snooze`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ snoozedUntil }) });
    if (!response.ok) return setError('Не удалось отложить напоминание');
    await loadBootstrap();
  }

  function exportReminderToCalendar(reminder: ReminderView) {
    const start = new Date(reminder.snoozedUntil || reminder.dueAt);
    if (!Number.isFinite(start.getTime())) return setError('У дела некорректная дата.');
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    const petName = profile.dogName.trim() || 'питомец';
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Pso//Care Calendar//RU',
      'BEGIN:VEVENT',
      `UID:${reminder.id}@pso-mvp`,
      `DTSTAMP:${calendarStamp(new Date())}`,
      `DTSTART:${calendarStamp(start)}`,
      `DTEND:${calendarStamp(end)}`,
      `SUMMARY:${reminder.title.replace(/\n/g, ' ')}`,
      `DESCRIPTION:Псё: дело ухода для ${petName}. Тип: ${careTypeLabel(reminder.type)}.`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([lines], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `pso-care-${reminderDateInputValue(reminder)}.ics`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function askAssistant(preset?: string) {
    const question = (preset || assistantQuestion).trim();
    if (!question) return setError('Напиши вопрос ассистенту.');
    if (!profile.backendPetId) {
      if (!isGuestMode()) return setError('Сначала сохрани профиль собаки — ассистенту нужен контекст.');
      ensureGuestPetId();
    }
    setAssistantLoading(true); setAssistantActions([]); setError('');
    const response = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        ...(isGuestMode() ? {} : { petId: profile.backendPetId }),
        question,
        context: {
          pet: { name: profile.dogName, life_stage: profile.lifeStage, weight_kg: parseFloat(profile.weight) || undefined },
          passport: { vaccine_status: profile.vaccineStatus, parasite_status: profile.parasiteStatus },
          social: { energy_level: profile.energyLevel, social_mode: profile.socialMode, triggers: profile.triggers ? profile.triggers.split(',').map((item) => item.trim()).filter(Boolean) : [] },
        },
        reminders: activeReminders.slice(0, 5).map((item) => ({ title: item.title })),
      }),
    });
    const result = await response.json();
    setAssistantLoading(false);
    if (!response.ok) return setError('Псё не ответил');
    setAssistantQuestion(question);
    setAssistantAnswer(result.answer || 'Нет ответа');
    setAssistantActions(Array.isArray(result.actionSuggestions) ? result.actionSuggestions : []);
  }

  async function handleApplyAction(action: ActionSuggestion) {
    const title = action.payload.title?.trim();
    if (action.type === 'create_reminder') {
      await createReminder(title, 'custom', 0, action.payload.dueDate);
    } else if (action.type === 'add_wishlist') {
      await createWishlistItem({
        title: title || 'Позиция для собаки',
        category: action.payload.category || 'other',
        reason: action.payload.note,
        priority: action.safetyFlag === 'vet_boundary' ? 'high' : 'medium',
      });
    } else if (action.type === 'add_map_note') {
      await createZone({
        title: title || 'Заметка на карте',
        type: 'safe_place',
        note: action.payload.note,
      });
    }
    setNotice('applied');
    window.setTimeout(() => setNotice('idle'), 1400);
  }

  function seedDemoExperience() {
    const now = Date.now();
    const petId = profile.backendPetId || guestPetIdRef.current || `guest-pet-${crypto.randomUUID()}`;
    guestPetIdRef.current = petId;
    const demoProfile: DogProfile = {
      ...defaultProfile,
      ...profile,
      backendPetId: petId,
      dogName: profile.dogName.trim() || heroNameDraft.trim() || 'Мята',
      breedId: profile.breedId || 'mixed',
      breedGroupId: profile.breedGroupId || 'mixed',
      lifeStage: profile.lifeStage || 'взрослая',
      size: profile.size || 'средняя',
      vaccineStatus: profile.vaccineStatus || 'актуально',
      parasiteStatus: profile.parasiteStatus || 'скоро нужно',
      socialMode: profile.socialMode || 'сначала спросить',
      energyLevel: profile.energyLevel || 'активный',
      temperament: profile.temperament || 'нежная, любопытная',
      playStyle: profile.playStyle || 'нюхательные игры',
      triggers: profile.triggers || 'самокаты, резкий шум',
      bio: profile.bio || 'Любит длинные маршруты, но лучше без суеты и резких звуков.',
      selectedStyle: profile.selectedStyle || 'city',
      isPublic: false,
    };
    setProfile(demoProfile);
    setHeroNameDraft(demoProfile.dogName);
    setAvatarState('ready');
    setDemoMode(true);
    setGeneratedAvatarUrl('');
    setReminders([
      { id: guestId('reminder'), petId, type: 'parasite', title: 'Проверить обработку от клещей', dueAt: new Date(now + 86400000).toISOString(), status: 'active' },
      { id: guestId('reminder'), petId, type: 'training', title: '10 минут спокойной нюхательной игры', dueAt: new Date(now).toISOString(), status: 'active' },
    ]);
    setWishlist([
      { id: guestId('wish'), petId, title: 'Адресник + крепкая амуниция', category: 'gear', reason: 'Есть триггеры на улице — лучше усилить безопасность.', priority: 'high', status: 'wanted' },
      { id: guestId('wish'), petId, title: 'Нюхательный коврик', category: 'toy', reason: 'Нагрузка без перевозбуждения после прогулки.', priority: 'medium', status: 'wanted' },
    ]);
    setZones([
      { id: guestId('zone'), petId, type: 'safe_place', title: 'Тихий двор утром', note: 'Хорошо для спокойного старта дня.', approximate_lat: 55.7512, approximate_lng: 37.6184, radius_meters: 500 },
      { id: guestId('zone'), petId, type: 'risk_zone', title: 'Шумный перекрёсток', note: 'Самокаты и резкие звуки — лучше обходить вечером.', approximate_lat: 55.753, approximate_lng: 37.62, radius_meters: 500 },
    ]);
    setAssistantQuestion('Собери спокойный план прогулки на сегодня');
    setAssistantAnswer('Демо готово: профиль, задачи, карта и список вещей уже заполнены. Можно нажать быстрые сценарии ниже или редактировать всё под свою собаку.');
    setError('');
    setNotice('idle');
    completeOnboarding('today');
  }

  function reset() { resetProfileStorage(); try { window.localStorage.removeItem(onboardingKey); } catch {} setProfile(defaultProfile); setHeroNameDraft(''); setOnboardingStage('intro'); setAvatarState('idle'); setGeneratedAvatarUrl(''); setDemoMode(false); setError(''); }

  function absolutePublicCardUrl() {
    return new URL(publicCardHref, window.location.origin).toString();
  }

  async function shareDogCard() {
    if (!publicCardReady) {
      setTab('profile');
      return;
    }
    const url = absolutePublicCardUrl();
    const title = `Памятка ${profile.dogName.trim() || 'моей собаки'} в Псё`;
    const text = `${title}: ${displaySocialMode(profile.socialMode) || 'как знакомиться — спросить владельца'}`;
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
    if (navigator.share) {
      await navigator.share({ title, text, url }).then(() => setNotice('sharing')).catch(() => null);
      window.setTimeout(() => setNotice('idle'), 1400);
      return;
    }
    const copied = await navigator.clipboard?.writeText(url).then(() => true).catch(() => false);
    if (copied) {
      setNotice('downloaded');
      window.setTimeout(() => setNotice('idle'), 1400);
    }
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    window.Telegram?.WebApp?.openTelegramLink?.(shareUrl) ?? window.open(shareUrl, '_blank');
  }

  function openDogCardPdf() {
    if (!publicCardReady) {
      setTab('profile');
      return;
    }
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('medium');
    window.open(publicCardHref, '_blank', 'noopener,noreferrer');
  }

  function openPublicCard() {
    if (!publicCardReady) {
      setTab('profile');
      return;
    }
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
    window.open(publicCardHref, '_blank', 'noopener,noreferrer');
  }

  function toggleViralFact(key: ViralFactKey) {
    setViralSelectedFacts((current) => {
      if (current.includes(key)) return current.length > 1 ? current.filter((item) => item !== key) : current;
      return [...current, key].slice(-4);
    });
  }

  function togglePublicCardField(key: PublicCardFieldKey) {
    setPublicCardVisibleFields((current) => {
      if (current.includes(key)) return current.length > 1 ? current.filter((item) => item !== key) : current;
      return [...current, key];
    });
  }

  async function renderViralCardBlob() {
    const format = viralCardFormats.find((item) => item.id === viralCardFormat) ?? viralCardFormats[0];
    const [width, height] = format.size.split('x').map(Number);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    const theme = viralMoodTheme[viralCardMood];
    const scale = width / 1080;
    const pad = Math.round(width * 0.07);
    const name = profile.dogName.trim() || 'Моя собака';
    const avatarUrl = generatedAvatarUrl || profile.avatarImageUrl || profile.photos[0]?.dataUrl;

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = theme.accent;
    ctx.beginPath();
    ctx.arc(width * 0.12, height * 0.06, width * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = theme.soft;
    ctx.beginPath();
    ctx.arc(width * 0.92, height * 0.82, width * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = theme.fg;
    ctx.font = `${Math.round(26 * scale)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(theme.label, pad, pad + 8 * scale);

    fillRoundRect(ctx, width - pad - 190 * scale, pad - 20 * scale, 190 * scale, 58 * scale, 999, theme.accent);
    ctx.fillStyle = viralCardMood === 'club' ? '#111513' : '#17112a';
    ctx.font = `800 ${Math.round(24 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Псё', width - pad - 95 * scale, pad + 17 * scale);
    ctx.textAlign = 'left';

    const avatarSize = viralCardFormat === 'square' ? width * 0.36 : width * 0.46;
    const avatarX = width - pad - avatarSize;
    const avatarY = viralCardFormat === 'square' ? pad + 100 * scale : height * 0.18;
    fillRoundRect(ctx, avatarX - 20 * scale, avatarY - 20 * scale, avatarSize + 40 * scale, avatarSize + 40 * scale, 64 * scale, theme.accent);
    if (avatarUrl) {
      await new Promise<void>((resolve) => {
        const image = new Image();
        image.onload = () => {
          ctx.save();
          roundRectPath(ctx, avatarX, avatarY, avatarSize, avatarSize, 56 * scale);
          ctx.clip();
          ctx.drawImage(image, avatarX, avatarY, avatarSize, avatarSize);
          ctx.restore();
          resolve();
        };
        image.onerror = () => resolve();
        image.src = avatarUrl;
      });
    } else {
      fillRoundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 56 * scale, theme.soft);
      ctx.font = `${Math.round(116 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = theme.fg;
      ctx.fillText('🐶', avatarX + avatarSize / 2, avatarY + avatarSize * 0.58);
      ctx.textAlign = 'left';
    }

    const headlineMax = viralCardFormat === 'square' ? width * 0.88 : width * 0.78;
    ctx.fillStyle = theme.fg;
    ctx.font = `900 ${Math.round((viralCardFormat === 'square' ? 78 : 88) * scale)}px ui-serif, Georgia, serif`;
    const headlineLines = wrapCanvasText(ctx, viralHeadline, headlineMax).slice(0, 4);
    let y = viralCardFormat === 'square' ? height * 0.50 : height * 0.47;
    if (viralCardFormat === 'poster') y = height * 0.50;
    headlineLines.forEach((line) => {
      ctx.fillText(line, pad, y);
      y += 92 * scale;
    });

    ctx.fillStyle = theme.muted;
    ctx.font = `700 ${Math.round(31 * scale)}px system-ui, -apple-system, sans-serif`;
    const sub = profile.bio || `${breedLabel} · ${profile.socialMode || 'сначала спросить владельца'}`;
    wrapCanvasText(ctx, sub, width - pad * 2).slice(0, 3).forEach((line) => {
      ctx.fillText(line, pad, y + 16 * scale);
      y += 42 * scale;
    });

    const factYStart = Math.min(height - 360 * scale, y + 72 * scale);
    const factWidth = (width - pad * 2 - 18 * scale) / 2;
    visibleViralFacts.forEach((fact, index) => {
      const x = pad + (index % 2) * (factWidth + 18 * scale);
      const fy = factYStart + Math.floor(index / 2) * 126 * scale;
      fillRoundRect(ctx, x, fy, factWidth, 100 * scale, 26 * scale, fact.ready ? 'rgba(255,255,255,.88)' : 'rgba(255,255,255,.58)');
      ctx.fillStyle = '#271d2d';
      ctx.font = `900 ${Math.round(18 * scale)}px system-ui, -apple-system, sans-serif`;
      ctx.fillText(fact.label.toUpperCase(), x + 24 * scale, fy + 34 * scale);
      ctx.font = `800 ${Math.round(26 * scale)}px system-ui, -apple-system, sans-serif`;
      wrapCanvasText(ctx, fact.value, factWidth - 48 * scale).slice(0, 1).forEach((line) => ctx.fillText(line, x + 24 * scale, fy + 70 * scale));
    });

    ctx.fillStyle = theme.fg;
    ctx.font = `800 ${Math.round(24 * scale)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(`Создано в PSYO · ${new Date().toLocaleDateString('ru-RU')}`, pad, height - pad);
    ctx.textAlign = 'right';
    ctx.fillText(publicCardHref, width - pad, height - pad);
    ctx.textAlign = 'left';
    return blobFromCanvas(canvas);
  }

  async function downloadViralCard() {
    try {
      const blob = await renderViralCardBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `psyo-${(profile.dogName.trim() || 'dog').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-')}-${viralCardFormat}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 500);
      setNotice('copied');
      window.setTimeout(() => setNotice('idle'), 1400);
    } catch {
      setError('Не удалось собрать карточку. Попробуй другой браузер или открой публичную карточку.');
    }
  }

  async function copyViralCaption() {
    const text = `${viralCaption} ${absolutePublicCardUrl()}`;
    const copied = await navigator.clipboard?.writeText(text).then(() => true).catch(() => false);
    setNotice(copied ? 'copied' : 'sharing');
    window.setTimeout(() => setNotice('idle'), 1400);
  }

  async function shareViralCard() {
    try {
      const blob = await renderViralCardBlob();
      const file = new File([blob], `psyo-${profile.dogName.trim() || 'dog'}-${viralCardFormat}.png`, { type: 'image/png' });
      const text = `${viralCaption} ${absolutePublicCardUrl()}`;
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('medium');
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ title: viralHeadline, text, files: [file] }).catch(() => null);
        setNotice('sharing');
        window.setTimeout(() => setNotice('idle'), 1400);
        return;
      }
      await downloadViralCard();
      await navigator.clipboard?.writeText(text).catch(() => null);
    } catch {
      await shareDogCard();
    }
  }

  if (onboardingStage !== 'done') return (
    <main className="app-canvas onboarding-canvas">
      <section className="phone-shell onboarding-shell">
        {onboardingStage === 'intro' && <section className="onboarding-screen hero-intro">
          <div className="hero-copy">
            <p className="eyebrow">Псё · план ухода и памятка</p>
            <h1>Псё помнит всё важное о собаке.</h1>
            <p>За пару минут: добавь питомца, поставь первое дело ухода, потом отмечай выполнение и держи историю под рукой.</p>
          </div>
          <div className="hero-product-shot passport-shot" aria-label="Превью памятки собаки">
            <div className="shot-toolbar"><span /> <b>Сегодня</b><i>уход</i></div>
            <div className="shot-hero-row">
              <GeneratedAvatar profile={profile} ready demo size="large" />
            <div><small>что не забыть</small><b>{profile.dogName || 'Мята'}</b><p>обработка от клещей · завтра 10:00</p></div>
            </div>
            <div className="passport-note"><b>Всё под контролем</b><p>Профиль готов, первое дело запланировано, история ухода сохраняется после выполнения.</p></div>
            <div className="shot-grid"><span>профиль</span><span>дело</span><span>памятка</span></div>
          </div>
          <div className="hero-actions">
            <button className="primary full" onClick={startHeroFlow}>Создать питомца</button>
          </div>
          <button className="hero-example-link" onClick={seedDemoExperience}>Открыть пример без сохранения</button>
          <div className="hero-trust-strip"><span>Без скачивания</span><span>Публично только выбранное</span><span>Гео — вручную</span></div>
          <div className="hero-legal-links"><a href="/legal/privacy">Конфиденциальность</a><a href="/legal/terms">Условия</a><a href="/support">Поддержка</a></div>
        </section>}

        {onboardingStage === 'photo' && <section className="onboarding-screen">
          <p className="eyebrow">шаг 1 / фото</p>
          <h2>Добавь питомца</h2>
          <p>Фото можно пропустить. Главное сейчас — создать карточку и поставить первое напоминание.</p>
          <label className="photo-drop"><input type="file" accept="image/*" multiple onChange={handlePhotos} /><span>{hasPhoto ? 'Фото выбрано · можно дальше' : 'Выбрать фото'}</span></label>
          {hasPhoto && <GeneratedAvatar profile={profile} ready imageUrl={profile.avatarImageUrl || profile.photos[0]?.dataUrl} size="large" />}
          <button className="primary full" onClick={() => setOnboardingStage('style')}>{hasPhoto ? 'Дальше к первому делу' : 'Продолжить без фото'}</button>
          <button className="secondary full" onClick={skipHeroPhoto}>Заполнить сначала текст</button>
        </section>}

        {onboardingStage === 'style' && <section className="onboarding-screen">
          <p className="eyebrow">шаг 2 / план ухода</p>
          <h2>Имя, правило и первое дело</h2>
          <p>Этого хватает для первой пользы: собака появляется в Псё, первое дело попадает в план, после выполнения останется история.</p>
          <input className="hero-name-input" value={heroNameDraft} onChange={(event) => setHeroNameDraft(event.target.value)} placeholder="Как зовут собаку?" />
          <div className="style-picker-grid passport-picker">
            <button className={profile.socialMode === 'можно знакомиться' ? 'active' : ''} onClick={() => updateProfile({ socialMode: 'можно знакомиться' })}><span>🐕</span><b>Можно знакомиться</b><small>но лучше спокойно и по одному</small></button>
            <button className={profile.socialMode === 'сначала спросить' ? 'active' : ''} onClick={() => updateProfile({ socialMode: 'сначала спросить' })}><span>✋</span><b>Сначала спросить</b><small>самый безопасный публичный вариант</small></button>
            <button className={profile.socialMode === 'лучше не подходить' ? 'active' : ''} onClick={() => updateProfile({ socialMode: 'лучше не подходить' })}><span>⚠️</span><b>Лучше не подходить</b><small>для тревожных, реактивных или болеющих собак</small></button>
          </div>
          <div className="onboarding-reminder-picks" aria-label="Первое напоминание">
            {onboardingCareOptions.map((option) => <button key={option.type} className={onboardingCareChoice.type === option.type ? 'active' : ''} onClick={() => setOnboardingCareChoice(option)} aria-pressed={onboardingCareChoice.type === option.type}>{option.label}<small>{option.dueLabel}</small></button>)}
          </div>
          <article className="onboarding-care-confirmation">
            <span>первое дело</span>
            <b>{onboardingCareChoice.title}</b>
            <p>Появится на главной и в плане ухода. Когда отметишь “готово”, останется в истории.</p>
          </article>
          <button className="primary full" onClick={() => saveOnboardingCarePlan('today')}>Сохранить план ухода</button>
          <button className="secondary full" onClick={() => setOnboardingStage('reveal')}>Сначала посмотреть карточку</button>
        </section>}

        {onboardingStage === 'generating' && <section className="onboarding-screen generating-screen">
          <GeneratedAvatar profile={{ ...profile, dogName: heroNameDraft || profile.dogName }} ready demo size="large" />
          <p className="eyebrow">собираю героя</p>
          <h2>Ищу выражение, которое похоже на неё…</h2>
          <div className="generation-steps"><span>Смотрю на характер</span><span>Подбираю стиль</span><span>Собираю карточку</span></div>
        </section>}

        {onboardingStage === 'reveal' && <section className="onboarding-screen reveal-screen">
          <p className="eyebrow">готово</p>
          <h2>{heroNameDraft || profile.dogName ? `Профиль: ${heroNameDraft || profile.dogName}` : 'Профиль пса готов'}</h2>
          <div className="collectible-card passport-card-preview">
              <GeneratedAvatar profile={{ ...profile, dogName: heroNameDraft || profile.dogName }} ready imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="large" />
            <div className="card-stats"><b>{heroNameDraft || profile.dogName || 'Мой пёс'}</b><span>{profile.socialMode || 'сначала спросить'}</span><p>{breedLabel} · {profile.bio || 'короткая памятка появится после заполнения'}</p></div>
          </div>
          <div className="launch-next-grid"><button onClick={() => saveOnboardingCarePlan('profile')}>Профиль</button><button onClick={() => saveOnboardingCarePlan('today')}>Напомнить</button><button onClick={() => saveOnboardingCarePlan('profile')}>Дозаполнить памятку</button></div>
          <button className="primary full" onClick={() => saveOnboardingCarePlan('calendar')}>Поставить первое напоминание</button>
          <button className="secondary full" onClick={() => saveOnboardingCarePlan('today')}>Открыть приложение с первым делом</button>
        </section>}

        {error && <p className="error-text" role="alert">{error}</p>}
      </section>
    </main>
  );

  return (
    <main className="app-canvas">
      <section className={`phone-shell tab-${tab}`}>
        <header className="app-header">
          <div>
            <p>план ухода и памятка</p>
            <h1>{profile.dogName ? `Псё · ${profile.dogName}` : 'Псё'}</h1>
          </div>
          <TelegramPill session={telegramSession} />
          {session ? <button onClick={signOut}>Выйти</button> : <button onClick={() => setTab(tab === 'profile' ? 'today' : 'profile')}>{tab === 'profile' ? 'всё' : 'псё'}</button>}
        </header>

        {pets.length > 1 && <section className="pet-switcher" aria-label="Активная собака">
          <span>активная собака</span>
          <div>
            {pets.map((pet) => <button key={pet.id} className={pet.id === activePetId ? 'active' : ''} type="button" onClick={() => switchActivePet(pet.id)} aria-pressed={pet.id === activePetId}>
              {pet.name}
            </button>)}
          </div>
          <p>Профиль, дела, места, вещи и наблюдения ниже относятся только к выбранной собаке.</p>
        </section>}

        {showAuthPanel && <section className={`auth-inline-panel mode-${authPanelMode} state-${authUiState}`} aria-label="Вход и синхронизация">
          {hasConnectedAccount ? <>
            <div><b>{hasTelegramOwner && !hasSupabaseSession ? 'Telegram подключён' : 'Аккаунт подключён'}</b><p>{session?.user.email || 'Профиль и дела сохраняются автоматически.'}</p></div>
            <button className="secondary" onClick={signOut}>Выйти</button>
          </> : hasTelegramSession ? <>
            <div><b>Telegram подключается</b><p>Псё открыто через Telegram. Сейчас включу сохранение без email.</p></div>
            <button className="secondary" onClick={() => window.location.reload()}>Повторить</button>
          </> : telegramSession.mode === 'loading' ? <>
            <div><b>Проверяю вход</b><p>Смотрю, открыт ли Псё через Telegram.</p></div>
          </> : telegramSession.mode === 'error' ? <>
            <div><b>Telegram не подключился</b><p>Открой Псё через кнопку бота. Email здесь не нужен.</p></div>
            <button className="secondary" onClick={() => window.location.reload()}>Повторить</button>
          </> : showEmailAuth ? <>
            <div><b>Открыто без Telegram</b><p>Основной вход — через Telegram. Email здесь нужен только для письма со входом и не открывает чужой профиль.</p></div>
            <div className="auth-inline-actions">
              {authUiState === 'sent' ? <p className="auth-inline-note">Письмо для входа отправлено на {sentEmail}. Профиль откроется после перехода из письма.</p> : <>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email для письма со входом" aria-label="Email для письма со входом" />
                <button className="primary" onClick={signIn} disabled={authUiState === 'sending' || authCooldown > 0}>{authUiState === 'sending' ? 'Отправляю…' : authCooldown > 0 ? `Подожди ${authCooldown}s` : 'Отправить'}</button>
              </>}
              {authUiState === 'sent' && <button className="secondary" onClick={changeAuthEmail}>Другой email</button>}
            </div>
          </> : <>
            <div><b>Локальный режим</b><p>Можно продолжить сейчас. Для сохранения открой через Telegram.</p></div>
          </>}
        </section>}

        <section className="dog-hero-card">
          <div className="hero-avatar-wrap"><GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" /></div>
          <div className="dog-main-info"><span>{selectedBreed.emoji} {breedLabel}</span><h2>{profile.dogName || 'Добавь имя'}</h2><p>{profile.bio || 'Профиль, места, записи и вещи в одном спокойном месте.'}</p></div>
          <button className="round-action" aria-label="Редактировать профиль собаки" onClick={() => setTab('profile')}>✎</button>
        </section>

        {tab === 'today' && <section className="screen-stack today-screen kit-today-screen">
          <section className="kit-hero-card" aria-label="Псё — сегодня">
            <div className="kit-hero-copy">
              <span className="eyebrow">сводка владельца</span>
              <h2>{petName ? `Что важно для ${petNameGent}` : 'Что важно сегодня'}</h2>
              <p>{todayUtilityLine}</p>
              <div className="kit-pill-row" aria-label="Что уже собрано">
                {todayOwnerChips.map((chip) => <span key={chip}>{chip}</span>)}
              </div>
            </div>
            <div className="kit-dog-card">
              <GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="large" />
              <button className="kit-edit-button" onClick={() => setTab('profile')} aria-label="Редактировать профиль">✎</button>
            </div>
          </section>

          <article className={`kit-next-card ${nextBestAction.reminderId ? 'warning' : ''}`}>
            <span>{nextBestAction.emoji}</span>
            <div>
              <p className="eyebrow">ближайший шаг</p>
              <h3>{nextBestAction.title}</h3>
              <p>{nextBestAction.caption}</p>
            </div>
            <button onClick={() => nextBestAction.reminderId ? completeReminder(nextBestAction.reminderId) : nextBestAction.target === 'today' ? document.querySelector<HTMLInputElement>('.today-quick-add input')?.focus() : setTab(nextBestAction.target)}>{nextBestAction.action}</button>
          </article>

          <section className="observation-panel" aria-label="Быстрое наблюдение">
            <div className="section-title observation-title">
              <div><span className="eyebrow">наблюдение</span><h3>Как {petName ? petName : 'собака'} сейчас</h3></div>
              <span>{observations.length ? formatCount(observations.length, ['запись', 'записи', 'записей']) : 'первая запись'}</span>
            </div>
            <p className="observation-next-line">{observationNextStepLine}</p>
            <form className="observation-form" onSubmit={(event) => { event.preventDefault(); submitObservation(); }}>
              <ObservationChoice label="Настроение" value={observationDraft.mood} options={observationMoodOptions} onChange={(value) => updateObservationDraft({ mood: value })} />
              <ObservationChoice label="Аппетит" value={observationDraft.appetite} options={observationAppetiteOptions} onChange={(value) => updateObservationDraft({ appetite: value })} />
              <ObservationChoice label="Стул" value={observationDraft.stool} options={observationStoolOptions} onChange={(value) => updateObservationDraft({ stool: value })} />
              <ObservationChoice label="Энергия" value={observationDraft.energy} options={observationEnergyOptions} onChange={(value) => updateObservationDraft({ energy: value })} />
              <textarea value={observationDraft.note || ''} onChange={(event) => updateObservationDraft({ note: event.target.value })} placeholder="Короткая заметка: прогулка, корм, сон, что заметили" aria-label="Заметка наблюдения" />
              <button className="primary" type="submit" disabled={observationSaving}>{observationSaving ? 'Сохраняю…' : 'Записать наблюдение'}</button>
            </form>
            <div className="observation-history" aria-label="Последние наблюдения">
              {observations.length === 0 ? <article className="observation-empty"><b>История начнётся с первой записи</b><p>Достаточно одного короткого наблюдения в день: настроение, аппетит, стул, энергия и заметка.</p></article> : observations.slice(0, 4).map((item) => <article key={item.id}>
                <div>
                  <b>{new Date(item.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} · {new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</b>
                  <p>{item.mood} · аппетит {item.appetite} · стул {item.stool} · энергия {item.energy}</p>
                  {item.note && <small>{item.note}</small>}
                </div>
                <span>{item.syncStatus === 'saved' ? 'сохранено' : 'локально'}</span>
              </article>)}
            </div>
          </section>

          <section className="kit-daily-status action-first" aria-label="Быстрые действия">
            <button onClick={() => setTab('calendar')}>
              <span>Уход</span>
              <b>Добавить дело</b>
              <small>создать дело в плане</small>
            </button>
            <button onClick={() => setTab('card')}>
              <span>Для людей</span>
              <b>Памятка</b>
              <small>что увидит другой человек</small>
            </button>
            <button onClick={() => setTab('things')}>
              <span>Вещи</span>
              <b>Что нужно</b>
              <small>покупки, услуги и подарки</small>
            </button>
            <button onClick={() => askAssistant('Что мне важно проверить по уходу на этой неделе?')}>
              <span>Ассистент</span>
              <b>Спросить по уходу</b>
              <small>без диагнозов и лишнего чата</small>
            </button>
          </section>

          {activeReminders.length === 0 && <section className="today-care-presets" aria-label="Первое дело ухода">
            <div><span className="eyebrow">быстро начать</span><b>Поставь первое дело в план</b></div>
            <div>
              {onboardingCareOptions.map((option) => <button key={option.type} onClick={() => createReminder(option.title, option.type, option.dueInDays)}>{option.label}<small>{option.dueLabel}</small></button>)}
            </div>
          </section>}

          <section className="kit-below">
            <section className="care-history-panel" aria-label="История ухода">
              <div className="section-title">
                <div><span className="eyebrow">план и история ухода</span><h3>{activeReminders.length > 0 ? 'Что сделать и что уже закрыто' : 'Сначала добавь первое дело'}</h3></div>
                <button className="secondary" onClick={() => setTab('calendar')}>План</button>
              </div>
              {activeReminders.length === 0 && doneReminders.length === 0 && <p>Выбери конкретное дело и дату. После выполнения оно останется в истории, чтобы не вспоминать по памяти, когда была обработка, вакцина или груминг.</p>}
              {activeReminders.length > 0 && <div className="care-history-list active-care-list">{visibleCareReminders.slice(0, 3).map((reminder) => <article key={reminder.id}><b>{reminder.title}</b><span>{new Date(reminder.snoozedUntil || reminder.dueAt).toLocaleDateString('ru-RU')} · ждёт</span><button onClick={() => completeReminder(reminder.id)}>Готово</button></article>)}</div>}
              {doneReminders.length > 0 && <div className="care-history-list">{doneReminders.slice(0, 3).map((reminder) => <article key={reminder.id}><b>{reminder.title}</b><span>{new Date(reminder.completedAt || reminder.dueAt).toLocaleDateString('ru-RU')} · готово</span></article>)}</div>}
            </section>

            <section className="today-action-hub" aria-label="Быстрые действия на сегодня">
              <div className="today-support-row">
                {!profileReady && <article className="profile-nudge-card">
                  <div>
                    <b>В профиле {petNameGent} не хватает данных</b>
                    <p>{missingProfileSummary ? `Добавьте: ${missingProfileSummary.toLowerCase()}. Так напоминания и ответы будут точнее.` : 'Добавьте пару деталей, чтобы Псё лучше понимал контекст.'}</p>
                  </div>
                  <button className="secondary" onClick={() => setTab('profile')}>Заполнить</button>
                </article>}
                <article className="share-mini-card">
                  <div><b>Памятка для людей рядом</b><p>{publicCardReady ? 'Минимум готов: можно проверить и отправить человеку, который гуляет или сидит с собакой.' : `Не хватает: ${publicCardMissing.slice(0, 2).join(', ')}.`}</p></div>
                  <div className="share-mini-actions">
                    <button className="primary" onClick={() => setTab('card')}>Проверить</button>
                    <button className="secondary" onClick={publicCardReady ? openPublicCard : () => setTab('profile')}>{publicCardReady ? 'Открыть' : 'Дозаполнить'}</button>
                  </div>
                </article>
              </div>
            </section>
          </section>
        </section>}

        {tab === 'assistant' && <WatercolorScreen className="assistant-composition" tone="green" eyebrow="помощник по уходу" title="Выбери безопасный сценарий" caption="Ответ должен закончиться действием: дело в план, обновление памятки или заметка владельца." aside={<span className="watercolor-hero-mark">✦</span>}>
          <PaperSheet className="assistant-main-sheet">
            <div className="assistant-box">
              <textarea value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} placeholder="Например: что проверить по уходу на этой неделе?" aria-label="Вопрос ассистенту" />
              <button className="primary full" onClick={() => askAssistant()} disabled={assistantLoading}>{assistantLoading ? 'Думаю…' : 'Спросить'}</button>
              {assistantAnswer && <div className="assistant-answer" role="status">{assistantAnswer}</div>}
              <AssistantActionButtons actions={assistantActions} onApply={handleApplyAction} />
            </div>
          </PaperSheet>

          <section className="prompt-river" aria-label="Быстрые вопросы ассистенту">
            <TaskCard emoji="⚕️" title="Уход на неделю" caption="Что проверить по вакцинам, обработке и ближайшим делам." action="Спросить" onClick={() => askAssistant('Что мне важно проверить по уходу на этой неделе?')} />
            <TaskCard emoji="🦮" title="Спокойная прогулка" caption="Темп, маршрут и триггеры без лишней героики." action="Спросить" onClick={() => askAssistant('Сделай план спокойной прогулки для моей собаки.')} />
            <TaskCard emoji="🤝" title="Памятка догситтеру" caption="Что можно, чего нельзя и как знакомиться." action="Спросить" onClick={() => askAssistant('Подготовь памятку для догситтера по профилю собаки.')} />
          </section>
        </WatercolorScreen>}

        {tab === 'nearby' && <WatercolorScreen className="nearby-composition" tone="rose" eyebrow="социализация" title="Кого можно встретить" caption="Не свайпы и не обещания. Только спокойная подготовка к знакомствам рядом." aside={<span className="watercolor-hero-mark">🐕</span>}>
          <article className="presence-radar">
            <div className="presence-ring"><GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" /></div>
            <b>{displaySocialMode(profile.socialMode) || 'сначала спросить владельца'}</b>
            <p>{profile.triggers ? `Учесть: ${profile.triggers}.` : 'Добавь триггеры и правило контакта, чтобы знакомиться спокойнее.'}</p>
          </article>
          <section className="nearby-list" aria-label="Собаки рядом">
            {nearbyDogs.map((dog) => <article className="nearby-dog-card" key={dog.name}><span>{dog.emoji}</span><div><b>{dog.name}</b><p>{dog.caption} · {dog.distance}</p></div><button aria-label={`Открыть памятку для знакомства с ${dog.name}`} onClick={() => setTab('card')}>→</button></article>)}
          </section>
          <article className="match-card"><span>!</span><div><b>Сначала безопасность</b><p>Псё не показывает точные адреса и не обещает встречу. Проверь памятку, правило контакта и триггеры перед знакомством.</p></div></article>
        </WatercolorScreen>}

        {tab === 'calendar' && <WatercolorScreen className="calendar-composition" tone="gold" eyebrow="календарь" title="План заботы" caption="Даты, история и ближайшие дела отдельно от главного экрана." aside={<span className="watercolor-hero-mark">▣</span>}>
          <article className="today-reminder-panel care-calendar-panel">
            <div className="section-title"><div><span className="eyebrow">месяц</span><h3>{calendarTitle}</h3></div><button className="secondary" onClick={() => {
              setNewReminderDueDate(selectedCalendarDate);
              document.querySelector<HTMLInputElement>('.today-quick-add input')?.focus();
            }}>Новое дело</button></div>
            <div className="calendar-toolbar" aria-label="Месяц календаря">
              <button className="secondary" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Предыдущий месяц">‹</button>
              <b>{calendarTitle}</b>
              <button className="secondary" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Следующий месяц">›</button>
            </div>
            <div className="calendar-mode-row" aria-label="Быстрые действия календаря">
              <button onClick={() => {
                const today = new Date();
                setCalendarCursor(today);
                setSelectedCalendarDate(dateInputValue(today));
                setNewReminderDueDate(dateInputValue(today));
              }}>Сегодня</button>
              <span>{formatCount(activeReminders.length, ['активное дело', 'активных дела', 'активных дел'])}</span>
            </div>
            <div className="care-calendar-grid" aria-label="Календарь задач ухода">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => <span key={day} className="calendar-weekday">{day}</span>)}
              {calendarDays.map((day) => <button key={day.key} className={`calendar-day ${day.inMonth ? '' : 'muted'} ${day.reminders.length ? 'has-care' : ''} ${day.isSelected ? 'selected' : ''} ${day.isToday ? 'today' : ''}`} onClick={() => {
                setSelectedCalendarDate(day.key);
                setNewReminderDueDate(day.key);
                if (!day.inMonth) setCalendarCursor(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
              }} aria-pressed={day.isSelected} aria-label={`${day.date.toLocaleDateString('ru-RU')}: ${formatCount(day.reminders.length, ['дело', 'дела', 'дел'])}`}>
                <span>{day.date.getDate()}</span>
                {day.reminders.length > 0 && <b>{day.reminders.length}</b>}
              </button>)}
            </div>
            <section className="selected-day-panel" aria-label="Дела выбранного дня">
              <div><span className="eyebrow">выбранный день</span><b>{selectedDateLabel}</b></div>
              <button className="secondary" onClick={() => document.querySelector<HTMLInputElement>('.today-quick-add input')?.focus()}>Добавить на дату</button>
            </section>
            {selectedDateReminders.length === 0 && <article className="empty-state"><b>На эту дату дел нет</b><p>Можно добавить обработку, вакцину, груминг, корм или визит к врачу.</p></article>}
            {selectedDateReminders.length > 0 && <div className="today-reminder-list">
              {selectedDateReminders.map((reminder) => <article key={reminder.id} className={`reminder-card compact ${new Date(reminder.snoozedUntil || reminder.dueAt).getTime() < new Date().setHours(0, 0, 0, 0) ? 'warning' : ''}`}>
                {editingReminderId === reminder.id ? <form className="reminder-edit-form" onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  updateReminder(reminder.id, { title: String(data.get('title') || reminder.title), type: String(data.get('type') || reminder.type), dueAt: isoFromDateInput(String(data.get('dueDate') || reminderDateInputValue(reminder))) });
                  setEditingReminderId(null);
                }}>
                  <input name="title" defaultValue={reminder.title} aria-label="Название дела" />
                  <div className="reminder-edit-row">
                    <select name="type" defaultValue={reminder.type} aria-label="Тип дела">{careTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                    <input name="dueDate" type="date" defaultValue={reminderDateInputValue(reminder)} aria-label="Дата дела" />
                  </div>
                  <div><button type="submit">Сохранить</button><button type="button" onClick={() => setEditingReminderId(null)}>Отмена</button></div>
                </form> : <>
                  <div><b>{reminder.title}</b><p>{careTypeLabel(reminder.type)} · {new Date(reminder.snoozedUntil || reminder.dueAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p></div>
                  <div><button onClick={() => completeReminder(reminder.id)}>Готово</button><button onClick={() => exportReminderToCalendar(reminder)}>В календарь</button><button onClick={() => setEditingReminderId(reminder.id)}>Править</button><button className="danger-action" onClick={() => deleteReminder(reminder.id)}>Удалить</button></div>
                </>}
              </article>)}
            </div>}
          </article>
          <article className="today-add-care">
            <div className="today-add-copy">
              <span className="eyebrow">быстро добавить</span>
              <b>Новая забота {petNameDatv}</b>
              <p>Выбранная дата уже подставлена. Экспорт в .ics остаётся в карточке дела.</p>
            </div>
            <div className="quick-add today-quick-add">
              <input value={newReminderTitle} onChange={(event) => setNewReminderTitle(event.target.value)} placeholder="Например: обработка от клещей" />
              <button aria-label="Добавить заботу" onClick={() => createReminder()}>+</button>
            </div>
            <div className="care-form-row">
              <select value={newReminderType} onChange={(event) => setNewReminderType(event.target.value)} aria-label="Тип заботы">{careTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <input type="date" value={newReminderDueDate} onChange={(event) => setNewReminderDueDate(event.target.value)} aria-label="Дата заботы" />
            </div>
            <div className="care-preset-grid" aria-label="Быстро добавить уход">
              <button onClick={() => createReminder('Обработка от клещей и паразитов', 'parasite', 30)}>Обработка</button>
              <button onClick={() => createReminder('Проверить дату вакцинации', 'vaccine', 7)}>Вакцинация</button>
              <button onClick={() => createReminder('Груминг: шерсть и когти', 'grooming', 14)}>Груминг</button>
            </div>
          </article>
          {visibleCareReminders.length > selectedDateReminders.length && <details className="upcoming-care-details">
            <summary>Ближайшие дела</summary>
            <div>
              {visibleCareReminders.map((reminder) => <button key={reminder.id} onClick={() => {
                const key = reminderDateInputValue(reminder);
                const date = new Date(`${key}T10:00:00`);
                setSelectedCalendarDate(key);
                setNewReminderDueDate(key);
                if (Number.isFinite(date.getTime())) setCalendarCursor(new Date(date.getFullYear(), date.getMonth(), 1));
              }}><b>{reminder.title}</b><span>{reminderDateInputValue(reminder)}</span></button>)}
            </div>
          </details>}
        </WatercolorScreen>}

        {tab === 'card' && <WatercolorScreen className="public-card-screen" tone="gold" eyebrow="памятка" title="Что увидит другой человек" caption="Короткая карточка для догситтера, грумера, друга или человека во дворе. Без точного адреса и без лишней анкеты." aside={<span className="watercolor-hero-mark">◇</span>}>
          <section className="public-card-review" aria-label="Предпросмотр памятки собаки">
            <article className="public-card-preview-panel">
              <div className="public-card-preview-head">
                <span>памятка</span>
                <b>{publicCardReady ? 'можно показывать' : 'черновик'}</b>
              </div>
              <div className="public-card-preview-dog">
                <GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="large" />
                <div>
                  <h3>{petName || 'Добавить имя'}</h3>
                  <p>{publicCardShows('breed') ? selectedBreed.id === 'mixed' ? 'порода необязательна' : breedLabel : 'порода скрыта'}</p>
                </div>
              </div>
              <div className="public-card-rule">
                <span>главное правило</span>
                <b>{displaySocialMode(profile.socialMode) || 'сначала спросить владельца'}</b>
                <p>{publicCardShows('triggers') ? profile.triggers ? `Не делать: ${profile.triggers}.` : profile.bio || 'Лучше подходить спокойно, без резких рук и еды без разрешения.' : 'Дополнительные детали скрыты владельцем.'}</p>
              </div>
              <div className="public-card-preview-grid">
                <article><span>характер</span><b>{publicCardShows('character') ? profile.temperament || profile.energyLevel || 'Добавить характер' : 'скрыт'}</b></article>
                <article><span>район</span><b>{publicCardShows('area') ? profile.neighborhood ? safePublicArea(profile.neighborhood) : 'Указать район без адреса' : 'скрыт'}</b></article>
              </div>
            </article>

            <article className="public-card-checklist">
              <div className="section-title">
                <div><span className="eyebrow">перед отправкой</span><h3>{publicCardReadyCount} из {publicCardChecks.length}</h3></div>
                <button className="secondary" onClick={() => setTab('profile')}>Править</button>
              </div>
              {publicCardChecks.map((item) => <div key={item.label} className={item.done ? 'done' : ''}><span>{item.done ? '✓' : '•'}</span><b>{item.label}</b><small>{item.done ? 'готово' : `добавить: ${item.missing}`}</small></div>)}
            </article>
          </section>

          <section className="public-card-fields-panel" aria-label="Что показать в памятке">
            <div className="section-title">
              <div><span className="eyebrow">что показать</span><h3>Поля памятки</h3></div>
              <span>{publicCardVisibleFields.length} из {publicCardFieldOptions.length}</span>
            </div>
            <div>
              {publicCardFieldOptions.map((item) => <button key={item.key} type="button" className={publicCardShows(item.key) ? 'active' : ''} onClick={() => togglePublicCardField(item.key)} aria-pressed={publicCardShows(item.key)}>
                <b>{item.label}</b>
                <small>{item.detail}</small>
              </button>)}
            </div>
            <p>Имя и главное правило контакта остаются обязательными. Точный адрес, контакты владельца, лекарства и внутренние заметки сюда не попадают.</p>
          </section>

          <section className="public-card-actions-panel" aria-label="Действия с памяткой">
            <button className="primary" onClick={publicCardReady ? shareDogCard : () => setTab('profile')}>{publicCardReady ? 'Поделиться' : 'Дозаполнить памятку'}</button>
            <button className="secondary" onClick={publicCardReady ? openPublicCard : () => setTab('profile')}>{publicCardReady ? 'Открыть' : 'Заполнить'}</button>
            <button className="secondary" onClick={publicCardReady ? openDogCardPdf : () => setTab('profile')}>{publicCardReady ? 'PDF / печать' : 'Заполнить перед печатью'}</button>
          </section>

          <article className="public-card-privacy-note">
            <b>Что не публикуем автоматически</b>
            <p>Точный адрес, контакты владельца, медицинские заметки, лекарства и внутреннюю историю ухода. В памятку попадает только то, что нужно человеку рядом с собакой.</p>
          </article>
        </WatercolorScreen>}

        {tab === 'profile' && <WatercolorScreen className="profile-ux-2025" tone="gold" eyebrow="умный профиль" title={profile.dogName || 'Профиль пса'} caption={profileReady ? 'Минимум готов: Псё уже персонализирует подсказки, места и напоминания.' : `Следующий шаг: ${missingProfileFields[0] || 'сохранить профиль'}.`}>
          <section className="smart-profile-hero" aria-label="Сводка профиля собаки">
            <div className="smart-profile-identity">
              <GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="large" />
              <div className="smart-profile-nameplate">
                <span>{selectedBreed.emoji} {breedLabel}</span>
                <h3>{profile.dogName || 'Про него'}</h3>
                <p>{profile.bio || `Запишем ${missingProfileFields[0]?.toLowerCase() || 'важное'}, чтобы не держать в голове.`}</p>
              </div>
            </div>
            <div className="smart-profile-readiness" aria-label={`Готовность профиля ${completionCount} из ${profileChecklist.length}`}>
              <div className="readiness-ring" style={{ '--ready': `${Math.round((completionCount / profileChecklist.length) * 100)}%` } as CSSProperties}><b>{completionCount}</b><span>/6</span></div>
              <div><b>{profileReady ? 'Карточка собрана' : 'Что дальше'}</b><p>{profileReady ? 'Можно проверить памятку для людей.' : missingProfileFields[0] || 'Сохранить профиль'}</p><button className="mini-next-action" onClick={() => profileReady ? setTab('card') : document.querySelector<HTMLInputElement | HTMLSelectElement>('.profile-minimum-panel input, .profile-minimum-panel select')?.focus()}>{profileReady ? 'Открыть памятку' : 'Записать'}</button></div>
            </div>
          </section>

          <PaperSheet className="profile-minimum-panel">
            <div className="profile-panel-head"><span>01</span><div><b>Быстрый портрет</b><p>Отвечай как в чате: пару тапов уже дают полезную карточку.</p></div></div>
            <div className="smart-field-grid">
              <label className="field-wide">Имя<input value={profile.dogName} onChange={(event) => updateProfile({ dogName: event.target.value })} placeholder="Имя собаки" /></label>
            </div>
            <div className="choice-bubble-stack">
              <ChoiceBubbles label="Возраст" value={profile.lifeStage} options={lifeStageOptions} onChange={(value) => updateProfile({ lifeStage: value })} />
              <ChoiceBubbles label="Размер" value={profile.size} options={sizeOptions} onChange={(value) => updateProfile({ size: value })} />
              <ChoiceBubbles label="Как знакомиться" value={profile.socialMode} options={socialOptions} onChange={(value) => updateProfile({ socialMode: value })} hint="Это увидят люди в карточке." />
              <ChoiceBubbles label="Энергия" value={profile.energyLevel} options={energyOptions} onChange={(value) => updateProfile({ energyLevel: value })} />
              <ChoiceBubbles label="Вакцины" value={profile.vaccineStatus} options={vaccineOptions} onChange={(value) => updateProfile({ vaccineStatus: value })} />
              <ChoiceBubbles label="Обработка" value={profile.parasiteStatus} options={parasiteOptions} onChange={(value) => updateProfile({ parasiteStatus: value })} />
            </div>
          </PaperSheet>

          <details className="profile-details smart-section" open><summary><span>02</span><div><b>Карточка для людей</b></div></summary>
            <div className="details-body public-card-composer">
              <label>Короткое био<input value={profile.bio} onChange={(event) => updateProfile({ bio: event.target.value })} placeholder="Спокойная, любит нюхать, боится самокатов" /></label>
              <SuggestionBubbles label="Подсказки для био" options={['Спокойная, любит нюхать', 'Активный, лучше знакомить по одному', 'Боится самокатов и резких звуков', 'Не давать еду без спроса']} onPick={(bio) => updateProfile({ bio })} />
              <label>Район без точного адреса<input value={profile.neighborhood} onChange={(event) => updateProfile({ neighborhood: event.target.value })} placeholder="например: Сокол / парк рядом" /></label>
              <article className="public-card-preview-smart">
                <div><small>публично</small><b>{profile.dogName.trim() || 'Моя собака'}</b><p>{profile.socialMode || 'сначала спросить владельца'}</p></div>
                <span>{profile.isPublic ? 'активна' : 'черновик'}</span>
              </article>
              <button className="secondary full" onClick={saveCard}>Обновить карточку</button>
              <div className="share-export-grid">
                <button className="secondary" onClick={publicCardReady ? openPublicCard : () => setTab('profile')}>{publicCardReady ? 'Просмотреть' : 'Дозаполнить'}</button>
                <button className="primary" onClick={publicCardReady ? shareDogCard : () => setTab('profile')}>{publicCardReady ? 'Поделиться' : 'Дозаполнить памятку'}</button>
                <button className="secondary" onClick={publicCardReady ? openDogCardPdf : () => setTab('profile')}>{publicCardReady ? 'Версия для печати' : 'Заполнить перед печатью'}</button>
              </div>
              <p className="privacy-hint">Версия для печати открывается отдельной страницей: там можно проверить карточку и сохранить через печать/PDF.</p>
            </div>
          </details>

          <details className="profile-details smart-section"><summary><span>03</span><div><b>Порода и признаки</b></div></summary>
            <div className="details-body">
              <label>Поиск породы<input value={breedSearch} onChange={(event) => setBreedSearch(event.target.value)} placeholder="ксоло, corgi, хохлатая, левретка…" /></label>
              <div className="two-fields"><label>Группа<select value={profile.breedGroupId} onChange={(event) => { setBreedSearch(''); updateBreedGroup(event.target.value as BreedGroupId); }}>{breedGroups.map((group) => <option key={group.id} value={group.id}>{group.title}</option>)}</select></label><label>Порода<select value={profile.breedId} onChange={(event) => { const breed = breedCatalog.find((item) => item.id === event.target.value); updateProfile({ breedId: event.target.value as BreedId, breedGroupId: breed?.groupId ?? profile.breedGroupId }); }}>{filteredBreeds.map((breed) => <option key={breed.id} value={breed.id}>{breed.title}</option>)}</select></label></div>
              {breedSearch && filteredBreeds.length === 0 && <article className="empty-state"><b>Породы нет в справочнике</b><p>Выбери “Другая порода” и добавь название/признаки в заметки.</p></article>}
              <article className="form-section breed-reference"><b>{selectedBreed.emoji} {selectedBreed.title}</b><p>{selectedBreedCare.coat}</p><small>{selectedBreedCare.temperament} · {selectedBreedCare.grooming}</small></article>
              <div className="two-fields"><FieldSelect label="Пол" value={profile.sex} options={sexOptions} onChange={(value) => updateProfile({ sex: value })} /><label>Вес<input value={profile.weight} onChange={(event) => updateProfile({ weight: event.target.value })} placeholder="8.4 кг" /></label></div>
              <FieldSelect label="Шерсть" value={profile.coatType} options={coatOptions} onChange={(value) => updateProfile({ coatType: value })} />
            </div>
          </details>

          <details className="profile-details smart-section"><summary><span>04</span><div><b>Здоровье и уход</b></div></summary>
            <div className="details-body">
              <label>Микрочип<input value={profile.microchip} onChange={(event) => updateProfile({ microchip: event.target.value })} placeholder="номер или: есть / нет" /></label>
              <label>Ветклиника<input value={profile.vetClinic} onChange={(event) => updateProfile({ vetClinic: event.target.value })} placeholder="клиника, врач, телефон" /></label>
              <label>Питание<input value={profile.diet} onChange={(event) => updateProfile({ diet: event.target.value })} placeholder="корм, режим, что нельзя" /></label>
              <label>Аллергии<input value={profile.allergies} onChange={(event) => updateProfile({ allergies: event.target.value })} placeholder="если есть" /></label>
              <label>Лекарства<input value={profile.medication} onChange={(event) => updateProfile({ medication: event.target.value })} placeholder="только как заметка владельца" /></label>
              <label>Заметки здоровья<textarea value={profile.healthNotes} onChange={(event) => updateProfile({ healthNotes: event.target.value })} placeholder="важные наблюдения, без самодиагнозов" /></label>
            </div>
          </details>

          <details className="profile-details smart-section"><summary><span>05</span><div><b>Характер и привычки</b></div></summary>
            <div className="details-body">
              <ChoiceBubbles label="Темперамент" value={profile.temperament} options={temperamentOptions} onChange={(value) => updateProfile({ temperament: value })} />
              <ChoiceBubbles label="Игра" value={profile.playStyle} options={playStyleOptions} onChange={(value) => updateProfile({ playStyle: value })} />
              <ChoiceBubbles label="Дети" value={profile.childFriendly} options={friendlinessOptions} onChange={(value) => updateProfile({ childFriendly: value })} />
              <ChoiceBubbles label="Собаки" value={profile.dogFriendly} options={friendlinessOptions} onChange={(value) => updateProfile({ dogFriendly: value })} />
              <ChoiceBubbles label="Кошки" value={profile.catFriendly} options={friendlinessOptions} onChange={(value) => updateProfile({ catFriendly: value })} />
              <label>Триггеры<input value={profile.triggers} onChange={(event) => updateProfile({ triggers: event.target.value })} placeholder="самокаты, гром, дети, лифт…" /></label>
              <SuggestionBubbles label="Быстрые триггеры" options={['самокаты', 'резкий шум', 'дети бегут навстречу', 'другие собаки близко']} onPick={(trigger) => updateProfile({ triggers: profile.triggers ? `${profile.triggers}, ${trigger}` : trigger })} />
              <label>Один дома<input value={profile.aloneTime} onChange={(event) => updateProfile({ aloneTime: event.target.value })} placeholder="как переносит одиночество" /></label>
            </div>
          </details>

          <details className="profile-details smart-section"><summary><span>06</span><div><b>Фото и заметки</b></div></summary>
            <div className="details-body">
              <div className="upload-inline"><label><input type="file" accept="image/*" multiple onChange={handlePhotos} /><span>{profile.avatarSource === 'uploaded' ? 'Фото уже выбрано · заменить' : hasPhoto ? 'Фото выбрано · сделать портретом' : 'Добавить фото'}</span></label><button onClick={() => createAvatar()}>{avatarState === 'rendering' ? 'Делаю портрет…' : 'Сделать портрет'}</button></div>
              {doneReminders.length === 0 && <article className="empty-state"><b>Пока заметок нет</b><p>Сохрани важное как дело в плане: после выполнения оно останется в истории ухода.</p></article>}
              {doneReminders.length > 0 && <div className="reminder-list">{doneReminders.slice(0, 5).map((reminder) => <article key={reminder.id} className="reminder-card done"><div><b>{reminder.title}</b><p>{new Date(reminder.completedAt || reminder.dueAt).toLocaleDateString('ru-RU')} · готово</p></div><div><button onClick={() => updateReminder(reminder.id, { status: 'active' })}>Вернуть</button></div></article>)}</div>}
              <button className="secondary full" onClick={() => setTab('calendar')}>Добавить дело в план</button>
            </div>
          </details>
        </WatercolorScreen>}

        {tab === 'things' && <WatercolorScreen className="things-composition" tone="gold" eyebrow="вещи" title="Что нужно именно этой собаке" caption="Wishlist, уход, повторные покупки и подарки без превращения Псё в магазин." aside={<span className="watercolor-hero-mark">◈</span>}>
          <PaperSheet className="thing-capture">
            <div className="section-title">
              <div><span className="eyebrow">быстро добавить</span><h3>Вещь, услуга или повторная покупка</h3></div>
              <span>{formatCount(wantedWishlist.length, ['позиция', 'позиции', 'позиций'])}</span>
            </div>
            <input value={newWishTitle} onChange={(event) => setNewWishTitle(event.target.value)} placeholder="Адресник, корм, груминг, игрушка…" />
            <select value={newWishCategory} onChange={(event) => setNewWishCategory(event.target.value)}>
              <option value="gear">амуниция</option>
              <option value="food">корм</option>
              <option value="treats">лакомства</option>
              <option value="toy">игрушка</option>
              <option value="health">здоровье</option>
              <option value="grooming">груминг</option>
              <option value="service">сервис</option>
              <option value="other">другое</option>
            </select>
            <input value={newWishReason} onChange={(event) => setNewWishReason(event.target.value)} placeholder="Зачем это нужно собаке" />
            <button className="primary full" onClick={() => createWishlistItem()} disabled={!newWishTitle.trim()}>{newWishTitle.trim() ? 'Добавить в вещи' : 'Напиши название'}</button>
          </PaperSheet>

          {wishlistHints.length > 0 && <section className="things-hint-shelf" aria-label="Подсказки вещей">
            {wishlistHints.map((hint) => <article key={hint.title}><b>{hint.title}</b><p>{hint.reason}</p><button className="secondary" onClick={() => createWishlistItem(hint)}>Добавить</button></article>)}
          </section>}

          {wantedWishlist.length === 0 && boughtWishlist.length === 0 && <article className="empty-state"><b>Вещей пока нет</b><p>Добавь адресник, корм, груминг, игрушку или услугу. Псё будет связывать это с профилем, триггерами и уходом.</p></article>}

          {wantedWishlist.length > 0 && <section className="things-masonry" aria-label="Wishlist собаки">
            {wantedWishlist.map((item) => <article key={item.id} className={`wishlist-item priority-${item.priority}`}>
              <div><b>{item.title}</b><p>{formatWishlistMeta(item.category, item.priority, item.reason)}</p></div>
              <div className="wishlist-actions">
                {item.url && <a href={item.url} target="_blank" rel="noreferrer">Открыть</a>}
                <button onClick={() => updateWishlistItem(item.id, { status: 'bought' })}>Куплено</button>
                <button className="danger-action" onClick={() => deleteWishlistItem(item.id)}>Убрать</button>
              </div>
            </article>)}
          </section>}

          {boughtWishlist.length > 0 && <section className="wishlist-list" aria-label="История вещей">
            <div className="section-title"><div><span className="eyebrow">история</span><h3>Уже закрыто</h3></div></div>
            {boughtWishlist.slice(0, 4).map((item) => <article key={item.id} className="wishlist-item">
              <div><b>{item.title}</b><p>{formatWishlistMeta(item.category, item.priority, item.reason)}</p></div>
              <div className="wishlist-actions"><button onClick={() => updateWishlistItem(item.id, { status: 'wanted' })}>Вернуть</button><button className="danger-action" onClick={() => deleteWishlistItem(item.id)}>Удалить</button></div>
            </article>)}
          </section>}

          <article className="public-card-privacy-note">
            <b>Не магазин вместо заботы</b>
            <p>Партнёрские рекомендации должны быть помечены отдельно. Сейчас это личный список хозяина: что купить, повторить, подарить или проверить для конкретной собаки.</p>
          </article>
        </WatercolorScreen>}

        {tab === 'map' && <WatercolorScreen className="places-composition" tone="green" eyebrow="места" title="Куда можно" caption="Места для прогулок, рисков и клиник." aside={<span className="watercolor-hero-mark">⌖</span>}>
          <section className="places-field">
            <PaperSheet className="map-sheet"><LiveMap zones={zones} features={visibleMapFeatures} picked={pickedZonePoint} onPick={handleMapPick} drawMode={drawMode} routePoints={routePoints} onMapClick={handleMapClick} /></PaperSheet>
            <FloatingNote className="map-help"><b>{drawMode === 'route' ? 'Рисуешь маршрут' : 'Добавь место'}</b><p>{drawMode === 'route' ? `Точек в маршруте: ${routePoints.length}` : 'Сохраним примерно, без точного адреса.'}</p>{pickedZonePoint && <small>Примерное место выбрано</small>}</FloatingNote>
            <div className="care-actions place-chips"><button onClick={() => createZone({ title: 'Тихий двор для спокойной прогулки', type: 'safe_place', note: 'Без точного адреса, только памятка владельца.' })}>🟢 Тихое место</button><button onClick={() => createZone({ title: 'Зона риска: самокаты / шум', type: 'risk_zone', note: profile.triggers || 'Уточнить триггеры в паспорте.' })}>⚠️ Зона риска</button><button onClick={() => createZone({ title: 'Ветклиника', type: 'clinic', note: profile.vetClinic || 'Добавить контакт в паспорте.' })}>🏥 Ветклиника</button></div>
          </section>
          <p className="map-accessibility-note">Коснись карты, чтобы выбрать примерное место, или сохрани его текстом ниже.</p>
          <FloatingNote className="place-add-note">
            <div className="social-profile-actions">
              <button className="active" onClick={() => setActiveMapLayer('personal')}>Личные места</button>
              <button className={drawMode === 'point' ? 'active' : ''} onClick={() => { setDrawMode(drawMode === 'point' ? 'none' : 'point'); setRoutePoints([]); }}>Место</button>
              <button className={drawMode === 'route' ? 'active' : ''} onClick={() => { setDrawMode(drawMode === 'route' ? 'none' : 'route'); setPickedZonePoint(null); }}>Маршрут</button>
            </div>
            <input value={newZoneTitle} onChange={(event) => setNewZoneTitle(event.target.value)} placeholder="Например: тихий двор, шумный перекрёсток, ветклиника" />
            <select value={newZoneType} onChange={(event) => setNewZoneType(event.target.value)}><option value="safe_place">безопасное место</option><option value="risk_zone">зона риска</option><option value="home_area">домашний район</option><option value="walk_route">маршрут</option><option value="clinic">клиника</option><option value="shop">зоомагазин</option><option value="grooming">груминг</option></select>
            <input value={newZoneNote} onChange={(event) => setNewZoneNote(event.target.value)} placeholder="Заметка: самокаты, тихо утром, хороший врач…" />
            <button className="primary full" onClick={() => createZone()} disabled={!newZoneTitle.trim()}>{!newZoneTitle.trim() ? 'Добавь название места' : pickedZonePoint ? 'Сохранить примерное место' : 'Сохранить без отметки на карте'}</button>
            <div className="care-actions">
              {drawMode === 'route' && routePoints.length > 1 && <button onClick={saveRoute}>Сохранить маршрут</button>}
              {routePoints.length > 0 && <button onClick={() => setRoutePoints([])}>Очистить маршрут</button>}
            </div>
            <p className="privacy-hint">Публичный слой карты скрыт до отдельной модерации и согласия. Сейчас это личные места владельца.</p>
          </FloatingNote>
          {zones.length === 0 && <article className="empty-state"><b>Мест пока нет</b><p>Добавь клинику, парк или любое важное место.</p></article>}
          {zones.length > 0 && <div className="place-ribbon">{zones.map((zone) => <article key={zone.id} className={`zone-card ${zone.type}`}><div><b>{zone.title}</b><p>{formatZoneMeta(zone)}</p></div><div className="wishlist-actions"><button onClick={() => updateZone(zone.id, { type: zone.type === 'risk_zone' ? 'safe_place' : 'risk_zone' })}>{zone.type === 'risk_zone' ? 'Сделать спокойным местом' : 'Отметить как риск'}</button>{pickedZonePoint && <button onClick={() => updateZone(zone.id, { approximateLat: pickedZonePoint.lat, approximateLng: pickedZonePoint.lng })}>Переставить</button>}<button onClick={() => updateZone(zone.id, { radiusMeters: (zone.radius_meters || zone.radiusMeters || 500) + 250 })}>Увеличить радиус</button><button onClick={() => deleteZone(zone.id)}>Удалить</button></div></article>)}</div>}
        </WatercolorScreen>}

        {error && <p className="error-text" role="alert">{error}</p>}
        {notice !== 'idle' && <div className="toast" role="status" aria-live="polite">{notice === 'loaded' ? 'Данные загружены' : notice === 'copied' ? 'Скопировано' : notice === 'sharing' ? 'Открываю отправку' : notice === 'downloaded' ? 'Карточка сохранена' : notice === 'applied' ? 'Действие выполнено' : 'Профиль сохранён'}</div>}
      </section>

      <nav className="app-tabs" aria-label="Основные разделы">
        {[
          ['today', 'всё'], ['profile', 'псё'], ['map', 'карта'], ['nearby', 'рядом'], ['things', 'вещи'],
        ].map(([id, title]) => <button key={id} onClick={() => setTab(id as Tab)} className={tab === id ? 'active' : ''} aria-label={`Открыть раздел ${title}`} aria-current={tab === id ? 'page' : undefined}>{title}</button>)}
      </nav>

    </main>
  );
}
