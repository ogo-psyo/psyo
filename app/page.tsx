'use client';

import { ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Buildings, CalendarBlank, CalendarDots, CaretDown, CheckCircle, FilePdf, Files, MapPin, MapTrifold, PawPrint, Plus, ShieldWarning, ShoppingBag, Sparkle, TextT, Trash, UploadSimple } from '@phosphor-icons/react';
import { GeneratedAvatar } from '@/components/GeneratedAvatar';
import { PaperSheet, WatercolorScreen } from '@/components/watercolor';
import { AppNavigation, type PrimaryRoute } from '@/components/app/AppNavigation';
import { ProductionAssistantSheet, ProductionDocumentSheet, ProductionJourney, type JourneyProfileEntry } from '@/components/journey/ProductionJourney';
import { VoiceObservationCapture } from '@/components/journey/VoiceObservationCapture';
import { ProductionMapWorkspace } from '@/components/journey/ProductionMapWorkspace';
import type { ProductionMapMode, RouteDraftMeta } from '@/components/journey/ProductionMapWorkspace';
import { RouteDeleteDialog } from '@/components/journey/RouteDeleteDialog';
import { DesktopContextPanel } from '@/components/app/DesktopContextPanel';
import { CareActionNotice, type CareFeedback } from '@/components/care/CareActionNotice';
import { DeleteCareDialog, type PendingCareDeletion } from '@/components/care/DeleteCareDialog';
import { ObservationEditor, type ObservationEditorDraft } from '@/components/care/ObservationEditor';
import { CoreOnboarding } from '@/components/onboarding/CoreOnboarding';
import type { DogModuleSummary } from '@/components/home/AllFunctionsHub';
import { HabitScreen, type HabitDraft, type HabitView } from '@/components/habits/HabitScreen';
import { HealthTimelineScreen } from '@/components/health/HealthTimelineScreen';
import { ProfileMemoryWorkspace } from '@/components/profile/ProfileMemoryWorkspace';
import { NextCareCard } from '@/components/today/NextCareCard';
import { ObservationDisclosure } from '@/components/today/ObservationDisclosure';
import { CandidateCard } from '@/components/social/CandidateCard';
import { CityCommunities, type CityCommunity } from '@/components/social/CityCommunities';
import { RequestsPanel, type SocialRequestView } from '@/components/social/RequestsPanel';
import { SocialProfileSheet } from '@/components/social/SocialProfileSheet';
import { ProductionWoofWorkspace } from '@/components/social/ProductionWoofWorkspace';
import { SelectField } from '@/components/ui/FormControls';
import {
  anchorCards,
  avatarStyles,
  breedCatalog,
  breedGroups,
  coatOptions,
  defaultProfile,
  energyOptions,
  friendlinessOptions,
  getBreedGroup,
  getBreedLabel,
  getBreedCare,
  lifeStageOptions,
  maxPhotos,
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
import { buildTodayCareView } from '@/lib/today';
import { normalizeOwnerRoutes, removeOwnerRoute, upsertOwnerRoute, type OwnerRouteView } from '@/lib/mapUi';
import { rc1Config } from '@/lib/rc1';
import { extractObservationCandidates, ingestionFingerprint, type IngestionDecision, type ObservationCandidate } from '@/lib/observationIngestion';
import type { CandidateGroup, CoarseLocation, SocialProfile, SocialScenario, WalkPace, WalkSignal } from '@/lib/socialCore';
import type { ActionSuggestion } from '@/packages/contracts';

type AvatarState = 'idle' | 'rendering' | 'ready';
type Notice = 'idle' | 'saved' | 'mapSaved' | 'copied' | 'loaded' | 'sharing' | 'downloaded' | 'applied';
type ReminderRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
type ReminderTimeMode = 'exact' | 'flexible' | 'approximate';
type ReminderView = { id: string; petId: string; type: string; title: string; dueAt: string; recurrence?: ReminderRecurrence; status: string; snoozedUntil?: string; completedAt?: string; nextDueAt?: string };
type ReminderHistoryItem = { id: string; eventType?: string; payload?: { dueAt?: string; completedAt?: string; nextDueAt?: string | null }; createdAt: string };
type WishlistView = { id: string; petId: string; title: string; category: string; reason?: string; url?: string; priority: string; status: string; created_at?: string };
type ZoneView = { id: string; pet_id?: string; petId?: string; type: string; title: string; note?: string; approximate_lat?: number | string | null; approximate_lng?: number | string | null; radius_meters?: number; radiusMeters?: number; visibility?: 'private' | 'shared' | 'public'; share_token?: string | null; created_at?: string };
type PetSwitchOption = { id: string; name: string; breed_id?: string; breed_group_id?: string; avatar_url?: string; avatar_source?: 'none' | 'uploaded' | 'generated'; active_avatar_asset_id?: string | null; photo_urls?: string[] };
type AuthSession = { access_token: string; user: { email?: string } };
type ObservationView = { id: string; petId?: string; mood?: string; appetite?: string; stool?: string; energy?: string; note?: string; createdAt: string; syncStatus?: 'local' | 'saved' };
type ObservationDraft = { mood: string; appetite: string; stool: string; energy: string; note?: string };
type DocumentView = { id: string; petId: string; kind: string; title: string; clinic?: string | null; documentDate?: string | null; originalName: string; mimeType: string; sizeBytes: number; createdAt: string };
type SocialInviteView = { token: string; scenario: SocialScenario; petName: string | null; expiresAt: string };
type Tab = 'today' | 'calendar' | 'habits' | 'health' | 'nearby' | 'map' | 'card' | 'profile' | 'things';
type DrawMode = 'none' | 'point' | 'route';
type MapSaveMode = 'private' | 'shared';
type ViralCardFormat = 'story' | 'square' | 'poster';
type ViralCardMood = 'soft' | 'bold' | 'safety' | 'club';
type ViralFactKey = 'social' | 'energy' | 'care' | 'triggers' | 'area' | 'breed';
type PublicCardFieldKey = 'breed' | 'character' | 'triggers' | 'area';
type PublicCardCheck = { label: string; done: boolean; missing: string };
type TelegramSessionView = { mode: 'loading' | 'browser' | 'telegram' | 'error'; psyoUserId?: string; ownerId?: string; firstName?: string; username?: string; message?: string };
type BillingView = {
  entitlements?: { tier?: 'free' | 'plus'; expiresAt?: string | null };
  plans?: { plus?: { name: string; priceStars: number; headline: string; included: string[]; cta: string } };
  upgrade?: { available: boolean; disabledReason?: string | null };
  meta?: { billingEnabled: boolean; newInvoicesEnabled?: boolean; priceStars: number };
};
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
const observationsStorageKey = (petId?: string) => `pso.topapp.observations.v2:${petId || 'guest'}`;
const heroStyleOptions = avatarStyles.filter((style) => ['city', 'space', 'sticker'].includes(style.id));
const viralFactOrder: ViralFactKey[] = ['social', 'energy', 'care', 'triggers', 'area', 'breed'];
const defaultPublicCardFields: PublicCardFieldKey[] = ['breed', 'character', 'triggers', 'area'];
const cityCommunities: CityCommunity[] = [
  {
    city: 'Москва',
    chatUrl: process.env.NEXT_PUBLIC_PSYO_MOSCOW_CHAT_URL,
    folderUrl: process.env.NEXT_PUBLIC_PSYO_COMMUNITIES_FOLDER_URL,
  },
  {
    city: 'Санкт-Петербург',
    chatUrl: process.env.NEXT_PUBLIC_PSYO_SPB_CHAT_URL,
    folderUrl: process.env.NEXT_PUBLIC_PSYO_COMMUNITIES_FOLDER_URL,
  },
];
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
  mood: '',
  appetite: '',
  stool: '',
  energy: '',
  note: '',
};

const reminderRecurrenceOptions: { value: ReminderRecurrence; label: string }[] = [
  { value: 'none', label: 'Не повторять' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'monthly', label: 'Каждый месяц' },
  { value: 'quarterly', label: 'Раз в три месяца' },
  { value: 'yearly', label: 'Каждый год' },
];

const reminderTimeModeOptions: { value: ReminderTimeMode; label: string }[] = [
  { value: 'exact', label: 'Точное время' },
  { value: 'flexible', label: 'В течение дня' },
  { value: 'approximate', label: 'Примерно' },
];

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
  bold: { bg: '#17112a', fg: '#fff8e7', muted: '#d9c8ff', accent: '#7ee7d2', soft: '#ff8a5b', label: 'КАРТОЧКА ПСЁ' },
  soft: { bg: '#fff4d7', fg: '#25192f', muted: '#6f5f6f', accent: '#ff8a5b', soft: '#a7eadf', label: 'ПАМЯТКА ПСЁ' },
  safety: { bg: '#f4fbf3', fg: '#18251f', muted: '#557063', accent: '#1d927d', soft: '#ffc75d', label: 'DOG WALK RULES' },
  club: { bg: '#111513', fg: '#f7f0df', muted: '#b7c4b8', accent: '#d7ff6f', soft: '#f0a37b', label: 'КЛУБ ПСЁ' },
};

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <SelectField label={label} value={value} onChange={(event) => onChange(event.target.value)}><option value="">не указано</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</SelectField>;
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

function SecondaryFlowHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button className="secondary-flow-back" type="button" onClick={onBack}>
      <ArrowLeft weight="bold" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
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

const onboardingCareOptions = [
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

function observationSummary(item: ObservationView) {
  return [item.mood, item.appetite && `аппетит ${item.appetite}`, item.stool && `стул ${item.stool}`, item.energy && `энергия ${item.energy}`].filter(Boolean).join(' · ') || item.note || 'Заметка владельца';
}

function reminderDueAt(date: string, time: string, mode: ReminderTimeMode) {
  const fallbackTime = mode === 'flexible' ? '12:00' : mode === 'approximate' ? '10:00' : '09:00';
  const value = `${date || dateInputValue(new Date())}T${mode === 'exact' ? (time || fallbackTime) : fallbackTime}:00`;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function reminderRecurrenceLabel(recurrence?: ReminderRecurrence) {
  return reminderRecurrenceOptions.find((option) => option.value === recurrence)?.label ?? 'Не повторяется';
}

function reminderTimeLabel(reminder: ReminderView) {
  const date = new Date(reminder.snoozedUntil || reminder.dueAt);
  if (!Number.isFinite(date.getTime())) return 'Дата не указана';
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const timing = time === '12:00' ? 'в течение дня' : time === '10:00' ? 'примерно' : `в ${time}`;
  return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })}, ${timing}`;
}

function reminderDateInputValue(reminder: ReminderView) {
  const date = new Date(reminder.snoozedUntil || reminder.dueAt);
  return Number.isFinite(date.getTime()) ? dateInputValue(date) : dateInputValue(new Date());
}

function calendarStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function dbToProfile(payload: any, preferredPetId?: string): Partial<DogProfile> | null {
  const selectedDemoPet = payload?.mode === 'demo' && preferredPetId
    ? payload?.pets?.find((pet: any) => String(pet.id) === preferredPetId)
    : null;
  const pet = selectedDemoPet || payload?.pet;
  if ((!payload?.connected && payload?.mode !== 'demo') || !pet) return null;
  const passport = payload.passport ?? {};
  const social = payload.social ?? {};
  const avatarSource = pet.avatar_source || pet.avatarSource || (pet.avatar_url || pet.avatarUrl ? 'uploaded' : 'none');
  const activeAvatarAssetId = pet.active_avatar_asset_id || pet.activeAvatarAssetId;
  const avatarImageUrl = avatarSource === 'none'
    ? ''
    : activeAvatarAssetId
      ? `/api/v1/pets/${pet.id}/avatar/assets/${activeAvatarAssetId}/render`
      : avatarSource === 'uploaded' ? pet.avatar_url || pet.avatarUrl || '' : '';
  return {
    backendPetId: pet.id,
    avatarImageUrl,
    avatarSource,
    photoUrls: avatarSource === 'none' ? [] : Array.isArray(pet.photo_urls || pet.photoUrls) ? (pet.photo_urls || pet.photoUrls).filter(Boolean) : pet.avatar_url || pet.avatarUrl ? [pet.avatar_url || pet.avatarUrl] : [],
    dogName: pet.name || '',
    breedId: pet.breed_id || pet.breedId || 'mixed',
    breedGroupId: pet.breed_group_id || pet.breedGroupId || 'mixed',
    breedCustom: pet.custom_breed || pet.customBreed || '',
    lifeStage: pet.life_stage || pet.lifeStage || '',
    sex: pet.sex || '',
    weight: pet.weight_kg || pet.weightKg ? `${pet.weight_kg || pet.weightKg} кг` : '',
    microchip: passport.microchip || '',
    vetClinic: passport.vet_clinic || passport.vetClinic || '',
    diet: passport.diet || '',
    allergies: passport.allergies || '',
    medication: passport.medication || '',
    healthNotes: passport.health_notes || passport.healthNotes || '',
    vaccineStatus: fromDbEnum(passport.vaccine_status || passport.vaccineStatus, dbVaccineStatusMap),
    parasiteStatus: fromDbEnum(passport.parasite_status || passport.parasiteStatus, dbParasiteStatusMap),
    socialMode: fromDbEnum(social.social_mode || social.socialMode, dbSocialModeMap),
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
  const [profileHydrated, setProfileHydrated] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState('');
  const [avatarDraftAssetId, setAvatarDraftAssetId] = useState('');
  const [avatarReferenceAssetId, setAvatarReferenceAssetId] = useState('');
  const [avatarDraftSource, setAvatarDraftSource] = useState<'uploaded' | 'generated' | null>(null);
  const [avatarOwnerPrompt, setAvatarOwnerPrompt] = useState('');
  const [avatarConsent, setAvatarConsent] = useState(false);
  const [avatarComposerOpen, setAvatarComposerOpen] = useState(false);
  const [avatarCapabilities, setAvatarCapabilities] = useState({ identityEnabled: false, uploadsEnabled: false, generationEnabled: false, providerReady: false });
  const [demoMode, setDemoMode] = useState(false);
  const [notice, setNotice] = useState<Notice>('idle');
  const [error, setError] = useState('');
  const [tab, setTabState] = useState<Tab>('today');
  const [journeyDetail, setJourneyDetail] = useState<PrimaryRoute | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [reminders, setReminders] = useState<ReminderView[]>([]);
  const [wishlist, setWishlist] = useState<WishlistView[]>([]);
  const [zones, setZones] = useState<ZoneView[]>([]);
  const [removedWishlistItem, setRemovedWishlistItem] = useState<WishlistView | null>(null);
  const [removedZone, setRemovedZone] = useState<ZoneView | null>(null);
  const [pets, setPets] = useState<PetSwitchOption[]>([]);
  const [activePetId, setActivePetId] = useState('');
  const [observations, setObservations] = useState<ObservationView[]>([]);
  const [documents, setDocuments] = useState<DocumentView[]>([]);
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentFileName, setDocumentFileName] = useState('');
  const [documentBusyId, setDocumentBusyId] = useState<string | null>(null);
  const documentUploadTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [habits, setHabits] = useState<HabitView[]>([]);
  const [habitLoading, setHabitLoading] = useState(false);
  const [habitBusyId, setHabitBusyId] = useState<string | null>(null);
  const [dogSummary, setDogSummary] = useState<DogModuleSummary | null>(null);
  const [moduleErrors, setModuleErrors] = useState<{ habits?: string; health?: string }>({});
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  const [socialCandidates, setSocialCandidates] = useState<CandidateGroup>({ nearby: [], city: [] });
  const [socialRequests, setSocialRequests] = useState<SocialRequestView[]>([]);
  const [walkSignals, setWalkSignals] = useState<WalkSignal[]>([]);
  const [walkSignalReason, setWalkSignalReason] = useState('');
  const [socialViewerLocation, setSocialViewerLocation] = useState<CoarseLocation | null>(null);
  const [socialViewerRadiusMeters, setSocialViewerRadiusMeters] = useState(3000);
  const [nearbyState, setNearbyState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [nearbyReason, setNearbyReason] = useState('');
  const [socialBusyId, setSocialBusyId] = useState<string | null>(null);
  const [socialLocating, setSocialLocating] = useState(false);
  const [missingTelegramUsernameAction, setMissingTelegramUsernameAction] = useState<string | null>(null);
  const [socialInvite, setSocialInvite] = useState<SocialInviteView | null>(null);
  const [socialInviteState, setSocialInviteState] = useState<'idle' | 'loading' | 'ready' | 'gone' | 'error'>('idle');
  const [observationDraft, setObservationDraft] = useState<ObservationDraft>(defaultObservationDraft);
  const [observationSaving, setObservationSaving] = useState(false);
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const [observationEditDraft, setObservationEditDraft] = useState<ObservationEditorDraft>(defaultObservationDraft);
  const [observationMutationBusy, setObservationMutationBusy] = useState(false);
  const [recentlyDeletedObservation, setRecentlyDeletedObservation] = useState<ObservationView | null>(null);
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderType, setNewReminderType] = useState('custom');
  const [newReminderDueDate, setNewReminderDueDate] = useState(() => dateInputValue(new Date()));
  const [newReminderDueTime, setNewReminderDueTime] = useState('09:00');
  const [newReminderTimeMode, setNewReminderTimeMode] = useState<ReminderTimeMode>('flexible');
  const [newReminderRecurrence, setNewReminderRecurrence] = useState<ReminderRecurrence>('none');
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [reminderMutationBusy, setReminderMutationBusy] = useState<string | null>(null);
  const [reminderHistory, setReminderHistory] = useState<Record<string, ReminderHistoryItem[]>>({});
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => dateInputValue(new Date()));
  const [careView, setCareView] = useState<'active' | 'history'>('active');
  const [newZoneTitle, setNewZoneTitle] = useState('');
  const [newZoneNote, setNewZoneNote] = useState('');
  const [newZoneType, setNewZoneType] = useState('safe_place');
  const [pickedZonePoint, setPickedZonePoint] = useState<{ lat: number; lng: number } | null>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [mapSaveMode, setMapSaveMode] = useState<MapSaveMode>('private');
  const [routePoints, setRoutePoints] = useState<number[][]>([]);
  const [ownerRoutes, setOwnerRoutes] = useState<OwnerRouteView[]>([]);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeTitleDraft, setRouteTitleDraft] = useState('');
  const [routeDescriptionDraft, setRouteDescriptionDraft] = useState('');
  const [routeMutationBusy, setRouteMutationBusy] = useState<string | null>(null);
  const [mapDraftSaving, setMapDraftSaving] = useState(false);
  const [mapRouteMeta, setMapRouteMeta] = useState<RouteDraftMeta | null>(null);
  const [pendingRouteDeletion, setPendingRouteDeletion] = useState<OwnerRouteView | null>(null);
  const [newWishTitle, setNewWishTitle] = useState('');
  const [newWishReason, setNewWishReason] = useState('');
  const [newWishCategory, setNewWishCategory] = useState('gear');
  const [thingCaptureOpen, setThingCaptureOpen] = useState(false);
  const [viralCardFormat, setViralCardFormat] = useState<ViralCardFormat>('story');
  const [viralCardMood, setViralCardMood] = useState<ViralCardMood>('bold');
  const [viralCardHeadline, setViralCardHeadline] = useState('');
  const [viralSelectedFacts, setViralSelectedFacts] = useState<ViralFactKey[]>(['social', 'energy', 'care', 'triggers']);
  const [publicCardVisibleFields, setPublicCardVisibleFields] = useState<PublicCardFieldKey[]>(defaultPublicCardFields);
  const [publishedPublicCardPath, setPublishedPublicCardPath] = useState('');
  const [publicCardLinkBusy, setPublicCardLinkBusy] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [assistantActions, setAssistantActions] = useState<ActionSuggestion[]>([]);
  const [assistantThreadId, setAssistantThreadId] = useState('');
  const [assistantDiagnostic, setAssistantDiagnostic] = useState<{ provider?: string; mode?: string }>({});
  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [breedSearch, setBreedSearch] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [dogCreationOpen, setDogCreationOpen] = useState(false);
  const [heroNameDraft, setHeroNameDraft] = useState('');
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [addDogOpen, setAddDogOpen] = useState(false);
  const [newDogName, setNewDogName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [petMutationBusy, setPetMutationBusy] = useState(false);
  const [dogDeleteName, setDogDeleteName] = useState('');
  const [accountDeleteConfirmation, setAccountDeleteConfirmation] = useState('');
  const [telegramSession, setTelegramSession] = useState<TelegramSessionView>({ mode: 'loading' });

  useEffect(() => {
    setAssistantThreadId('');
    setAssistantMessages([]);
    setAssistantAnswer('');
    setAssistantActions([]);
    setAssistantDiagnostic({});
  }, [profile.backendPetId]);
  const [billing, setBilling] = useState<BillingView | null>(null);
  const [careFeedback, setCareFeedback] = useState<CareFeedback>(null);
  const [pendingCareDeletion, setPendingCareDeletion] = useState<PendingCareDeletion>(null);
  const [careDeletionBusy, setCareDeletionBusy] = useState(false);
  const guestPetIdRef = useRef<string | null>(null);
  const observationsLoadedRef = useRef(false);
  const phoneShellRef = useRef<HTMLElement | null>(null);
  const dogCreationKeyRef = useRef<string | null>(null);
  const demoSeededRef = useRef(false);
  const addDogKeyRef = useRef<string | null>(null);
  const socialRequestKeysRef = useRef<Record<string, string>>({});
  const careMutationKeysRef = useRef(new Map<string, string>());
  const careMutationTimesRef = useRef(new Map<string, string>());

  async function loadPublicDogCard(petId: string) {
    if (!petId || isGuestMode()) {
      setPublishedPublicCardPath('');
      return;
    }
    const response = await fetch(`/api/dog-cards?petId=${encodeURIComponent(petId)}`, {
      credentials: 'include',
      headers: authHeaders(),
    });
    if (!response.ok) {
      setPublishedPublicCardPath('');
      return;
    }
    const payload = await response.json().catch(() => ({}));
    setPublishedPublicCardPath(typeof payload.path === 'string' ? payload.path : '');
  }

  function careMutationKey(scope: string) {
    const existing = careMutationKeysRef.current.get(scope);
    if (existing) return existing;
    const key = `pso-${crypto.randomUUID()}`;
    careMutationKeysRef.current.set(scope, key);
    return key;
  }

  function careMutationTime(scope: string, factory: () => string) {
    const existing = careMutationTimesRef.current.get(scope);
    if (existing) return existing;
    const value = factory();
    careMutationTimesRef.current.set(scope, value);
    return value;
  }

  function finishCareMutation(scope: string) {
    careMutationKeysRef.current.delete(scope);
    careMutationTimesRef.current.delete(scope);
  }

  function resetViewScroll() {
    window.requestAnimationFrame(() => {
      phoneShellRef.current?.scrollTo({ top: 0, behavior: 'auto' });
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }

  function setTab(nextTab: Tab) {
    if (nextTab === tab) return;
    setTabState(nextTab);
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = nextTab;
      window.history.pushState({ tab: nextTab }, '', nextUrl);
    }
  }

  function closeSecondaryFlow(parent: 'today' | 'profile') {
    setTabState(parent);
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = parent;
    window.history.replaceState({ tab: parent }, '', nextUrl);
  }

  function openAssistantSheet() {
    setError('');
    setAssistantOpen(true);
    const nextUrl = new URL(window.location.href);
    window.history.pushState({ tab, overlay: 'assistant' }, '', nextUrl);
  }

  function openJourneyDetail(detail: 'profile' | 'nearby' | 'things') {
    setJourneyDetail(detail);
    const nextUrl = new URL(window.location.href);
    window.history.pushState({ tab, detail }, '', nextUrl);
  }

  function closeJourneyDetail() {
    if (window.history.state?.detail) window.history.back();
    else setJourneyDetail(null);
  }

  useEffect(() => {
    const knownTabs: Tab[] = ['today', 'calendar', 'habits', 'health', 'nearby', 'map', 'card', 'profile', 'things'];
    const syncTabFromLocation = () => {
      const requested = window.location.hash.replace(/^#/, '') as Tab;
      setTabState(knownTabs.includes(requested) ? requested : 'today');
    };
    const handlePopState = () => {
      if (assistantOpen) setAssistantOpen(false);
      if (journeyDetail) setJourneyDetail(null);
      syncTabFromLocation();
    };
    syncTabFromLocation();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [assistantOpen, journeyDetail]);

  useEffect(() => {
    resetViewScroll();
  }, [tab, journeyDetail]);

  useEffect(() => {
    if (notice === 'idle') return;
    const timer = window.setTimeout(() => setNotice('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (tab !== 'nearby') return;
    if (!profile.backendPetId || (!session?.access_token && !telegramSession.ownerId)) {
      setSocialProfile(null);
      setSocialCandidates({ nearby: [], city: [] });
      setSocialRequests([]);
      setWalkSignals([]);
      setNearbyReason('AUTH_OR_PET_REQUIRED');
      setNearbyState('idle');
      return;
    }

    const controller = new AbortController();
    const bootstrap = async () => {
      let viewerLocation = socialViewerLocation;
      if (!viewerLocation && navigator.geolocation) {
        setSocialLocating(true);
        viewerLocation = await new Promise<CoarseLocation | null>((resolve) => navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
        ));
        setSocialLocating(false);
        if (viewerLocation) setSocialViewerLocation(viewerLocation);
      }
      await loadSocialSurface(controller.signal, viewerLocation);
    };
    bootstrap().catch((lookupError) => {
      if (lookupError instanceof DOMException && lookupError.name === 'AbortError') return;
      setSocialCandidates({ nearby: [], city: [] });
      setNearbyReason('NEARBY_LOOKUP_FAILED');
      setNearbyState('error');
    });

    return () => controller.abort();
  }, [profile.backendPetId, session?.access_token, tab, telegramSession.ownerId]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('socialInvite');
    if (!token || (!session?.access_token && !telegramSession.ownerId)) return;
    setSocialInviteState('loading');
    fetch(`/api/social/invites/${encodeURIComponent(token)}`, { headers: authHeaders(), credentials: 'include' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 410) {
          setSocialInviteState('gone');
          setSocialInvite(null);
          return;
        }
        if (!response.ok) throw new Error('INVITE_LOOKUP_FAILED');
        setSocialInvite({
          token,
          scenario: payload.invite.scenario,
          petName: payload.invite.pet?.name ?? null,
          expiresAt: payload.invite.expiresAt,
        });
        setSocialInviteState('ready');
        setTab('nearby');
      })
      .catch(() => setSocialInviteState('error'));
  }, [session?.access_token, telegramSession.ownerId]);

  function authHeaders(): Record<string, string> {
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  async function loadSocialSurface(signal?: AbortSignal, viewerLocationOverride?: CoarseLocation | null) {
    const petId = profile.backendPetId;
    if (!petId) return;
    setNearbyState('loading');
    setNearbyReason('');
    setWalkSignalReason('');
    const requestOptions = { headers: authHeaders(), credentials: 'include' as const, signal };
    const viewerLocation = viewerLocationOverride ?? socialViewerLocation;
    const signalParams = new URLSearchParams({ petId });
    if (viewerLocation) {
      signalParams.set('lat', String(viewerLocation.lat));
      signalParams.set('lng', String(viewerLocation.lng));
    }
    const [profileResponse, candidatesResponse, requestsResponse, signalsResponse] = await Promise.all([
      fetch(`/api/social/profile?petId=${encodeURIComponent(petId)}`, requestOptions),
      fetch(`/api/social/candidates?petId=${encodeURIComponent(petId)}`, requestOptions),
      fetch(`/api/social/requests?petId=${encodeURIComponent(petId)}`, requestOptions),
      fetch(`/api/social/signals?${signalParams.toString()}`, requestOptions),
    ]);
    const [profilePayload, candidatesPayload, requestsPayload, signalsPayload] = await Promise.all([
      profileResponse.json().catch(() => ({})),
      candidatesResponse.json().catch(() => ({})),
      requestsResponse.json().catch(() => ({})),
      signalsResponse.json().catch(() => ({})),
    ]);
    if (!profileResponse.ok || !requestsResponse.ok) throw new Error('SOCIAL_SURFACE_FAILED');
    setSocialProfile(profilePayload.profile ?? null);
    setSocialRequests(Array.isArray(requestsPayload.requests) ? requestsPayload.requests : []);
    setMissingTelegramUsernameAction(requestsPayload.missingTelegramUsernameAction ?? null);
    if (signalsResponse.ok) {
      setWalkSignals(Array.isArray(signalsPayload.signals) ? signalsPayload.signals : []);
      if (signalsPayload.viewer?.approximateLocation) setSocialViewerLocation(signalsPayload.viewer.approximateLocation);
      if (Number.isFinite(Number(signalsPayload.viewer?.radiusMeters))) setSocialViewerRadiusMeters(Number(signalsPayload.viewer.radiusMeters));
    } else if (signalsResponse.status === 409 && ['VIEWER_LOCATION_REQUIRED', 'CITY_NOT_SUPPORTED'].includes(signalsPayload.error)) {
      setWalkSignals([]);
      setWalkSignalReason(signalsPayload.error);
    } else {
      throw new Error('SOCIAL_SIGNALS_FAILED');
    }
    if (candidatesResponse.ok) {
      setSocialCandidates({
        nearby: Array.isArray(candidatesPayload.nearby) ? candidatesPayload.nearby : [],
        city: Array.isArray(candidatesPayload.city) ? candidatesPayload.city : [],
      });
    } else if (candidatesResponse.status === 409 && candidatesPayload.error === 'DISCOVERY_NOT_ENABLED') {
      setSocialCandidates({ nearby: [], city: [] });
      setNearbyReason('DISCOVERY_NOT_ENABLED');
    } else {
      throw new Error('SOCIAL_DISCOVERY_FAILED');
    }
    setNearbyState('ready');
  }

  async function refreshLiveSocial(signal?: AbortSignal) {
    const petId = profile.backendPetId;
    if (!petId) return;
    const signalParams = new URLSearchParams({ petId });
    if (socialViewerLocation) {
      signalParams.set('lat', String(socialViewerLocation.lat));
      signalParams.set('lng', String(socialViewerLocation.lng));
    }
    const requestOptions = { headers: authHeaders(), credentials: 'include' as const, signal };
    const [signalsResponse, requestsResponse] = await Promise.all([
      fetch(`/api/social/signals?${signalParams.toString()}`, requestOptions),
      fetch(`/api/social/requests?petId=${encodeURIComponent(petId)}`, requestOptions),
    ]);
    const [signalsPayload, requestsPayload] = await Promise.all([
      signalsResponse.json().catch(() => ({})),
      requestsResponse.json().catch(() => ({})),
    ]);
    if (signalsResponse.ok) {
      setWalkSignals(Array.isArray(signalsPayload.signals) ? signalsPayload.signals : []);
      setWalkSignalReason('');
      if (signalsPayload.viewer?.approximateLocation) setSocialViewerLocation(signalsPayload.viewer.approximateLocation);
    }
    if (requestsResponse.ok) {
      setSocialRequests(Array.isArray(requestsPayload.requests) ? requestsPayload.requests : []);
      setMissingTelegramUsernameAction(requestsPayload.missingTelegramUsernameAction ?? null);
    }
  }

  async function saveSocialProfile(draft: Omit<SocialProfile, 'petId'>) {
    if (!profile.backendPetId || socialBusyId) return;
    setSocialBusyId('profile');
    setError('');
    try {
      const response = await fetch('/api/social/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ petId: profile.backendPetId, ...draft }),
      });
      if (!response.ok) {
        setError('Не получилось сохранить анкету. Проверь поля и попробуй ещё раз.');
        return;
      }
      await loadSocialSurface();
    } finally {
      setSocialBusyId(null);
    }
  }

  async function hideSocialProfile() {
    if (!profile.backendPetId || socialBusyId) return;
    setSocialBusyId('profile');
    try {
      const response = await fetch(`/api/social/profile?petId=${encodeURIComponent(profile.backendPetId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!response.ok) {
        setError('Не получилось скрыть анкету. Попробуй ещё раз.');
        return;
      }
      await loadSocialSurface();
    } finally {
      setSocialBusyId(null);
    }
  }

  function locateForSocial(onReady: (location: CoarseLocation) => void) {
    if (!navigator.geolocation) {
      setError('На этом устройстве поиск по расстоянию недоступен. Можно искать по городу и району.');
      return;
    }
    setSocialLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onReady({ lat: position.coords.latitude, lng: position.coords.longitude });
        setSocialLocating(false);
      },
      () => {
        setSocialLocating(false);
        setError('Геодоступ не получен. Псё продолжит искать по городу и району.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  function locateForWalkSignals() {
    if (!navigator.geolocation) {
      setWalkSignalReason('VIEWER_LOCATION_REQUIRED');
      return;
    }
    setSocialLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        setSocialViewerLocation(next);
        setSocialLocating(false);
        loadSocialSurface(undefined, next).catch(() => setNearbyState('error'));
      },
      () => {
        setSocialLocating(false);
        setWalkSignalReason('VIEWER_LOCATION_REQUIRED');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function sendSocialRequest(candidatePetId: string, scenario: SocialScenario, signalId?: string) {
    if (!profile.backendPetId || socialBusyId) return;
    const keyId = `${candidatePetId}:${scenario}:${signalId ?? 'profile'}`;
    const idempotencyKey = socialRequestKeysRef.current[keyId] ?? `social-request:${crypto.randomUUID()}`;
    socialRequestKeysRef.current[keyId] = idempotencyKey;
    setSocialBusyId(candidatePetId);
    try {
      const response = await fetch('/api/social/requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...authHeaders() },
        body: JSON.stringify({
          senderPetId: profile.backendPetId,
          recipientPetId: candidatePetId,
          scenario,
          signalId,
          idempotencyKey,
        }),
      });
      if (!response.ok && response.status !== 409) {
        setError('Не получилось отправить запрос. Попробуй ещё раз.');
        return;
      }
      delete socialRequestKeysRef.current[keyId];
      await loadSocialSurface();
    } finally {
      setSocialBusyId(null);
    }
  }

  async function saveWalkSignal(draft: { startsAt: string; pace: WalkPace; note: string; location: CoarseLocation }) {
    if (!profile.backendPetId || socialBusyId) return;
    const idempotencyKey = `walk-signal:${crypto.randomUUID()}`;
    setSocialBusyId('signal');
    setSocialViewerLocation(draft.location);
    setError('');
    try {
      const response = await fetch('/api/social/signals', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...authHeaders() },
        body: JSON.stringify({
          petId: profile.backendPetId,
          city: socialProfile?.city ?? 'moscow',
          district: socialProfile?.district ?? null,
          coarseLocation: draft.location,
          startsAt: draft.startsAt,
          pace: draft.pace,
          note: draft.note,
          idempotencyKey,
        }),
      });
      if (!response.ok) {
        setError('Не получилось дать Гав. Проверь время и попробуй ещё раз.');
        return;
      }
      await loadSocialSurface();
    } finally { setSocialBusyId(null); }
  }

  async function closeWalkSignal(status: 'completed' | 'cancelled') {
    if (!profile.backendPetId || socialBusyId) return;
    setSocialBusyId('signal');
    try {
      const response = await fetch('/api/social/signals', {
        method: 'DELETE', credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ petId: profile.backendPetId, status }),
      });
      if (!response.ok) { setError('Не получилось завершить Гав. Попробуй ещё раз.'); return; }
      await loadSocialSurface();
    } finally { setSocialBusyId(null); }
  }

  async function updateSocialRequest(id: string, action: 'accept' | 'reject' | 'cancel' | 'close' | 'block') {
    if (socialBusyId) return;
    setSocialBusyId(id);
    try {
      const response = await fetch(`/api/social/requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) {
        setError(action === 'block' ? 'Не получилось заблокировать пользователя.' : 'Не получилось изменить запрос.');
        return;
      }
      await loadSocialSurface();
    } finally {
      setSocialBusyId(null);
    }
  }

  async function reportSocialRequest(id: string, reason: string) {
    if (socialBusyId) return;
    const idempotencyKey = `social-report:${crypto.randomUUID()}`;
    setSocialBusyId(id);
    try {
      const response = await fetch(`/api/social/requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...authHeaders() },
        body: JSON.stringify({ action: 'report', reason, idempotencyKey }),
      });
      if (!response.ok) {
        setError('Не получилось отправить жалобу. Попробуй ещё раз.');
        return;
      }
      await loadSocialSurface();
    } finally {
      setSocialBusyId(null);
    }
  }

  function openTelegramDestination(url: string) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { return setError('Telegram-ссылка недоступна.'); }
    if (parsed.protocol !== 'https:' || !['t.me', 'telegram.me'].includes(parsed.hostname)) {
      setError('Telegram-ссылка недоступна.');
      return;
    }
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(parsed.toString());
    else window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
  }

  async function createSocialInvite() {
    if (!profile.backendPetId || !socialProfile?.discoverable || socialBusyId) return;
    setSocialBusyId('invite');
    try {
      const response = await fetch('/api/social/invites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ petId: profile.backendPetId, scenario: socialProfile.scenarios[0] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.invite?.token) {
        setError('Не получилось создать приглашение. Сначала сохрани анкету и попробуй ещё раз.');
        return;
      }
      const url = payload.invite.url || `${window.location.origin}/?socialInvite=${encodeURIComponent(payload.invite.token)}`;
      if (navigator.share) await navigator.share({ title: `Познакомить собак в Псё`, url }).catch(() => null);
      else await navigator.clipboard.writeText(url);
      setNotice('copied');
      window.setTimeout(() => setNotice('idle'), 1600);
    } finally {
      setSocialBusyId(null);
    }
  }

  async function acceptSocialInvite() {
    if (!socialInvite) return;
    if (!profile.backendPetId) {
      setDogCreationOpen(true);
      return;
    }
    if (socialBusyId) return;
    const idempotencyKey = `social-invite:${socialInvite.token}:${profile.backendPetId}`;
    setSocialBusyId('incoming-invite');
    try {
      const response = await fetch(`/api/social/invites/${encodeURIComponent(socialInvite.token)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...authHeaders() },
        body: JSON.stringify({ recipientPetId: profile.backendPetId, idempotencyKey }),
      });
      if (!response.ok) {
        setSocialInviteState(response.status === 410 ? 'gone' : 'error');
        return;
      }
      setSocialInvite(null);
      setSocialInviteState('idle');
      const url = new URL(window.location.href);
      url.searchParams.delete('socialInvite');
      window.history.replaceState({}, '', url);
      await loadSocialSurface();
    } finally {
      setSocialBusyId(null);
    }
  }

  function dismissSocialInvite() {
    setSocialInvite(null);
    setSocialInviteState('idle');
    const url = new URL(window.location.href);
    url.searchParams.delete('socialInvite');
    window.history.replaceState({}, '', url);
  }

  function isGuestMode() { return !session?.access_token && !telegramSession.ownerId; }
  function ensureGuestPetId() {
    const id = profile.backendPetId || guestPetIdRef.current || `guest-pet-${crypto.randomUUID()}`;
    guestPetIdRef.current = id;
    if (!profile.backendPetId) updateProfile({ backendPetId: id, isPublic: false });
    return id;
  }
  function guestId(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

  async function saveMinimalDog() {
    if (onboardingSaving) return;
    if (authLoading || telegramSession.mode === 'loading') {
      setError('Подожди секунду — Псё проверяет вход.');
      return;
    }
    const nextName = heroNameDraft.trim();
    if (!nextName) {
      setError('Напиши имя собаки.');
      return;
    }
    setOnboardingSaving(true);
    try {
      if (isGuestMode()) {
        const petId = ensureGuestPetId();
        updateProfile({
          dogName: nextName,
          lifeStage: profile.lifeStage,
          sex: profile.sex,
          breedId: profile.breedId,
          breedGroupId: profile.breedGroupId,
          breedCustom: profile.breedCustom,
          backendPetId: petId,
          isPublic: false,
        });
        setPets([{ id: petId, name: nextName }]);
        setActivePetId(petId);
      } else {
        const idempotencyKey = dogCreationKeyRef.current ?? `create-pet:${crypto.randomUUID()}`;
        dogCreationKeyRef.current = idempotencyKey;
        const response = await fetch('/api/v1/onboarding/activate', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
            ...authHeaders(),
          },
          body: JSON.stringify({
            name: nextName,
            lifeStage: profile.lifeStage,
            sex: profile.sex,
            breedId: profile.breedId,
            breedGroupId: profile.breedGroupId,
            breedCustom: profile.breedCustom,
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result?.petId) {
          setError('Не удалось добавить собаку. Проверь соединение и попробуй ещё раз.');
          return;
        }
        updateProfile({ dogName: nextName, backendPetId: result.petId, isPublic: false });
        setActivePetId(result.petId);
        await loadBootstrap(undefined, result.petId);
        dogCreationKeyRef.current = null;
      }
      setError('');
      setDogCreationOpen(false);
      setTab('today');
    } finally {
      setOnboardingSaving(false);
    }
  }

  async function loadBootstrap(accessToken?: string, petId?: string) {
    const headers: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : authHeaders();
    const params = new URLSearchParams();
    if (petId) params.set('petId', petId);
    const response = await fetch(`/api/app/bootstrap${params.size ? `?${params.toString()}` : ''}`, { headers });
    if (!response.ok) throw new Error('BOOTSTRAP_FAILED');
    const payload = await response.json();
    setAvatarCapabilities({
      identityEnabled: payload?.avatarCapabilities?.identityEnabled === true,
      uploadsEnabled: payload?.avatarCapabilities?.uploadsEnabled === true,
      generationEnabled: payload?.avatarCapabilities?.generationEnabled === true,
      providerReady: payload?.avatarCapabilities?.providerReady === true,
    });
    const dbProfile = dbToProfile(payload, petId);
    const selectedPetId = String(petId || payload.activePetId || dbProfile?.backendPetId || payload.pet?.id || '');
    const belongsToSelectedPet = (item: any) => {
      const itemPetId = String(item?.petId || item?.pet_id || '');
      return !selectedPetId || !itemPetId || itemPetId === selectedPetId;
    };
    setDemoMode(payload.mode === 'demo');
    if (Array.isArray(payload.pets)) setPets(payload.pets.map((pet: any) => {
      const petAvatarSource = pet.avatar_source || pet.avatarSource || (pet.avatar_url || pet.avatarUrl ? 'uploaded' : 'none');
      const petActiveAssetId = pet.active_avatar_asset_id || pet.activeAvatarAssetId;
      return {
      id: String(pet.id),
      name: String(pet.name || 'Собака'),
      breed_id: pet.breed_id || pet.breedId,
      breed_group_id: pet.breed_group_id || pet.breedGroupId,
      avatar_url: petAvatarSource === 'none' ? undefined : petActiveAssetId
        ? `/api/v1/pets/${pet.id}/avatar/assets/${petActiveAssetId}/render`
        : petAvatarSource === 'uploaded' ? pet.avatar_url || pet.avatarUrl : undefined,
      avatar_source: petAvatarSource,
      active_avatar_asset_id: petActiveAssetId || null,
      photo_urls: petAvatarSource === 'none' ? [] : Array.isArray(pet.photo_urls || pet.photoUrls) ? pet.photo_urls || pet.photoUrls : [],
    };
    }));
    if (dbProfile) {
      setActivePetId(selectedPetId);
      setProfile((current) => {
        const samePet = !petId || current.backendPetId === dbProfile.backendPetId;
        return {
          ...defaultProfile,
          ...dbProfile,
          photos: samePet ? current.photos : [],
          selectedStyle: samePet ? current.selectedStyle : 'city',
        };
      });
      setReminders((payload.reminders ?? []).filter(belongsToSelectedPet));
      setWishlist((payload.wishlist ?? []).filter(belongsToSelectedPet));
      setZones((payload.zones ?? []).filter(belongsToSelectedPet));
      setOwnerRoutes(normalizeOwnerRoutes((payload.routes ?? []).filter(belongsToSelectedPet)));
      if (Array.isArray(payload.observations)) {
        const bootObservations = payload.observations.filter(belongsToSelectedPet).map(normalizeObservation).filter(Boolean) as ObservationView[];
        setObservations(bootObservations.slice(0, 12));
      }
      setDocuments(Array.isArray(payload.documents) ? payload.documents.filter(belongsToSelectedPet) : []);
    } else if (payload.empty) {
      setPets([]);
      setActivePetId('');
      setProfile((current) => ({ ...current, backendPetId: undefined }));
      setReminders([]);
      setWishlist([]);
      setZones([]);
      setOwnerRoutes([]);
      setObservations([]);
      setDocuments([]);
      setHabits([]);
      setDogSummary(null);
      setModuleErrors({});
    }
  }

  useEffect(() => {
    const local = loadProfile();
    setProfile(local);
    setProfileHydrated(true);
    setHeroNameDraft(local.dogName || '');
    try {
      const savedObservations = JSON.parse(window.localStorage.getItem(observationsStorageKey(local.backendPetId)) || '[]');
      if (Array.isArray(savedObservations)) setObservations(savedObservations.map(normalizeObservation).filter(Boolean).slice(0, 12) as ObservationView[]);
    } catch {}
    observationsLoadedRef.current = true;
    const supabase = getSupabaseBrowser();
    if (!supabase) { setAuthLoading(false); loadBootstrap().catch(() => null); return; }
    supabase.auth.getSession().then(({ data }) => {
      const nextSession = data.session as AuthSession | null;
      setSession(nextSession);
      setAuthLoading(false);
      loadBootstrap(nextSession?.access_token).catch(() => null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextSession = next as AuthSession | null;
      setSession(nextSession);
      loadBootstrap(nextSession?.access_token).catch(() => null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/billing/entitlements', { headers: authHeaders() })
      .then((response) => response.json())
      .then((payload) => { if (!cancelled) setBilling(payload); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [session?.access_token, telegramSession.ownerId]);
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
        setTelegramSession({ mode: 'browser', message: 'Открой Псё в Telegram, чтобы войти.' });
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
  useEffect(() => {
    if (!profileHydrated) return;
    const result = saveProfile(profile);
    if (!result.ok) setError(result.message);
  }, [profile, profileHydrated]);
  useEffect(() => {
    if (!observationsLoadedRef.current) return;
    try { window.localStorage.setItem(observationsStorageKey(profile.backendPetId), JSON.stringify(observations.slice(0, 24))); } catch {}
  }, [observations, profile.backendPetId]);
  useEffect(() => {
    if (!profile.backendPetId || (!session?.access_token && !telegramSession.ownerId)) return;
    loadObservations().catch(() => null);
  }, [profile.backendPetId, session?.access_token, telegramSession.ownerId]);
  useEffect(() => {
    if (!profile.backendPetId) {
      setPublishedPublicCardPath('');
      return;
    }
    loadPublicDogCard(profile.backendPetId).catch(() => setPublishedPublicCardPath(''));
  }, [profile.backendPetId, session?.access_token, telegramSession.ownerId]);
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
  const avatarReady = avatarState === 'ready';
  const hasDog = Boolean(profile.dogName.trim());
  const activePrimaryRoute: PrimaryRoute = tab === 'calendar' || tab === 'habits' || tab === 'health'
    ? 'today'
    : tab === 'card'
      ? 'profile'
      : tab as PrimaryRoute;
  const isJourneyRoute = (['today', 'profile', 'map', 'nearby', 'things'] as const).includes(tab as PrimaryRoute)
    && journeyDetail !== tab;
  const activeReminders = useMemo(() => reminders.filter((reminder) => reminder.status !== 'done'), [reminders]);
  const doneReminders = useMemo(() => reminders.filter((reminder) => reminder.status === 'done'), [reminders]);
  const wantedWishlist = useMemo(() => wishlist.filter((item) => item.status !== 'bought' && item.status !== 'not_suitable'), [wishlist]);
  const boughtWishlist = useMemo(() => wishlist.filter((item) => item.status === 'bought'), [wishlist]);
  const profileChecklist = useMemo(() => [
    { label: 'Имя', done: Boolean(profile.dogName.trim()) },
    { label: 'Возрастная группа', done: Boolean(profile.lifeStage) },
    { label: 'Вакцины', done: Boolean(profile.vaccineStatus && profile.vaccineStatus !== 'не знаю') },
    { label: 'Обработка', done: Boolean(profile.parasiteStatus && profile.parasiteStatus !== 'не знаю') },
    { label: 'Правило знакомства', done: Boolean(profile.socialMode) },
    { label: 'Энергия', done: Boolean(profile.energyLevel) },
  ], [profile.dogName, profile.energyLevel, profile.lifeStage, profile.parasiteStatus, profile.socialMode, profile.vaccineStatus]);
  const completionCount = useMemo(() => profileChecklist.filter((item) => item.done).length, [profileChecklist]);
  const profileReady = completionCount >= profileChecklist.length;
  const missingProfileFields = useMemo(() => profileChecklist.filter((item) => !item.done).map((item) => item.label), [profileChecklist]);
  const publicCardPayload = useMemo(() => {
    const show = (key: PublicCardFieldKey) => publicCardVisibleFields.includes(key);
    const publicImageUrl = /^https?:\/\//i.test(generatedAvatarUrl)
      ? generatedAvatarUrl
      : /^https?:\/\//i.test(profile.avatarImageUrl)
        ? profile.avatarImageUrl
        : profile.photoUrls[0] || '';
    const localImageUrl = generatedAvatarUrl || profile.avatarImageUrl || profile.photos[0]?.dataUrl || '';
    const shareImageUrl = publicImageUrl || localImageUrl;
    return {
      name: profile.dogName.trim() || 'Моя собака',
      breed: show('breed') ? breedLabel : 'не указано',
      character: show('character') ? profile.temperament || profile.energyLevel || 'спокойный друг' : 'не указано',
      bio: profile.temperament || profile.playStyle || 'Подходите спокойно и сначала спросите владельца.',
      social: displaySocialMode(profile.socialMode) || 'сначала спросить владельца',
      triggers: show('triggers') ? profile.triggers || 'резкие движения, шум' : '',
      area: show('area') ? safePublicArea(socialProfile?.district ?? undefined) : 'район скрыт',
      image: shareImageUrl,
    };
  }, [breedLabel, generatedAvatarUrl, profile.avatarImageUrl, profile.dogName, profile.energyLevel, profile.photoUrls, profile.photos, profile.playStyle, profile.socialMode, profile.temperament, profile.triggers, publicCardVisibleFields, socialProfile?.district]);
  const publicCardHref = useMemo(() => {
    if (publishedPublicCardPath) return publishedPublicCardPath;
    const params = new URLSearchParams(publicCardPayload);
    if (!/^https?:\/\//i.test(publicCardPayload.image) && !(/^data:image\//i.test(publicCardPayload.image) && publicCardPayload.image.length < 12000)) {
      params.delete('image');
    }
    return `/dog/card?${params.toString()}`;
  }, [publicCardPayload, publishedPublicCardPath]);
  useEffect(() => {
    setPublishedPublicCardPath('');
  }, [publicCardPayload]);
  const viralFacts = useMemo<Record<ViralFactKey, { label: string; value: string; ready: boolean }>>(() => ({
    social: { label: 'контакт', value: displaySocialMode(profile.socialMode) || 'сначала спросить', ready: Boolean(profile.socialMode) },
    energy: { label: 'ритм', value: profile.energyLevel || profile.temperament || 'спокойный режим', ready: Boolean(profile.energyLevel || profile.temperament) },
    care: { label: 'уход', value: profile.parasiteStatus || profile.vaccineStatus || 'проверить даты', ready: Boolean(profile.parasiteStatus || profile.vaccineStatus) },
    triggers: { label: 'важно', value: profile.triggers || 'без резких движений', ready: Boolean(profile.triggers) },
    area: { label: 'район', value: safePublicArea(socialProfile?.district ?? undefined), ready: Boolean(socialProfile?.district) },
    breed: { label: 'порода', value: breedLabel, ready: selectedBreed.id !== 'mixed' },
  }), [breedLabel, profile.energyLevel, profile.parasiteStatus, profile.socialMode, profile.temperament, profile.triggers, profile.vaccineStatus, selectedBreed.id, socialProfile?.district]);
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
  const petNameGent = inflectPetName(profile.dogName, 'gent');
  const petNameDatv = inflectPetName(profile.dogName, 'datv');
  const petNameAccs = inflectPetName(profile.dogName, 'accs');
  const missingProfileSummary = missingProfileFields.slice(0, 3).join(', ');
  const publicCardChecks = useMemo<PublicCardCheck[]>(() => [
    { label: 'Имя', done: Boolean(profile.dogName.trim()), missing: 'имя собаки' },
    { label: 'Правило контакта', done: Boolean(profile.socialMode), missing: 'как знакомиться' },
    { label: 'Что не делать', done: Boolean(profile.triggers), missing: 'важные триггеры' },
  ], [profile.dogName, profile.socialMode, profile.triggers]);
  const publicCardReadyCount = useMemo(() => publicCardChecks.filter((item) => item.done).length, [publicCardChecks]);
  const publicCardReady = Boolean(profile.dogName.trim() && profile.socialMode && profile.triggers);
  const publicCardMissing = useMemo(() => publicCardChecks.filter((item) => !item.done).map((item) => item.missing), [publicCardChecks]);
  const publicCardShows = (key: PublicCardFieldKey) => publicCardVisibleFields.includes(key);
  const todayCare = useMemo(() => buildTodayCareView(reminders), [reminders]);
  const profileJourneyEntries = useMemo<JourneyProfileEntry[]>(() => {
    const dateLabel = (value?: string | null) => value
      ? new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
      : 'Недавно';
    return [
      ...documents.map((item) => ({
        id: item.id,
        kind: 'document' as const,
        when: dateLabel(item.documentDate || item.createdAt),
        title: item.title,
        detail: item.clinic || item.originalName || 'Документ из личной истории',
        meta: item.kind === 'analysis' ? 'Анализ · приватно' : 'Документ · приватно',
        href: `/api/documents/${item.id}`,
        sortAt: item.documentDate || item.createdAt,
      })),
      ...doneReminders.map((item) => ({
        id: item.id,
        kind: 'care' as const,
        when: dateLabel(item.completedAt || item.dueAt),
        title: item.title,
        detail: 'Отмечено выполненным',
        meta: 'Забота',
        onOpen: () => { setCareView('history'); setTab('calendar'); },
        sortAt: item.completedAt || item.dueAt,
      })),
      ...observations.map((item) => ({
        id: item.id,
        kind: 'observation' as const,
        when: dateLabel(item.createdAt),
        title: observationSummary(item),
        detail: item.note && item.note !== observationSummary(item) ? item.note : 'Записано владельцем',
        meta: 'Наблюдение',
        onOpen: () => setTab('health'),
        sortAt: item.createdAt,
      })),
    ].sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()).slice(0, 8);
  }, [documents, doneReminders, observations]);
  const nextBestAction = useMemo(() => {
    if (!profile.backendPetId) return { emoji: '⏰', title: 'Запланировать первую заботу', caption: 'Добавь имя собаки и выбери первое дело: обработка, вакцина, груминг или своё.', action: 'Добавить питомца', target: 'profile' as Tab };
    if (todayCare.reminderId) return {
      emoji: todayCare.state === 'overdue' ? '🚩' : '✓',
      title: todayCare.title,
      caption: todayCare.detail,
      action: todayCare.actionLabel,
      target: 'today' as Tab,
      reminderId: todayCare.reminderId,
    };
    return {
      emoji: todayCare.state === 'complete' ? '🐾' : '⏰',
      title: todayCare.state === 'empty' ? `Запланировать первую заботу ${petNameDatv}` : todayCare.title,
      caption: todayCare.detail,
      action: todayCare.actionLabel,
      target: 'calendar' as Tab,
    };
  }, [petNameDatv, profile.backendPetId, todayCare]);
  const latestObservation = observations[0];
  const observationNextStepLine = latestObservation
    ? `Последняя запись: ${observationSummary(latestObservation)}. Следующий шаг: ${nextBestAction.title.toLowerCase()}.`
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
  const authPanelMode = hasConnectedAccount ? 'connected' : hasTelegramSession ? 'telegram-sync' : telegramSession.mode;
  const showAuthPanel = !hasConnectedAccount && (telegramSession.mode === 'browser' || telegramSession.mode === 'error' || telegramSession.mode === 'loading');
  const plusPlan = billing?.plans?.plus;
  const isPlusActive = billing?.entitlements?.tier === 'plus';
  const plusIncluded = plusPlan?.included?.slice(0, 4) ?? ['несколько собак', 'полная история', 'расширенные карточки', 'сводка недели'];
  const plusPriceLabel = plusPlan?.priceStars ? `${plusPlan.priceStars} звёзд Telegram / 30 дней` : 'цена готовится';
  const plusGateLine = isPlusActive
    ? billing?.entitlements?.expiresAt ? `Плюс активен до ${new Date(billing.entitlements.expiresAt).toLocaleDateString('ru-RU')}.` : 'Плюс активен.'
    : billing?.upgrade?.available ? 'Оплата готова через Telegram.' : 'Оплата пока недоступна.';

  function resetPetScopedDrafts() {
    setJourneyDetail(null);
    setTabState('today');
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = 'today';
      window.history.replaceState({ tab: 'today' }, '', nextUrl);
    }
    setAssistantOpen(false);
    setAssistantQuestion('');
    setAssistantAnswer('');
    setAssistantActions([]);
    setObservationDraft(defaultObservationDraft);
    setEditingObservationId(null);
    setRecentlyDeletedObservation(null);
    setNewReminderTitle('');
    setEditingReminderId(null);
    setNewZoneTitle('');
    setNewZoneNote('');
    setPickedZonePoint(null);
    setRoutePoints([]);
    setMapRouteMeta(null);
    setNewWishTitle('');
    setNewWishReason('');
    setThingCaptureOpen(false);
    setSocialProfile(null);
    setSocialCandidates({ nearby: [], city: [] });
    setSocialRequests([]);
    setWalkSignals([]);
    setSocialInvite(null);
    setSocialInviteState('idle');
    setDocumentUploadOpen(false);
    setAvatarComposerOpen(false);
  }

  async function switchActivePet(nextPetId: string) {
    if (!nextPetId || nextPetId === activePetId || petMutationBusy) return;
    const previousPetId = activePetId;
    setError('');
    setPetMutationBusy(true);
    try {
      if (!isGuestMode()) {
        const response = await fetch('/api/v1/pets', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ activePetId: nextPetId }),
        });
        if (!response.ok) throw new Error('PET_SWITCH_FAILED');
      }
      await loadBootstrap(undefined, nextPetId);
      resetPetScopedDrafts();
      setPublishedPublicCardPath('');
      setGeneratedAvatarUrl('');
      setAvatarDraftAssetId('');
      setAvatarReferenceAssetId('');
      setAvatarDraftSource(null);
      setAvatarConsent(false);
      setAvatarOwnerPrompt('');
      setAvatarState('idle');
    } catch {
      setActivePetId(previousPetId);
      if (!isGuestMode() && previousPetId) {
        await fetch('/api/v1/pets', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ activePetId: previousPetId }),
        }).catch(() => null);
      }
      setError('Не удалось переключить собаку. Попробуй ещё раз.');
    } finally {
      setPetMutationBusy(false);
    }
  }

  async function addDog() {
    const dogName = newDogName.trim();
    if (!dogName || petMutationBusy) return;
    if (isGuestMode()) {
      setError('Добавить несколько собак можно после входа через Telegram.');
      return;
    }
    const idempotencyKey = addDogKeyRef.current ?? `add-pet:${crypto.randomUUID()}`;
    addDogKeyRef.current = idempotencyKey;
    setPetMutationBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/pets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...authHeaders() },
        body: JSON.stringify({ profile: { dogName } }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.pet?.id) throw new Error('PET_CREATE_FAILED');
      setActivePetId(result.pet.id);
      const selectResponse = await fetch('/api/v1/pets', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ activePetId: result.pet.id }),
      });
      if (!selectResponse.ok) throw new Error('PET_SELECTION_FAILED');
      await loadBootstrap(undefined, result.pet.id);
      addDogKeyRef.current = null;
      setNewDogName('');
      setAddDogOpen(false);
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1400);
    } catch {
      setError('Не удалось добавить собаку. Введённые данные сохранены — попробуй ещё раз.');
    } finally {
      setPetMutationBusy(false);
  }
  }


  function normalizeObservation(raw: any): ObservationView | null {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '');
    const note = String(raw.note || '').trim();
    const isLegacyDemoObservation = raw.source === 'demo'
      || (id === 'observation-1' && note === 'демо-наблюдение');
    if (isLegacyDemoObservation) return null;
    const metadata = raw.metadata && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata) ? raw.metadata : {};
    const createdAt = String(raw.observedAt || raw.observed_at || raw.createdAt || raw.created_at || new Date().toISOString());
    const date = new Date(createdAt);
    const type = String(raw.type || '');
    const value = String(raw.value || '');
    return {
      id: id || guestId('observation'),
      petId: raw.petId || raw.pet_id ? String(raw.petId || raw.pet_id) : undefined,
      mood: String(raw.mood || metadata.mood || (type === 'mood' ? value : '')).trim() || undefined,
      appetite: String(raw.appetite || metadata.appetite || (type === 'appetite' ? value : '')).trim() || undefined,
      stool: String(raw.stool || metadata.stool || (type === 'stool' ? value : '')).trim() || undefined,
      energy: String(raw.energy || metadata.energy || (type === 'energy' ? value : '')).trim() || undefined,
      note: note || undefined,
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

  async function loadRealModules(petId = profile.backendPetId, signal?: AbortSignal) {
    if (!petId || isGuestMode()) {
      setHabits([]);
      setDogSummary(null);
      setModuleErrors({});
      return;
    }
    setHabitLoading(true);
    setModuleErrors({});
    const request = { headers: authHeaders(), credentials: 'include' as const, signal };
    try {
      const [habitResponse, healthResponse, summaryResponse] = await Promise.all([
        fetch(`/api/habits?petId=${encodeURIComponent(petId)}`, request),
        fetch(`/api/health?petId=${encodeURIComponent(petId)}`, request),
        fetch(`/api/pets/${encodeURIComponent(petId)}/summary`, request),
      ]);
      const [habitPayload, healthPayload, summaryPayload] = await Promise.all([
        habitResponse.json().catch(() => ({})),
        healthResponse.json().catch(() => ({})),
        summaryResponse.json().catch(() => ({})),
      ]);
      if (habitResponse.ok) setHabits(Array.isArray(habitPayload.habits) ? habitPayload.habits : []);
      if (healthResponse.ok && Array.isArray(healthPayload.entries)) {
        const entries = healthPayload.entries.map(normalizeObservation).filter(Boolean) as ObservationView[];
        setObservations(entries.slice(0, 50));
      }
      if (summaryResponse.ok && summaryPayload.summary) setDogSummary(summaryPayload.summary);
      setModuleErrors({
        habits: habitResponse.ok ? undefined : 'Проверь соединение и попробуй снова.',
        health: healthResponse.ok ? undefined : 'Проверь соединение и попробуй снова.',
      });
      if (!summaryResponse.ok) setDogSummary(null);
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) {
        setModuleErrors({ habits: 'Проверь соединение и попробуй снова.', health: 'Проверь соединение и попробуй снова.' });
      }
    } finally {
      if (!signal?.aborted) setHabitLoading(false);
    }
  }

  useEffect(() => {
    if (!profile.backendPetId || isGuestMode()) return;
    const controller = new AbortController();
    void loadRealModules(profile.backendPetId, controller.signal);
    return () => controller.abort();
  }, [profile.backendPetId, session?.access_token, telegramSession.ownerId]);

  async function createHabit(draft: HabitDraft) {
    if (!profile.backendPetId || isGuestMode() || habitBusyId) return false;
    setHabitBusyId('create');
    setError('');
    try {
      const response = await fetch('/api/habits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ petId: profile.backendPetId, ...draft }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.habit) {
        setError('Привычка не сохранилась. Проверь данные и попробуй снова.');
        return false;
      }
      await loadRealModules(profile.backendPetId);
      return true;
    } catch {
      setError('Привычка не сохранилась. Проверь соединение и попробуй снова.');
      return false;
    } finally {
      setHabitBusyId(null);
    }
  }

  async function checkInHabit(habitId: string) {
    if (!profile.backendPetId || isGuestMode() || habitBusyId) return;
    const scope = `habit:checkin:${habitId}`;
    setHabitBusyId(habitId);
    setError('');
    try {
      const response = await fetch(`/api/habits/${encodeURIComponent(habitId)}/checkins`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        setError('Не получилось отметить привычку. Попробуй снова.');
        return;
      }
      finishCareMutation(scope);
      await loadRealModules(profile.backendPetId);
    } catch {
      setError('Не получилось отметить привычку. Проверь соединение и попробуй снова.');
    } finally {
      setHabitBusyId(null);
    }
  }

  async function updateHabit(habitId: string, draft: HabitDraft) {
    if (!profile.backendPetId || isGuestMode() || habitBusyId) return false;
    setHabitBusyId(habitId);
    setError('');
    try {
      const response = await fetch(`/api/habits/${encodeURIComponent(habitId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        setError('Привычка не обновилась. Проверь данные и попробуй снова.');
        return false;
      }
      await loadRealModules(profile.backendPetId);
      return true;
    } catch {
      setError('Привычка не обновилась. Проверь соединение и попробуй снова.');
      return false;
    } finally {
      setHabitBusyId(null);
    }
  }

  async function archiveHabit(habitId: string) {
    if (!profile.backendPetId || isGuestMode() || habitBusyId) return;
    setHabitBusyId(habitId);
    setError('');
    try {
      const response = await fetch(`/api/habits/${encodeURIComponent(habitId)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders(),
      });
      if (!response.ok) {
        setError('Не получилось убрать привычку. Попробуй снова.');
        return;
      }
      await loadRealModules(profile.backendPetId);
    } catch {
      setError('Не получилось убрать привычку. Проверь соединение и попробуй снова.');
    } finally {
      setHabitBusyId(null);
    }
  }

  async function loadReminderHistory(reminderId: string) {
    if (isGuestMode()) return;
    const response = await fetch(`/api/reminders/${reminderId}/history`, { headers: authHeaders() });
    if (!response.ok) return;
    const payload = await response.json().catch(() => ({}));
    const history = Array.isArray(payload.history) ? payload.history.map((item: any) => ({
      id: String(item.id),
      eventType: String(item.event_type || ''),
      payload: item.payload && typeof item.payload === 'object' ? item.payload : {},
      createdAt: String(item.created_at || new Date().toISOString()),
    })) : [];
    setReminderHistory((current) => ({ ...current, [reminderId]: history }));
  }

  useEffect(() => {
    if (careView !== 'history' || isGuestMode()) return;
    reminders.forEach((reminder) => {
      if (reminder.recurrence && reminder.recurrence !== 'none' && reminderHistory[reminder.id] === undefined) {
        void loadReminderHistory(reminder.id);
      }
    });
  }, [careView, reminders, reminderHistory]);

  async function submitObservation() {
    if (observationSaving) return;
    const note = observationDraft.note?.trim();
    if (!observationDraft.mood && !observationDraft.appetite && !observationDraft.stool && !observationDraft.energy && !note) {
      setError('Выбери то, что заметил, или добавь короткую заметку.');
      return;
    }
    const petId = profile.backendPetId || (isGuestMode() ? ensureGuestPetId() : undefined);
    const payloadFingerprint = JSON.stringify({ petId, ...observationDraft, note });
    const mutationScope = `observation:create:${payloadFingerprint}`;
    const createdAt = careMutationTime(mutationScope, () => new Date().toISOString());
    const draft: ObservationView = {
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
    setError('');

    if (!profile.backendPetId || (!session?.access_token && !telegramSession.ownerId)) {
      setObservations((current) => [draft, ...current].slice(0, 12));
      setObservationDraft(defaultObservationDraft);
      finishCareMutation(mutationScope);
      setObservationSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(mutationScope), ...authHeaders() },
        body: JSON.stringify({
          petId: profile.backendPetId,
          ...(draft.note && !draft.mood && !draft.appetite && !draft.stool && !draft.energy ? { type: 'note', value: draft.note } : {}),
          mood: draft.mood || undefined,
          appetite: draft.appetite || undefined,
          stool: draft.stool || undefined,
          energy: draft.energy || undefined,
          note: draft.note || null,
          observedAt: createdAt,
          source: 'manual',
        }),
      });
      if (!response.ok) {
        setError('Запись не сохранилась. Текст остался здесь — проверь связь и попробуй снова.');
        return;
      }
      const payload = await response.json().catch(() => ({}));
      const saved = normalizeObservation(payload?.observation || payload);
      if (saved) setObservations((current) => [{ ...saved, syncStatus: 'saved' as const }, ...current.filter((item) => item.id !== saved.id)].slice(0, 12));
      setObservationDraft(defaultObservationDraft);
      finishCareMutation(mutationScope);
      await loadRealModules(profile.backendPetId);
    } catch {
      setError('Запись не сохранилась. Текст остался здесь — проверь связь и попробуй снова.');
    } finally {
      setObservationSaving(false);
    }
  }

  async function transcribeVoiceObservation(audio: Blob) {
    const form = new FormData();
    form.set('audio', new File([audio], 'pso-voice.webm', { type: audio.type || 'audio/webm' }));
    let response: Response;
    try {
      response = await fetch('/api/stt/transcribe', {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
        body: form,
      });
    } catch {
      throw new Error('NETWORK_ERROR');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || typeof payload.transcript !== 'string') throw new Error(String(payload.error || 'STT_PROVIDER_UNAVAILABLE'));
    return { transcript: payload.transcript, durationSeconds: Number(payload.durationSeconds) || 0 };
  }

  async function extractVoiceObservationCandidates(input: { transcript: string; captureId: string; observedAt: string; source: 'voice' | 'text' }) {
    if (!profile.backendPetId) throw new Error('PET_REQUIRED');
    if (isGuestMode()) {
      const candidates = extractObservationCandidates({ ...input, petId: profile.backendPetId, authorId: 'guest' });
      return { candidates, decisions: candidates.map((candidate) => ({ candidateId: candidate.id, operation: 'create' as const, analyticsEligible: Boolean(candidate.onsetAt), reason: 'guest_preview' })) };
    }
    if (!session?.access_token && !telegramSession.ownerId) throw new Error('AUTH_REQUIRED');
    const response = await fetch('/api/observations/extract', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ petId: profile.backendPetId, ...input }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload.error || 'OBSERVATION_EXTRACTION_FAILED'));
    return { candidates: Array.isArray(payload.candidates) ? payload.candidates as ObservationCandidate[] : [], decisions: Array.isArray(payload.decisions) ? payload.decisions as IngestionDecision[] : [] };
  }

  async function saveVoiceObservationCandidates(candidates: ObservationCandidate[]) {
    if (!candidates.length) throw new Error('EMPTY_CANDIDATE_BATCH');
    if (!profile.backendPetId || (!session?.access_token && !telegramSession.ownerId)) throw new Error('AUTH_REQUIRED');
    const captureId = candidates[0].captureId;
    const scope = `observation:voice:${captureId}:${ingestionFingerprint(candidates)}`;
    const response = await fetch('/api/observations/voice', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
      body: JSON.stringify({
        petId: profile.backendPetId,
        candidates,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload.error || 'OBSERVATION_SAVE_FAILED'));
    const saved = normalizeObservation(payload.observation || payload);
    if (!saved) throw new Error('OBSERVATION_SAVE_FAILED');
    setObservations((current) => [{ ...saved, syncStatus: 'saved' as const }, ...current.filter((item) => item.id !== saved.id)].slice(0, 12));
    finishCareMutation(scope);
    await loadRealModules(profile.backendPetId);
    return { decisions: Array.isArray(payload.decisions) ? payload.decisions as IngestionDecision[] : [], summary: payload.summary || {} };
  }

  function startObservationEdit(observation: ObservationView) {
    setEditingObservationId(observation.id);
    setObservationEditDraft({
      mood: observation.mood || '',
      appetite: observation.appetite || '',
      stool: observation.stool || '',
      energy: observation.energy || '',
      note: observation.note || '',
    });
    setError('');
  }

  async function editObservation(id: string) {
    const scope = `observation:update:${id}:${JSON.stringify(observationEditDraft)}`;
    if (isGuestMode()) {
      setObservations((current) => current.map((item) => item.id === id ? { ...item, ...observationEditDraft } : item));
      setEditingObservationId(null);
      return;
    }
    setObservationMutationBusy(true);
    try {
      const response = await fetch(`/api/observations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify(observationEditDraft),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return setError('Не получилось сохранить запись. Изменения остались в форме.');
      const saved = normalizeObservation(payload.observation);
      if (saved) setObservations((current) => current.map((item) => item.id === id ? { ...saved, syncStatus: 'saved' as const } : item));
      finishCareMutation(scope);
      setEditingObservationId(null);
    } catch {
      setError('Не получилось сохранить запись. Изменения остались в форме.');
    } finally {
      setObservationMutationBusy(false);
    }
  }

  async function deleteObservation(id: string) {
    const observation = observations.find((item) => item.id === id);
    if (!observation || observationMutationBusy) return;
    if (isGuestMode()) {
      setObservations((current) => current.filter((item) => item.id !== id));
      setRecentlyDeletedObservation(observation);
      setCareFeedback({ kind: 'observation-deleted', observationId: id, title: 'наблюдение' });
      return;
    }
    const scope = `observation:delete:${id}`;
    setObservationMutationBusy(true);
    try {
      const response = await fetch(`/api/observations/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify({}),
      });
      if (!response.ok) return setError('Не получилось убрать запись. Попробуй ещё раз.');
      setObservations((current) => current.filter((item) => item.id !== id));
      setRecentlyDeletedObservation(observation);
      setCareFeedback({ kind: 'observation-deleted', observationId: id, title: 'наблюдение' });
      finishCareMutation(scope);
    } catch {
      setError('Не получилось убрать запись. Попробуй ещё раз.');
    } finally {
      setObservationMutationBusy(false);
    }
  }

  async function uploadPetDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.backendPetId || documentUploading) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set('petId', profile.backendPetId);
    setDocumentUploading(true);
    setError('');
    try {
      const response = await fetch('/api/documents', { method: 'POST', headers: authHeaders(), body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'UPLOAD_FAILED');
      setDocuments((current) => [payload.document, ...current]);
      setDocumentUploadOpen(false);
      setDocumentFileName('');
      formElement.reset();
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1400);
    } catch {
      setError('Не удалось сохранить документ. Проверь формат и размер файла — до 4 МБ.');
    } finally {
      setDocumentUploading(false);
    }
  }

  async function deletePetDocument(id: string) {
    if (documentBusyId || !window.confirm('Удалить этот документ без возможности восстановления?')) return;
    setDocumentBusyId(id);
    setError('');
    try {
      const response = await fetch(`/api/documents/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!response.ok) throw new Error('DELETE_FAILED');
      setDocuments((current) => current.filter((item) => item.id !== id));
    } catch {
      setError('Не удалось удалить документ. Ничего не изменилось — попробуй ещё раз.');
    } finally {
      setDocumentBusyId(null);
    }
  }

  async function restoreObservation() {
    if (!recentlyDeletedObservation) return;
    const observation = recentlyDeletedObservation;
    if (isGuestMode()) {
      setObservations((current) => [observation, ...current]);
      setRecentlyDeletedObservation(null);
      setCareFeedback(null);
      return;
    }
    const scope = `observation:restore:${observation.id}`;
    setObservationMutationBusy(true);
    try {
      const response = await fetch(`/api/observations/${observation.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify({}),
      });
      if (!response.ok) return setError('Не получилось вернуть запись. Попробуй ещё раз.');
      setObservations((current) => [observation, ...current.filter((item) => item.id !== observation.id)]);
      setRecentlyDeletedObservation(null);
      setCareFeedback(null);
      finishCareMutation(scope);
    } catch {
      setError('Не получилось вернуть запись. Попробуй ещё раз.');
    } finally {
      setObservationMutationBusy(false);
    }
  }

  function updateProfile(patch: Partial<DogProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
    setError('');
  }

  async function uploadPrivateAvatarReference(file: File) {
    const petId = profile.backendPetId || activePetId;
    if (!petId) throw new Error('PET_REQUIRED');
    const form = new FormData();
    form.set('photo', file);
    const response = await fetch(`/api/v1/pets/${petId}/avatar/assets`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders(),
      body: form,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.asset?.id || !result?.asset?.renderUrl) throw new Error(result?.error || 'AVATAR_UPLOAD_FAILED');
    return result.asset as { id: string; renderUrl: string };
  }

  function updateBreedGroup(value: BreedGroupId) {
    const firstBreed = breedCatalog.find((breed) => breed.groupId === value)?.id ?? 'mixed';
    updateProfile({ breedGroupId: value, breedId: firstBreed as BreedId });
  }

  async function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    if (!avatarCapabilities.uploadsEnabled) {
      event.target.value = '';
      return setError('Приватная загрузка фото пока готовится. Текущий образ не изменён.');
    }
    const files = Array.from(event.target.files ?? []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) return setError('Нужно фото собаки: JPG, PNG или HEIC.');
    if (imageFiles.find((file) => file.size > 8 * 1024 * 1024)) return setError('Фото больше 8 МБ. Выбери файл поменьше.');
    const localAvatar = await fileToLocalAvatarDataUrl(imageFiles[0]);
    setGeneratedAvatarUrl(localAvatar); setDemoMode(false); setAvatarState('ready');
    setAvatarDraftAssetId('local');
    setAvatarDraftSource('uploaded');
    if (profile.backendPetId || activePetId) {
      try {
        const asset = await uploadPrivateAvatarReference(imageFiles[0]);
        setAvatarReferenceAssetId(asset.id);
        setAvatarDraftAssetId(asset.id);
        setGeneratedAvatarUrl(asset.renderUrl);
      } catch (uploadError) {
        const code = uploadError instanceof Error ? uploadError.message : '';
        setGeneratedAvatarUrl('');
        setAvatarDraftAssetId('');
        setAvatarDraftSource(null);
        setError(code === 'UPLOADS_DISABLED'
          ? 'Загрузка фото пока выключена. Текущий образ не изменён.'
          : 'Приватное сохранение не сработало. Текущий образ не изменён.');
      }
    }
    event.target.value = '';
  }

  async function createAvatar(overrides: Partial<DogProfile> = {}) {
    const petId = profile.backendPetId || activePetId;
    if (!petId) return setError('Сначала сохрани профиль собаки.');
    if (!avatarConsent) return setError('Сначала подтверди передачу описания и выбранного фото сервису генерации.');
    const avatarProfile = { ...profile, ...overrides };
    setError(''); setDemoMode(false); setAvatarState('rendering');
    try {
      const idempotencyKey = `avatar:${petId}:${crypto.randomUUID()}`;
      const mode = avatarReferenceAssetId ? 'image_to_image' : 'text_to_image';
      const appearanceNote = [
        avatarProfile.size && `размер: ${avatarProfile.size}`,
        avatarProfile.coatType && `шерсть: ${avatarProfile.coatType}`,
        avatarProfile.colorMarks && `окрас и приметы: ${avatarProfile.colorMarks}`,
        avatarProfile.breedHint && `детали породы: ${avatarProfile.breedHint}`,
        avatarProfile.avatarPrompt,
        avatarOwnerPrompt,
      ].filter(Boolean).join('; ').slice(0, 280);
      const response = await fetch(`/api/v1/pets/${petId}/avatar/jobs`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...authHeaders() },
        body: JSON.stringify({
          mode,
          referenceAssetId: avatarReferenceAssetId || undefined,
          styleId: avatarProfile.selectedStyle,
          ownerPrompt: appearanceNote,
          consentVersion: 'avatar-provider-v2',
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.asset?.id || !result?.asset?.renderUrl) throw new Error(result?.error || 'AVATAR_GENERATION_FAILED');
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('avatar image failed to load'));
        image.src = result.asset.renderUrl;
      });
      setGeneratedAvatarUrl(result.asset.renderUrl);
      setAvatarDraftAssetId(result.asset.id);
      setAvatarDraftSource('generated');
      setAvatarState('ready');
    } catch (generationError) {
      setAvatarState('idle');
      const code = generationError instanceof Error ? generationError.message : '';
      const messages: Record<string, string> = {
        AVATAR_GENERATION_DISABLED: 'Создание образа пока выключено.',
        AVATAR_PROVIDER_DISABLED: 'Генератор пока не готов. Фото и профиль работают без него.',
        AVATAR_OWNER_QUOTA: 'Лимит генераций на этот час исчерпан. Попробуй позже.',
        AVATAR_PROVIDER_QUOTA: 'Лимит сервиса исчерпан. Фото и профиль работают без генератора.',
        AVATAR_DAILY_BUDGET_REACHED: 'Дневной лимит генератора исчерпан. Списаний не будет.',
        AVATAR_MODERATION_REJECTED: 'Это описание нельзя использовать. Измени формулировку.',
        AVATAR_PROVIDER_TIMEOUT: 'Генератор не ответил. Черновик не применён — можно повторить.',
      };
      setError(messages[code] || 'Образ не создался. Ничего не применено — можно повторить.');
    }
  }

  async function activateAvatarDraft() {
    const petId = profile.backendPetId || activePetId;
    if (!avatarDraftAssetId || !avatarDraftSource) return;
    if (!petId || avatarDraftAssetId === 'local') {
      updateProfile({ avatarImageUrl: generatedAvatarUrl, avatarSource: avatarDraftSource });
      setAvatarDraftAssetId('');
      setAvatarDraftSource(null);
      return;
    }
    try {
      const response = await fetch(`/api/v1/pets/${petId}/avatar/assets/${avatarDraftAssetId}/activate`, {
        method: 'POST', credentials: 'include', headers: authHeaders(),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'AVATAR_ACTIVATION_FAILED');
      updateProfile({ avatarImageUrl: generatedAvatarUrl, avatarSource: avatarDraftSource });
      setAvatarDraftAssetId('');
      setAvatarDraftSource(null);
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1400);
    } catch {
      setError('Не удалось применить образ. Черновик сохранён, можно повторить.');
    }
  }

  function discardAvatarDraft() {
    setAvatarDraftAssetId('');
    setAvatarDraftSource(null);
    setAvatarReferenceAssetId('');
    setGeneratedAvatarUrl('');
    setAvatarState('idle');
    setError('');
  }

  async function useNoAvatar() {
    if (profile.avatarSource !== 'none' && !window.confirm(`Убрать текущий образ ${profile.dogName || 'собаки'}? Его можно будет вернуть кнопкой «Вернуть предыдущий».`)) return;
    const petId = profile.backendPetId || activePetId;
    if (petId) {
      const response = await fetch(`/api/v1/pets/${petId}/avatar/identity`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'none' }),
      });
      if (!response.ok) return setError('Не удалось убрать образ. Попробуй ещё раз.');
    }
    setGeneratedAvatarUrl('');
    setAvatarDraftAssetId('');
    setAvatarReferenceAssetId('');
    setAvatarDraftSource(null);
    updateProfile({ avatarImageUrl: '', avatarSource: 'none', photoUrls: [] });
    setAvatarComposerOpen(false);
  }

  async function rollbackAvatar() {
    const petId = profile.backendPetId || activePetId;
    if (!petId) return;
    const response = await fetch(`/api/v1/pets/${petId}/avatar/identity`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'rollback' }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError(result?.error === 'AVATAR_ROLLBACK_UNAVAILABLE' ? 'Предыдущего образа пока нет.' : 'Не удалось вернуть предыдущий образ.');
    const renderUrl = result.activeAssetId ? `/api/v1/pets/${petId}/avatar/assets/${result.activeAssetId}/render` : '';
    setGeneratedAvatarUrl('');
    setAvatarDraftAssetId('');
    setAvatarDraftSource(null);
    setAvatarReferenceAssetId('');
    setAvatarComposerOpen(false);
    updateProfile({ avatarImageUrl: renderUrl, avatarSource: result.source || 'none' });
  }

  async function savePrivateProfile(nextProfile?: DogProfile) {
    const profileToSave = nextProfile || profile;
    if (!profileToSave.dogName.trim()) { setError('Сначала добавь имя собаки.'); return null; }
    if (profileSaving) return profileToSave.backendPetId || null;
    setProfileSaving(true);
    setError('');
    if (isGuestMode()) {
      ensureGuestPetId();
      setProfile(profileToSave);
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1600);
      setProfileSaving(false);
      return profileToSave.backendPetId || guestPetIdRef.current;
    }
    try {
      const idempotencyKey = profileToSave.backendPetId ? '' : (addDogKeyRef.current ?? `add-pet:${crypto.randomUUID()}`);
      if (!profileToSave.backendPetId) addDogKeyRef.current = idempotencyKey;
      const response = await fetch('/api/v1/pets', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
          ...authHeaders(),
        },
        body: JSON.stringify({ profile: { ...profileToSave, isPublic: false } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error || 'Не удалось сохранить профиль');
      const savedPetId = result.pet?.id || profileToSave.backendPetId;
      addDogKeyRef.current = null;
      setProfile({ ...profileToSave, backendPetId: savedPetId, isPublic: false });
      if (savedPetId) setActivePetId(savedPetId);
      await loadBootstrap(undefined, savedPetId);
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1600);
      return savedPetId || null;
    } catch {
      setError('Не удалось сохранить личный профиль. Изменения остались на экране — попробуй ещё раз.');
      return null;
    } finally {
      setProfileSaving(false);
    }
  }
  async function signOut() {
    await getSupabaseBrowser()?.auth.signOut();
    await fetch('/api/v1/session/logout', { method: 'POST', credentials: 'include' }).catch(() => null);
    setSession(null);
    setTelegramSession((current) => current.mode === 'telegram' ? { mode: 'browser', message: 'Вы вышли из Псё на этом устройстве.' } : current);
    setProfile(defaultProfile);
    setReminders([]);
    setWishlist([]);
    setZones([]);
    setOwnerRoutes([]);
    setObservations([]);
    setDocuments([]);
  }

  async function createReminder(title?: string, type = newReminderType, dueInDays = 0, explicitDueDate?: string) {
    const reminderTitle = (title || newReminderTitle).trim();
    if (!reminderTitle) {
      setError('Напиши, что нужно сделать для собаки.');
      return false;
    }
    const dueAt = explicitDueDate
      ? reminderDueAt(explicitDueDate, newReminderDueTime, newReminderTimeMode)
      : title
        ? new Date(Date.now() + dueInDays * 86400000).toISOString()
        : reminderDueAt(newReminderDueDate, newReminderDueTime, newReminderTimeMode);
    const recurrence = title ? 'none' : newReminderRecurrence;
    if (!profile.backendPetId) {
      if (!isGuestMode()) {
        setError('Сначала сохрани профиль собаки.');
        return false;
      }
      ensureGuestPetId();
    }
    if (isGuestMode()) {
      const petId = ensureGuestPetId();
      const id = guestId('reminder');
      setReminders((current) => [{ id, petId, type, title: reminderTitle, dueAt, recurrence, status: 'active' }, ...current]);
      setNewReminderTitle('');
      setCareFeedback({ kind: 'created', reminderId: id, title: reminderTitle });
      if (tab === 'today') resetViewScroll();
      return true;
    }
    const scope = `reminder:create:${profile.backendPetId}:${reminderTitle}:${dueAt}:${type}:${recurrence}`;
    setReminderMutationBusy(scope);
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify({ petId: profile.backendPetId, title: reminderTitle, dueAt, type, recurrence, source: 'manual_calendar' }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError('Дело не сохранилось. Всё введённое осталось в форме — проверь связь и попробуй снова.');
        return false;
      }
      setNewReminderTitle('');
      setNewReminderRecurrence('none');
      await loadBootstrap();
      finishCareMutation(scope);
      setCareFeedback({ kind: 'created', reminderId: String(result.reminder?.id || ''), title: reminderTitle });
      if (tab === 'today') resetViewScroll();
      return true;
    } catch {
      setError('Дело не сохранилось. Всё введённое осталось в форме — проверь связь и попробуй снова.');
      return false;
    } finally {
      setReminderMutationBusy(null);
    }
  }

  async function createWishlistItem(preset?: { title: string; category?: string; reason?: string; priority?: string }) {
    const title = (preset?.title || newWishTitle).trim();
    if (!title) { setError('Добавь название позиции.'); return false; }
    if (!profile.backendPetId) {
      if (!isGuestMode()) { setError('Сначала сохрани профиль собаки.'); return false; }
      ensureGuestPetId();
    }
    if (isGuestMode()) {
      const petId = ensureGuestPetId();
      setWishlist((current) => [{ id: guestId('wish'), petId, title, category: preset?.category || newWishCategory, reason: preset?.reason || newWishReason || undefined, priority: preset?.priority || 'medium', status: 'wanted', created_at: new Date().toISOString() }, ...current]);
      setNewWishTitle('');
      setNewWishReason('');
      setThingCaptureOpen(false);
      return true;
    }
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ petId: profile.backendPetId, title, category: preset?.category || newWishCategory, reason: preset?.reason || newWishReason || null, priority: preset?.priority || 'medium', status: 'wanted' }),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) { setError('Не удалось добавить вещь'); return false; }
      setNewWishTitle(''); setNewWishReason(''); setThingCaptureOpen(false);
      await loadBootstrap();
      return true;
    } catch {
      setError('Не удалось добавить вещь');
      return false;
    }
  }

  async function createZone(preset?: { title: string; type?: string; note?: string; radiusMeters?: number; approximateLat?: number; approximateLng?: number }) {
    const title = (preset?.title || newZoneTitle || (newZoneType === 'risk_zone' ? 'Опасное место' : 'Место на карте')).trim();
    if (!profile.backendPetId) {
      if (!isGuestMode()) { setError('Сначала сохрани профиль собаки.'); return false; }
      ensureGuestPetId();
    }
    if (isGuestMode()) {
      const petId = ensureGuestPetId();
      setZones((current) => [{ id: guestId('zone'), petId, type: preset?.type || newZoneType, title, note: preset?.note || newZoneNote || undefined, approximate_lat: preset?.approximateLat ?? pickedZonePoint?.lat ?? null, approximate_lng: preset?.approximateLng ?? pickedZonePoint?.lng ?? null, radius_meters: preset?.radiusMeters || 500, created_at: new Date().toISOString() }, ...current]);
      setNewZoneTitle('');
      setNewZoneNote('');
      setPickedZonePoint(null);
      setRoutePoints([]);
      setDrawMode('none');
      setMapSaveMode('private');
      setMapRouteMeta(null);
      setNotice('mapSaved');
      return true;
    }
    try {
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
      await response.json().catch(() => ({}));
      if (!response.ok) { setError('Не удалось сохранить место'); return false; }
      setNewZoneTitle(''); setNewZoneNote(''); setPickedZonePoint(null); setRoutePoints([]);
      setDrawMode('none'); setMapSaveMode('private'); setMapRouteMeta(null); setNotice('mapSaved');
      await loadBootstrap();
      return true;
    } catch {
      setError('Не удалось сохранить место');
      return false;
    }
  }

  function handleMapPick(point: { lat: number; lng: number }) {
    if (drawMode === 'route') {
      setRoutePoints((current) => [...current, [point.lng, point.lat]]);
      return;
    }
    setPickedZonePoint(point);
  }

  function handleMapClick(event: { latlng: { lat: number; lng: number } }) {
    handleMapPick(event.latlng);
  }

  async function createMapFeature(visibility: 'private' | 'shared') {
    if (drawMode === 'route' && routePoints.length < 2) return setError('Для маршрута нужны хотя бы две точки.');
    if (drawMode !== 'route' && !pickedZonePoint) return setError('Сначала коснись карты, чтобы выбрать точку.');
    const title = (newZoneTitle || (drawMode === 'route' ? 'Маршрут прогулки' : newZoneType === 'risk_zone' ? 'Опасное место' : 'Место на карте')).trim();

    if (isGuestMode()) {
      if (visibility === 'shared') return setError('Чтобы открыть ссылку, запусти Псё внутри Telegram. Личную запись можно сохранить уже сейчас.');
      if (drawMode === 'route') {
        setOwnerRoutes((current) => upsertOwnerRoute(current, {
          id: guestId('route'),
          petId: ensureGuestPetId(),
          type: 'route',
          title,
          description: newZoneNote.trim() || undefined,
          path: { type: 'LineString', coordinates: routePoints },
          visibility: 'private',
          routeSource: mapRouteMeta?.routeSource || 'planned',
          startedAt: mapRouteMeta?.startedAt,
          durationSeconds: mapRouteMeta?.durationSeconds,
          distanceMeters: mapRouteMeta?.distanceMeters,
        }));
        setNotice('mapSaved');
        setPickedZonePoint(null);
        setRoutePoints([]);
        setDrawMode('none');
        setNewZoneTitle('');
        setNewZoneNote('');
        setMapSaveMode('private');
        setMapRouteMeta(null);
        return;
      }
      await createZone();
      return;
    }
    if (!profile.backendPetId) return setError('Сначала сохрани профиль собаки.');

    const body = drawMode === 'route'
      ? { type: 'route', title, petId: profile.backendPetId, path: routePoints, visibility, description: newZoneNote || null, routeSource: mapRouteMeta?.routeSource || 'planned', startedAt: mapRouteMeta?.startedAt, durationSeconds: mapRouteMeta?.durationSeconds ?? 0, distanceMeters: mapRouteMeta?.distanceMeters ?? 0 }
      : { type: 'point', title, petId: profile.backendPetId, lat: pickedZonePoint?.lat, lng: pickedZonePoint?.lng, zone_type: newZoneType, visibility, description: newZoneNote || null };

    const response = await fetch('/api/map/features', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось сохранить место на карте');

    if (drawMode === 'route') {
      const createdRoute = normalizeOwnerRoutes([result.feature])[0];
      if (createdRoute) setOwnerRoutes((current) => upsertOwnerRoute(current, createdRoute));
    }
    setNotice(visibility === 'shared' ? 'sharing' : 'mapSaved');
    setPickedZonePoint(null);
    setRoutePoints([]);
    setDrawMode('none');
    setNewZoneTitle('');
    setNewZoneNote('');
    setMapSaveMode('private');
    setMapRouteMeta(null);
    if (visibility === 'shared' && result.shareUrl) {
      await navigator.clipboard?.writeText(result.shareUrl).catch(() => undefined);
      setNotice('copied');
    }
    await loadBootstrap();
  }

  function setProductionMapMode(mode: ProductionMapMode) {
    setError('');
    if (mode !== 'view') setNotice('idle');
    setPickedZonePoint(null);
    setRoutePoints([]);
    setMapSaveMode('private');
    if (mode !== 'route') setMapRouteMeta(null);
    if (mode === 'route') {
      setDrawMode('route');
      setNewZoneType('walk_route');
      return;
    }
    if (mode === 'risk') {
      setDrawMode('point');
      setNewZoneType('risk_zone');
      return;
    }
    setDrawMode('none');
  }

  async function saveProductionMapDraft() {
    if (mapDraftSaving) return;
    setMapDraftSaving(true);
    setError('');
    try {
      if (drawMode === 'route' || mapSaveMode === 'shared') await createMapFeature(mapSaveMode);
      else await createZone();
    } finally {
      setMapDraftSaving(false);
    }
  }

  function beginOwnerRouteEdit(route: OwnerRouteView) {
    setEditingRouteId(route.id);
    setRouteTitleDraft(route.title);
    setRouteDescriptionDraft(route.description || '');
  }

  async function updateOwnerRoute(id: string, patch: { title?: string; description?: string; visibility?: 'private' | 'shared' }) {
    if (routeMutationBusy) return;
    const currentRoute = ownerRoutes.find((route) => route.id === id);
    if (!currentRoute) return;
    setRouteMutationBusy(id);
    setError('');
    try {
      const response = await fetch(`/api/map/features/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(patch),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return setError('Не удалось изменить маршрут. Попробуй ещё раз.');
      const updatedRoute = normalizeOwnerRoutes([{
        ...currentRoute,
        ...result.feature,
        pet_id: result.feature?.pet_id || currentRoute.petId,
        path: currentRoute.path,
      }])[0];
      if (updatedRoute) setOwnerRoutes((routes) => upsertOwnerRoute(routes, updatedRoute));
      setEditingRouteId(null);
      return result;
    } finally {
      setRouteMutationBusy(null);
    }
  }

  async function shareOwnerRoute(route: OwnerRouteView) {
    const result = await updateOwnerRoute(route.id, { visibility: 'shared' });
    if (result?.shareUrl) {
      await navigator.clipboard?.writeText(result.shareUrl).catch(() => undefined);
      setNotice('copied');
    }
  }

  async function revokeOwnerRouteShare(route: OwnerRouteView) {
    await updateOwnerRoute(route.id, { visibility: 'private' });
  }

  async function deleteOwnerRoute(route: OwnerRouteView) {
    if (routeMutationBusy) return;
    setRouteMutationBusy(route.id);
    setError('');
    try {
      const response = await fetch(`/api/map/features/${route.id}`, { method: 'DELETE', headers: authHeaders() });
      if (!response.ok) return setError('Не удалось удалить маршрут. Попробуй ещё раз.');
      setOwnerRoutes((routes) => removeOwnerRoute(routes, route.id));
      setPendingRouteDeletion(null);
    } finally {
      setRouteMutationBusy(null);
    }
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
    const zone = zones.find((item) => item.id === id);
    if (isGuestMode()) {
      setZones((current) => current.filter((item) => item.id !== id));
      if (zone) setRemovedZone(zone);
      return;
    }
    const response = await fetch(`/api/zones/${id}`, { method: 'DELETE', headers: authHeaders() });
    await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось удалить место');
    if (zone) setRemovedZone(zone);
    await loadBootstrap();
  }

  async function restoreZone() {
    if (!removedZone) return;
    if (isGuestMode()) {
      setZones((current) => [removedZone, ...current.filter((zone) => zone.id !== removedZone.id)]);
      setRemovedZone(null);
      return;
    }
    const response = await fetch(`/api/zones/${removedZone.id}/restore`, { method: 'POST', headers: authHeaders() });
    await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось вернуть место');
    setRemovedZone(null);
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
    const item = wishlist.find((entry) => entry.id === id);
    if (isGuestMode()) {
      setWishlist((current) => current.filter((entry) => entry.id !== id));
      if (item) setRemovedWishlistItem(item);
      return;
    }
    const response = await fetch(`/api/wishlist/${id}`, { method: 'DELETE', headers: authHeaders() });
    await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось удалить вещь');
    if (item) setRemovedWishlistItem(item);
    await loadBootstrap();
  }

  async function restoreWishlistItem() {
    if (!removedWishlistItem) return;
    if (isGuestMode()) {
      setWishlist((current) => [removedWishlistItem, ...current.filter((item) => item.id !== removedWishlistItem.id)]);
      setRemovedWishlistItem(null);
      return;
    }
    const response = await fetch(`/api/wishlist/${removedWishlistItem.id}/restore`, { method: 'POST', headers: authHeaders() });
    await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось вернуть вещь');
    setRemovedWishlistItem(null);
    await loadBootstrap();
  }

  async function updateReminder(id: string, patch: Partial<ReminderView>) {
    if (isGuestMode()) {
      setReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, ...patch } : reminder));
      return true;
    }
    const serverPatch = { title: patch.title, type: patch.type, dueAt: patch.dueAt, recurrence: patch.recurrence };
    const scope = `reminder:update:${id}:${JSON.stringify(serverPatch)}`;
    setReminderMutationBusy(scope);
    try {
      const response = await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify(serverPatch),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) {
        setError('Не получилось сохранить изменение. Проверь связь и попробуй ещё раз.');
        return false;
      }
      await loadBootstrap();
      finishCareMutation(scope);
      return true;
    } catch {
      setError('Не получилось сохранить изменение. Проверь связь и попробуй ещё раз.');
      return false;
    } finally {
      setReminderMutationBusy(null);
    }
  }

  async function deleteReminder(id: string) {
    if (isGuestMode()) {
      setReminders((current) => current.filter((reminder) => reminder.id !== id));
      return true;
    }
    const scope = `reminder:delete:${id}`;
    try {
      const response = await fetch(`/api/reminders/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify({}),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) {
        setError('Не получилось удалить дело. Проверь связь и попробуй ещё раз.');
        return false;
      }
      await loadBootstrap();
      finishCareMutation(scope);
      return true;
    } catch {
      setError('Не получилось удалить дело. Проверь связь и попробуй ещё раз.');
      return false;
    }
  }

  async function completeReminder(id: string) {
    const reminder = reminders.find((item) => item.id === id);
    if (!reminder) {
      setError('Не удалось найти дело в плане.');
      return false;
    }
    if (isGuestMode()) {
      setReminders((current) => current.map((item) => item.id === id ? { ...item, status: 'done', completedAt: new Date().toISOString() } : item));
      setCareFeedback({ kind: 'completed', reminderId: id, title: reminder.title });
      return true;
    }
    const scope = `reminder:complete:${id}`;
    const completedAt = careMutationTime(scope, () => new Date().toISOString());
    setReminderMutationBusy(scope);
    try {
      const response = await fetch(`/api/reminders/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify({ completedAt }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError('Не получилось отметить дело. Проверь связь и попробуй ещё раз.');
        return false;
      }
      await loadBootstrap();
      if (payload.historyOccurrence) {
        setReminderHistory((current) => ({
          ...current,
          [id]: [{ id: `${id}-${completedAt}`, payload: payload.historyOccurrence, createdAt: completedAt }, ...(current[id] ?? [])],
        }));
      }
      finishCareMutation(scope);
      setCareFeedback({ kind: 'completed', reminderId: id, title: reminder.title });
      return true;
    } catch {
      setError('Не получилось отметить дело. Проверь связь и попробуй ещё раз.');
      return false;
    } finally {
      setReminderMutationBusy(null);
    }
  }

  async function undoLastCareCompletion() {
    if (careFeedback?.kind === 'observation-deleted') await restoreObservation();
  }

  async function confirmCareDeletion(id: string) {
    setCareDeletionBusy(true);
    const deleted = await deleteReminder(id);
    setCareDeletionBusy(false);
    if (!deleted) return;
    setPendingCareDeletion(null);
  }

  async function snoozeReminder(id: string) {
    const scope = `reminder:snooze:${id}:day`;
    const snoozedUntil = careMutationTime(scope, () => new Date(Date.now() + 86400000).toISOString());
    if (isGuestMode()) { setReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, status: 'snoozed', snoozedUntil } : reminder)); return; }
    setReminderMutationBusy(scope);
    try {
      const response = await fetch(`/api/reminders/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify({ snoozedUntil }),
      });
      if (!response.ok) return setError('Не удалось перенести дело. Проверь связь и попробуй ещё раз.');
      await loadBootstrap();
      finishCareMutation(scope);
    } catch {
      setError('Не удалось перенести дело. Проверь связь и попробуй ещё раз.');
    } finally {
      setReminderMutationBusy(null);
    }
  }

  async function rescheduleReminder(id: string, days: number) {
    const next = new Date();
    next.setDate(next.getDate() + days);
    await updateReminder(id, { dueAt: isoFromDateInput(dateInputValue(next)) });
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
    setAssistantMessages((current) => [...current, { role: 'user', content: question }]);
    let response: Response;
    try {
      response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
        ...(isGuestMode() ? {} : { petId: profile.backendPetId }),
        ...(assistantThreadId ? { threadId: assistantThreadId } : {}),
        question,
        context: {
          pet: {
            name: profile.dogName,
            breed_id: profile.breedId,
            breed_group_id: profile.breedGroupId,
            custom_breed: profile.breedCustom,
            sex: profile.sex,
            life_stage: profile.lifeStage,
            weight_kg: parseFloat(profile.weight) || undefined,
          },
          passport: {
            diet: profile.diet,
            allergies: profile.allergies,
            medication: profile.medication,
            health_notes: profile.healthNotes,
            vaccine_status: profile.vaccineStatus,
            parasite_status: profile.parasiteStatus,
          },
          social: {
            temperament: profile.temperament,
            energy_level: profile.energyLevel,
            play_style: profile.playStyle,
            trainability: profile.trainability,
            social_mode: profile.socialMode,
            child_friendly: profile.childFriendly,
            dog_friendly: profile.dogFriendly,
            cat_friendly: profile.catFriendly,
            triggers: profile.triggers ? profile.triggers.split(',').map((item) => item.trim()).filter(Boolean) : [],
            alone_time_note: profile.aloneTime,
          },
        },
        reminders: activeReminders.slice(0, 5).map((item) => ({ title: item.title })),
        }),
      });
    } catch {
      setAssistantLoading(false);
      setAssistantMessages((current) => current.slice(0, -1));
      setError('Псё не ответил. Проверь связь и попробуй ещё раз.');
      return;
    }
    const result = await response.json().catch(() => ({}));
    setAssistantLoading(false);
    if (!response.ok) {
      setAssistantMessages((current) => current.slice(0, -1));
      return setError('Псё не ответил. Проверь связь и попробуй ещё раз.');
    }
    setAssistantQuestion('');
    setAssistantAnswer(result.answer || 'Не получилось составить ответ. Уточни вопрос.');
    setAssistantMessages((current) => [...current, { role: 'assistant', content: result.answer || 'Не получилось составить ответ. Уточни вопрос.' }]);
    setAssistantActions(Array.isArray(result.actionSuggestions) ? result.actionSuggestions : []);
    setAssistantThreadId(typeof result.threadId === 'string' ? result.threadId : assistantThreadId);
    setAssistantDiagnostic({ provider: result.provider, mode: result.mode });
  }

  async function handleApplyAction(action: ActionSuggestion) {
    const title = action.payload.title?.trim();
    let applied = false;
    if (action.type === 'create_reminder') {
      applied = await createReminder(title, 'custom', 0, action.payload.dueDate);
    } else if (action.type === 'add_wishlist') {
      applied = await createWishlistItem({
        title: title || 'Позиция для собаки',
        category: action.payload.category || 'other',
        reason: action.payload.note,
        priority: action.safetyFlag === 'vet_boundary' ? 'high' : 'medium',
      });
    } else if (action.type === 'add_map_note') {
      applied = await createZone({
        title: title || 'Заметка на карте',
        type: 'safe_place',
        note: action.payload.note,
      });
    }
    if (!applied) return;
    setNotice('applied');
    window.setTimeout(() => setNotice('idle'), 1400);
  }

  async function startPlusCheckout() {
    setError('');
    const response = await fetch('/api/billing/telegram-stars/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.invoiceLink) {
      const reason = result?.meta?.disabledReason || billing?.upgrade?.disabledReason || 'Оплата Псё Плюс пока закрыта до release gate.';
      setError(reason);
      return;
    }
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('medium');
    window.Telegram?.WebApp?.openTelegramLink?.(result.invoiceLink) ?? window.open(result.invoiceLink, '_blank', 'noopener,noreferrer');
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
    setTab('today');
  }

  useEffect(() => {
    if (demoSeededRef.current || new URLSearchParams(window.location.search).get('demo') !== '1') return;
    demoSeededRef.current = true;
    seedDemoExperience();
  }, []);

  function reset() { resetProfileStorage(); setProfile(defaultProfile); setHeroNameDraft(''); setDogCreationOpen(false); setAvatarState('idle'); setGeneratedAvatarUrl(''); setDemoMode(false); setError(''); }

  function absolutePublicCardUrl() {
    return new URL(publicCardHref, window.location.origin).toString();
  }

  async function publishPublicDogCard({ regenerate = false }: { regenerate?: boolean } = {}) {
    if (!publicCardReady) {
      setTab('profile');
      return '';
    }
    if (publishedPublicCardPath && !regenerate) return publishedPublicCardPath;
    if (isGuestMode()) return publicCardHref;

    let petId = profile.backendPetId;
    if (!petId) {
      petId = await savePrivateProfile() || '';
    }
    if (!petId) {
      setError('Сначала сохрани профиль собаки.');
      setTab('profile');
      return '';
    }

    setPublicCardLinkBusy(true);
    setNotice('sharing');
    try {
      const response = await fetch('/api/dog-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          petId,
          visibility: 'unlisted',
          fields: publicCardPayload,
          regenerate,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result?.path) {
        setError('Не удалось подготовить ссылку на памятку.');
        setNotice('idle');
        return '';
      }
      setPublishedPublicCardPath(result.path);
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1400);
      return String(result.path);
    } finally {
      setPublicCardLinkBusy(false);
    }
  }

  async function regeneratePublicDogCard() {
    const path = await publishPublicDogCard({ regenerate: true });
    if (path) window.open(path, '_blank', 'noopener,noreferrer');
  }

  async function revokePublicDogCard() {
    if (isGuestMode()) {
      setPublishedPublicCardPath('');
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1400);
      return;
    }
    if (!profile.backendPetId) return setError('Сначала сохрани профиль собаки.');

    setPublicCardLinkBusy(true);
    try {
      const response = await fetch('/api/dog-cards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ petId: profile.backendPetId }),
      });
      if (!response.ok) {
        setError('Не удалось отозвать ссылку.');
        return;
      }
      setPublishedPublicCardPath('');
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1400);
    } finally {
      setPublicCardLinkBusy(false);
    }
  }

  async function deleteCurrentDog() {
    const expectedName = profile.dogName.trim();
    if (!profile.backendPetId || dogDeleteName.trim() !== expectedName || petMutationBusy) return;
    setPetMutationBusy(true);
    setError('');
    try {
      if (!isGuestMode()) {
        const response = await fetch('/api/v1/pets', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ petId: profile.backendPetId, confirmation: 'DELETE_DOG' }),
        });
        if (!response.ok) throw new Error('PET_DELETE_FAILED');
      }
      const remainingPets = pets.filter((pet) => pet.id !== profile.backendPetId);
      setPets(remainingPets);
      setDogDeleteName('');
      setPublishedPublicCardPath('');
      if (remainingPets[0]) {
        const nextPetId = remainingPets[0].id;
        setActivePetId(nextPetId);
        if (!isGuestMode()) {
          await fetch('/api/v1/pets', {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ activePetId: nextPetId }),
          });
        }
        await loadBootstrap(undefined, nextPetId);
      } else {
        resetProfileStorage();
        setProfile(defaultProfile);
        setHeroNameDraft('');
        setActivePetId('');
        setReminders([]);
        setWishlist([]);
        setZones([]);
        setObservations([]);
        setDocuments([]);
        setTab('today');
      }
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1400);
    } catch {
      setError('Не удалось удалить собаку. Ничего не изменилось — попробуй ещё раз.');
    } finally {
      setPetMutationBusy(false);
    }
  }

  async function deleteAccount() {
    if (accountDeleteConfirmation.trim() !== 'УДАЛИТЬ АККАУНТ' || petMutationBusy || isGuestMode()) return;
    setPetMutationBusy(true);
    setError('');
    try {
      const response = await fetch('/api/v1/account', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ confirmation: 'DELETE_ACCOUNT' }),
      });
      if (!response.ok) throw new Error('ACCOUNT_DELETE_FAILED');
      await getSupabaseBrowser()?.auth.signOut().catch(() => null);
      resetProfileStorage();
      setSession(null);
      setTelegramSession({ mode: 'browser', message: 'Аккаунт удалён.' });
      setProfile(defaultProfile);
      setPets([]);
      setActivePetId('');
      setReminders([]);
      setWishlist([]);
      setZones([]);
      setObservations([]);
      setDocuments([]);
      setPublishedPublicCardPath('');
      setAccountDeleteConfirmation('');
      setTab('today');
    } catch {
      setError('Не удалось удалить аккаунт. Данные не изменились — попробуй ещё раз.');
    } finally {
      setPetMutationBusy(false);
    }
  }

  async function shareDogCard() {
    if (!publicCardReady) {
      setTab('profile');
      return;
    }
    const path = await publishPublicDogCard();
    if (!path) return;
    const url = new URL(path, window.location.origin).toString();
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

  async function openDogCardPdf() {
    if (!publicCardReady) {
      setTab('profile');
      return;
    }
    const path = await publishPublicDogCard();
    if (!path) return;
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('medium');
    window.open(path, '_blank', 'noopener,noreferrer');
  }

  async function openPublicCard() {
    if (!publicCardReady) {
      setTab('profile');
      return;
    }
    const path = await publishPublicDogCard();
    if (!path) return;
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
    window.open(path, '_blank', 'noopener,noreferrer');
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
    const sub = profile.temperament || profile.playStyle || `${breedLabel} · ${profile.socialMode || 'сначала спросить владельца'}`;
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
    ctx.fillText(`Создано в Псё · ${new Date().toLocaleDateString('ru-RU')}`, pad, height - pad);
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

  const productionMapMode: ProductionMapMode = drawMode === 'route'
    ? 'route'
    : drawMode === 'point' && newZoneType === 'risk_zone'
      ? 'risk'
      : 'view';
  const mapDraftReady = drawMode === 'route' ? routePoints.length >= 2 : Boolean(pickedZonePoint);
  const mapComposerContent = <section className="production-map-composer" data-map-composer-content aria-label={productionMapMode === 'route' ? 'Новый маршрут' : 'Новое предупреждение'}>
    <div className="production-map-composer-status">
      <span aria-hidden="true">{productionMapMode === 'route' ? <MapTrifold weight="regular" /> : <ShieldWarning weight="fill" />}</span>
      <div><b>{productionMapMode === 'route' ? `Поставлено: ${routePoints.length}` : pickedZonePoint ? 'Примерное место выбрано' : 'Выберите место'}</b><p>{productionMapMode === 'route' ? 'Касайтесь карты по ходу прогулки. Достаточно двух точек.' : mapSaveMode === 'shared' ? 'По ссылке будет видна только приблизительная область.' : 'Отметка останется личной. Точное место никому не показывается.'}</p></div>
    </div>
    <label>Название <span>необязательно</span><input value={newZoneTitle} onChange={(event) => setNewZoneTitle(event.target.value)} placeholder={productionMapMode === 'route' ? 'Например, вечерний круг' : 'Например, битое стекло'} /></label>
    <label>Что важно знать <span>необязательно</span><textarea value={newZoneNote} onChange={(event) => setNewZoneNote(event.target.value)} placeholder={productionMapMode === 'route' ? 'Покрытие, вода, освещение' : 'Что произошло и когда заметили'} rows={2} /></label>
    <section className="production-map-privacy" aria-label="Кому видно">
      <button type="button" className={mapSaveMode === 'private' ? 'active' : ''} onClick={() => setMapSaveMode('private')} aria-pressed={mapSaveMode === 'private'}><b>Только мне</b><span>личная отметка</span></button>
      <button type="button" className={mapSaveMode === 'shared' ? 'active' : ''} onClick={() => setMapSaveMode('shared')} aria-pressed={mapSaveMode === 'shared'}><b>По ссылке</b><span>можно закрыть позже</span></button>
    </section>
    <div className="production-map-composer-actions">
      <button type="button" className="secondary" onClick={() => setProductionMapMode('view')}>{productionMapMode === 'route' ? 'Отменить маршрут' : 'Отменить'}</button>
      {productionMapMode === 'route' && routePoints.length > 0 && <button type="button" className="secondary" onClick={() => setRoutePoints([])}>Очистить</button>}
      <button type="button" className="primary" disabled={!mapDraftReady || mapDraftSaving} onClick={() => void saveProductionMapDraft()}>{mapDraftSaving ? 'Сохраняю…' : !mapDraftReady ? productionMapMode === 'route' ? 'Отметьте две точки' : 'Коснитесь карты' : mapSaveMode === 'shared' ? 'Сохранить и скопировать ссылку' : 'Сохранить лично'}</button>
    </div>
  </section>;
  const mapSavedContent = <section className="production-map-saved" data-map-saved-content aria-label="Сохранённое на карте">
    {zones.length === 0 && ownerRoutes.length === 0 && <article className="production-map-empty"><MapPin weight="regular" aria-hidden="true" /><div><b>Карта пока чистая</b><p>Сохраните маршрут или предупредите об опасном месте.</p></div></article>}
    {zones.map((zone) => <article key={zone.id} className={`production-map-saved-row ${zone.type === 'risk_zone' ? 'risk' : 'place'}`}>
      <span className="production-map-saved-mark" aria-hidden="true"><MapTrifold weight="regular" /></span>
      <div><b>{zone.title}</b><p>{formatZoneMeta(zone)} · {zone.visibility === 'shared' ? 'по ссылке' : 'только вам'}</p></div>
      <button type="button" className="danger-action" onClick={() => deleteZone(zone.id)}>Убрать</button>
    </article>)}
    {ownerRoutes.map((route) => <article key={route.id} className="production-map-saved-row route">
      <span className="production-map-saved-mark" aria-hidden="true"><MapPin weight="fill" /></span>
      {editingRouteId === route.id ? <div className="production-map-route-edit"><input value={routeTitleDraft} onChange={(event) => setRouteTitleDraft(event.target.value)} aria-label="Название маршрута" /><input value={routeDescriptionDraft} onChange={(event) => setRouteDescriptionDraft(event.target.value)} aria-label="Заметка о маршруте" /><span><button type="button" disabled={Boolean(routeMutationBusy) || !routeTitleDraft.trim()} onClick={() => updateOwnerRoute(route.id, { title: routeTitleDraft.trim(), description: routeDescriptionDraft.trim() })}>Сохранить</button><button type="button" onClick={() => setEditingRouteId(null)}>Отмена</button></span></div> : <><div><b>{route.title}</b><p>{route.routeSource === 'recorded' ? `${route.startedAt ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(route.startedAt)) + ' · ' : ''}${route.durationSeconds !== undefined ? `${Math.floor(route.durationSeconds / 60)} мин · ` : ''}${route.distanceMeters !== undefined ? route.distanceMeters < 1000 ? `${route.distanceMeters} м` : `${(route.distanceMeters / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} км` : 'Записанная прогулка'}` : route.description || 'Маршрут построен заранее'} · {route.visibility === 'shared' ? 'по ссылке' : 'только вам'}</p></div><div className="production-map-row-actions"><button type="button" onClick={() => beginOwnerRouteEdit(route)}>Изменить</button><button type="button" onClick={() => route.visibility === 'shared' ? revokeOwnerRouteShare(route) : shareOwnerRoute(route)}>{route.visibility === 'shared' ? 'Закрыть ссылку' : 'Поделиться'}</button><button type="button" className="danger-action" onClick={() => setPendingRouteDeletion(route)}>Убрать</button></div></>}
    </article>)}
    {removedZone && <div className="restore-notice" role="status"><span>Место убрано</span><button type="button" onClick={restoreZone}>Вернуть</button></div>}
  </section>;

  return (
    <main className="app-canvas">
      <section ref={phoneShellRef} className={`phone-shell tab-${tab}${hasDog && (isJourneyRoute || journeyDetail === 'nearby') ? ' journey-active' : ''}`}>
        <header className="app-header">
          <div className="app-wordmark">
            <p>план ухода и памятка</p>
            <h1>Псё</h1>
          </div>
          <TelegramPill session={telegramSession} />
          {session
            ? <button onClick={signOut}>Выйти</button>
            : hasDog
              ? <button onClick={() => setTab(tab === 'profile' ? 'today' : 'profile')}>{tab === 'profile' ? 'всё' : 'псё'}</button>
              : <button onClick={() => setDogCreationOpen(true)}>Добавить собаку</button>}
        </header>

        {pets.length > 0 && <section className="pet-switcher" aria-label="Активная собака">
          <span>мои собаки</span>
          <div>
            {pets.map((pet) => <button key={pet.id} className={pet.id === activePetId ? 'active' : ''} type="button" disabled={petMutationBusy} onClick={() => switchActivePet(pet.id)} aria-pressed={pet.id === activePetId}>
              {pet.name}
            </button>)}
            <button type="button" className="secondary" onClick={() => setAddDogOpen((open) => !open)}>Добавить собаку</button>
          </div>
          {addDogOpen && <div className="pet-add-row">
            <label>Имя новой собаки<input value={newDogName} maxLength={80} autoFocus onChange={(event) => setNewDogName(event.target.value)} placeholder="Например, Луна" /></label>
            <button type="button" className="primary" disabled={!newDogName.trim() || petMutationBusy} onClick={addDog}>{petMutationBusy ? 'Добавляю…' : 'Добавить'}</button>
            <button type="button" className="secondary" disabled={petMutationBusy} onClick={() => { setAddDogOpen(false); setNewDogName(''); }}>Отмена</button>
          </div>}
          <p>Профиль, дела, места, вещи и наблюдения ниже относятся только к выбранной собаке.</p>
        </section>}

        {showAuthPanel && <section className={`auth-inline-panel mode-${authPanelMode}`} aria-label="Вход и синхронизация">
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
          </> : telegramSession.mode === 'browser' ? <>
            <div><b>Демо без входа</b><p>Личный профиль, Псё Плюс и сохранение доступны внутри Telegram. В браузере можно спокойно посмотреть интерфейс без входа.</p></div>
          </> : <>
            <div><b>Локальный режим</b><p>Можно продолжить сейчас. Для сохранения открой через Telegram.</p></div>
          </>}
        </section>}

        {!hasDog && <section className="first-run-activation" aria-labelledby="first-run-title">
          <GeneratedAvatar profile={profile} ready={false} size="large" />
          <div>
            <h2 id="first-run-title">Добавь собаку</h2>
            <p>Начни с имени. После этого Псё покажет одно ближайшее дело и сохранит всё остальное на потом.</p>
          </div>
          <button className="primary" type="button" onClick={() => setDogCreationOpen(true)}>Добавить собаку</button>
        </section>}

        {hasDog && tab === 'today' && !journeyDetail && <ProductionJourney route="today"
          dogName={profile.dogName}
          breedLabel={breedLabel}
          avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />}
          careTitle={todayCare.title}
          careDetail={todayCare.detail}
          careState={todayCare.state === 'empty' ? 'empty' : todayCare.state === 'complete' ? 'complete' : 'active'}
          careActionLabel={todayCare.state === 'empty' ? 'Добавить первое дело' : todayCare.actionLabel}
          profileEntries={profileJourneyEntries}
          voiceCapture={<VoiceObservationCapture
            petId={profile.backendPetId || activePetId}
            petName={profile.dogName}
            authorId={telegramSession.ownerId || session?.user.email || 'owner'}
            onTranscribe={transcribeVoiceObservation}
            onExtract={extractVoiceObservationCandidates}
            onSave={saveVoiceObservationCandidates}
          />}
          onAskAssistant={openAssistantSheet}
          onCareAction={() => todayCare.reminderId
            ? completeReminder(todayCare.reminderId)
            : (setCareView(todayCare.target === 'history' ? 'history' : 'active'), setTab('calendar'))}
          onOpenIdentity={() => {
            setJourneyDetail(null);
            setTab('profile');
            setAvatarComposerOpen(true);
          }}
          onNavigate={(route) => {
            setJourneyDetail(null);
            setTab(route);
          }}
        />}

        {hasDog && tab === 'profile' && journeyDetail !== 'profile' && <ProfileMemoryWorkspace
          key={profile.backendPetId || activePetId}
          profile={profile}
          breedLabel={breedLabel}
          imageUrl={generatedAvatarUrl || profile.avatarImageUrl}
          observations={observations.map((item) => ({ id: item.id, createdAt: item.createdAt, mood: item.mood, appetite: item.appetite, stool: item.stool, energy: item.energy, note: item.note }))}
          documents={documents}
          reminders={reminders}
          voiceCapture={<VoiceObservationCapture
            petId={profile.backendPetId || activePetId}
            petName={profile.dogName}
            authorId={telegramSession.ownerId || session?.user.email || 'owner'}
            onTranscribe={transcribeVoiceObservation}
            onExtract={extractVoiceObservationCandidates}
            onSave={saveVoiceObservationCandidates}
          />}
          identityOpen={avatarComposerOpen}
          avatarCapabilities={avatarCapabilities}
          avatarDraftUrl={avatarDraftAssetId ? generatedAvatarUrl : ''}
          avatarDraftSource={avatarDraftSource}
          avatarState={avatarState}
          avatarOwnerPrompt={avatarOwnerPrompt}
          avatarConsent={avatarConsent}
          error={error}
          onBack={() => setTab('today')}
          onOpenIdentity={() => { setError(''); setAvatarComposerOpen(true); }}
          onCloseIdentity={() => setAvatarComposerOpen(false)}
          onPhotoChange={handlePhotos}
          onAvatarPromptChange={setAvatarOwnerPrompt}
          onAvatarConsentChange={setAvatarConsent}
          onGenerateAvatar={() => createAvatar()}
          onActivateAvatar={activateAvatarDraft}
          onDiscardAvatarDraft={discardAvatarDraft}
          onUseNoAvatar={useNoAvatar}
          onRollbackAvatar={rollbackAvatar}
          onSaveProfile={savePrivateProfile}
          onAddDocument={(trigger) => { documentUploadTriggerRef.current = trigger; setDocumentFileName(''); setDocumentUploadOpen(true); }}
          onAskAssistant={openAssistantSheet}
          onOpenPlan={() => { setCareView('active'); setTab('calendar'); }}
          onOpenHealth={() => setTab('health')}
          onOpenHabits={() => setTab('habits')}
          onOpenCard={() => setTab('card')}
          onOpenSettings={() => openJourneyDetail('profile')}
        />}

        {hasDog && tab === 'profile' && documentUploadOpen && <ProductionDocumentSheet dogName={petNameGent} returnFocusTo={documentUploadTriggerRef.current} onClose={() => { setDocumentUploadOpen(false); setDocumentFileName(''); }}>
          <form className="profile-life-document-form" data-slot="field-group" onSubmit={uploadPetDocument}>
            <label data-slot="field"><span data-slot="field-label">Что это</span><span className="document-field-control"><TextT weight="regular" aria-hidden="true" /><input data-slot="input" name="title" required placeholder="Например, общий анализ крови" /></span></label>
            <label data-slot="field"><span data-slot="field-label">Тип документа</span><span className="document-field-control document-select-control"><Files weight="regular" aria-hidden="true" /><select data-slot="input" name="kind" defaultValue="analysis"><option value="analysis">Анализ</option><option value="prescription">Назначение</option><option value="vaccination">Вакцинация</option><option value="other">Другое</option></select><CaretDown className="document-field-action" weight="regular" aria-hidden="true" /></span></label>
            <label data-slot="field"><span data-slot="field-label">Дата документа <small>необязательно</small></span><span className="document-field-control"><CalendarBlank weight="regular" aria-hidden="true" /><input data-slot="input" name="documentDate" type="date" /></span></label>
            <label data-slot="field"><span data-slot="field-label">Клиника <small>необязательно</small></span><span className="document-field-control"><Buildings weight="regular" aria-hidden="true" /><input data-slot="input" name="clinic" placeholder="Название клиники" /></span></label>
            <label className="document-file-drop" data-slot="field"><input data-slot="input" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setDocumentFileName(event.currentTarget.files?.[0]?.name || '')} aria-describedby={`profile-document-help${error ? ' profile-document-error' : ''}`} /><span className="document-file-drop-media" aria-hidden="true">{documentFileName ? <CheckCircle weight="fill" /> : <UploadSimple weight="regular" />}</span><span className="document-file-drop-copy"><b data-document-file-name>{documentFileName || 'Выбрать PDF или фото'}</b><small data-slot="field-description" id="profile-document-help">До 4 МБ · файл останется приватным</small></span><span className="document-file-drop-action" aria-hidden="true">{documentFileName ? 'Готово' : 'Выбрать'}</span></label>
            {error && <p className="profile-life-form-error" data-slot="field-error" id="profile-document-error" role="alert">{error}</p>}
            <button className="primary" data-slot="button" type="submit" disabled={documentUploading}>{documentUploading ? 'Добавляю…' : <><CheckCircle weight="regular" /> Добавить в историю {petNameGent}</>}</button>
          </form>
        </ProductionDocumentSheet>}

        {hasDog && tab === 'map' && <ProductionJourney route="map"
          dogName={profile.dogName}
          breedLabel={breedLabel}
          avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />}
          mapWorkspace={<ProductionMapWorkspace
            key={profile.backendPetId || activePetId}
            petId={profile.backendPetId || activePetId}
            dogName={profile.dogName}
            avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />}
            zones={zones}
            features={ownerRoutes}
            mode={productionMapMode}
            pickedPoint={pickedZonePoint}
            routePoints={routePoints}
            composer={mapComposerContent}
            savedContent={mapSavedContent}
            onOpenProfile={() => { setJourneyDetail(null); setTab('profile'); }}
            onModeChange={setProductionMapMode}
            onMapClick={handleMapClick}
            onAppendRoutePoint={(point) => setRoutePoints((current) => [...current, point])}
            onReplaceRoutePoints={setRoutePoints}
            onClearDraft={() => { setRoutePoints([]); setPickedZonePoint(null); }}
            onSaveDraft={() => void saveProductionMapDraft()}
            canSaveDraft={mapDraftReady}
            savingDraft={mapDraftSaving}
            onRouteMetaChange={setMapRouteMeta}
          />}
          onNavigate={(route) => { setJourneyDetail(null); setTab(route); }}
        />}

        {hasDog && tab === 'nearby' && journeyDetail !== 'nearby' && <ProductionJourney route="nearby"
          dogName={profile.dogName}
          breedLabel={breedLabel}
          avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />}
          discoverable={socialProfile?.discoverable}
          candidates={[...socialCandidates.nearby, ...socialCandidates.city].slice(0, 2).map((candidate) => ({
            id: candidate.petId,
            name: candidate.name,
            distance: candidate.distance || candidate.district || 'в вашем городе',
            availability: candidate.sharedScenarios.includes('walk') ? 'готовы к прогулке' : 'готовы познакомиться',
            note: candidate.reasons.slice(0, 2).join(' · ') || 'Контакт откроется только по согласию',
            onOpen: () => openJourneyDetail('nearby'),
          }))}
          onOpenSocial={() => openJourneyDetail('nearby')}
          onNavigate={(route) => {
            if (route === 'nearby') openJourneyDetail('nearby');
            else { setJourneyDetail(null); setTab(route); }
          }}
        />}

        {hasDog && tab === 'things' && journeyDetail !== 'things' && <ProductionJourney route="things"
          dogName={profile.dogName}
          breedLabel={breedLabel}
          avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />}
          things={wantedWishlist.slice(0, 3).map((item, index) => ({
            id: item.id,
            title: item.title,
            detail: item.reason || (item.priority === 'high' ? 'важно купить' : 'в личном списке'),
            tone: index === 1 ? 'rose' : index === 2 ? 'green' : 'mint',
          }))}
          onAddThing={() => { openJourneyDetail('things'); setThingCaptureOpen(true); }}
          onNavigate={(route) => {
            if (route === 'things') openJourneyDetail('things');
            else { setJourneyDetail(null); setTab(route); }
          }}
        />}

        {hasDog && assistantOpen && <ProductionAssistantSheet
          dogName={profile.dogName}
          avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />}
          question={assistantQuestion}
          answer={assistantAnswer}
          messages={assistantMessages}
          loading={assistantLoading}
          error={error}
          actions={<AssistantActionButtons actions={assistantActions} onApply={handleApplyAction} />}
          diagnostic={assistantDiagnostic}
          onQuestionChange={setAssistantQuestion}
          onAsk={(question) => { void askAssistant(question); }}
          onClose={() => { if (window.history.state?.overlay === 'assistant') window.history.back(); else setAssistantOpen(false); }}
        />}

        {hasDog && tab === 'habits' && <HabitScreen
          dogName={petNameGent}
          habits={habits}
          loading={habitLoading}
          error={moduleErrors.habits}
          busyId={habitBusyId}
          canPersist={!isGuestMode() && Boolean(profile.backendPetId)}
          onBack={() => closeSecondaryFlow('today')}
          onCreate={createHabit}
          onUpdate={updateHabit}
          onArchive={archiveHabit}
          onCheckIn={checkInHabit}
          onRetry={() => loadRealModules(profile.backendPetId)}
        />}

        {hasDog && tab === 'health' && <HealthTimelineScreen
          dogName={petNameGent}
          entries={observations}
          draft={observationDraft}
          saving={observationSaving}
          error={moduleErrors.health}
          onBack={() => closeSecondaryFlow('today')}
          onDraftChange={updateObservationDraft}
          onSave={submitObservation}
          onRetry={() => loadRealModules(profile.backendPetId)}
          editingId={editingObservationId}
          editDraft={observationEditDraft}
          mutationBusy={observationMutationBusy}
          onStartEdit={startObservationEdit}
          onEditDraftChange={(patch) => setObservationEditDraft((current) => ({ ...current, ...patch }))}
          onSaveEdit={editObservation}
          onCancelEdit={() => setEditingObservationId(null)}
          onDelete={deleteObservation}
          facts={{ allergies: profile.allergies, medication: profile.medication, vaccineStatus: profile.vaccineStatus, parasiteStatus: profile.parasiteStatus, healthNotes: profile.healthNotes }}
          onFactChange={(patch) => updateProfile(patch)}
          onSaveFacts={async () => { await savePrivateProfile(); }}
        />}

        {hasDog && tab === 'nearby' && journeyDetail === 'nearby' && <ProductionWoofWorkspace
          dogName={profile.dogName || 'Собака'}
          avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" fill />}
          profile={socialProfile}
          signals={walkSignals}
          viewerLocation={socialViewerLocation}
          viewerRadiusMeters={socialViewerRadiusMeters}
          signalReason={walkSignalReason}
          candidates={socialCandidates}
          requests={socialRequests}
          state={nearbyState}
          busyId={socialBusyId}
          locating={socialLocating}
          missingTelegramUsernameAction={missingTelegramUsernameAction}
          invite={socialInvite ? { petName: socialInvite.petName, expiresAt: socialInvite.expiresAt } : null}
          inviteState={socialInviteState}
          onAcceptInvite={acceptSocialInvite}
          onDismissInvite={dismissSocialInvite}
          onSaveProfile={saveSocialProfile}
          onHideProfile={hideSocialProfile}
          onLocateProfile={locateForSocial}
          onLocateViewer={locateForWalkSignals}
          onSaveSignal={saveWalkSignal}
          onCloseSignal={closeWalkSignal}
          onRequest={sendSocialRequest}
          onUpdateRequest={updateSocialRequest}
          onReport={reportSocialRequest}
          onOpenContact={openTelegramDestination}
          onRefresh={refreshLiveSocial}
          onRetry={() => loadSocialSurface().catch(() => setNearbyState('error'))}
        />}

        {hasDog && tab === 'calendar' && <WatercolorScreen className="calendar-composition" tone="gold" eyebrow="план ухода" title="План заботы" caption="Добавить, перенести, закрыть или вернуть дело без отдельной возни с календарём." aside={<CalendarDots className="watercolor-hero-mark" weight="duotone" aria-hidden="true" />}>
          <SecondaryFlowHeader label="Назад во Всё" onBack={() => closeSecondaryFlow('today')} />
          <section className="care-workbench" aria-label="Дела ухода">
            <div className="care-workbench-head">
              <div><span className="eyebrow">сейчас в плане</span><h3>{activeReminders.length ? formatCount(activeReminders.length, ['активное дело', 'активных дела', 'активных дел']) : 'Добавь первое дело'}</h3></div>
              <button className="primary" onClick={() => document.querySelector<HTMLInputElement>('.today-quick-add input')?.focus()}>Добавить дело</button>
            </div>
            <div className="care-view-toggle" aria-label="Раздел плана ухода">
              <button className={careView === 'active' ? 'active' : ''} onClick={() => setCareView('active')} aria-pressed={careView === 'active'}>Ближайшие</button>
              <button className={careView === 'history' ? 'active' : ''} onClick={() => setCareView('history')} aria-pressed={careView === 'history'}>История</button>
            </div>

            {careView === 'active' && <div className="care-task-list">
              {visibleCareReminders.length === 0 && <article className="care-empty-state"><b>Добавь первое дело</b><p>Обработка, вакцина, груминг, корм, врач или своё напоминание. Дальше оно будет видно первым экраном и уйдёт в историю после выполнения.</p></article>}
              {visibleCareReminders.map((reminder) => <article key={reminder.id} className={`care-task-card ${new Date(reminder.snoozedUntil || reminder.dueAt).getTime() < new Date().setHours(0, 0, 0, 0) ? 'warning' : ''}`}>
                {editingReminderId === reminder.id ? <form className="reminder-edit-form" onSubmit={async (event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  const saved = await updateReminder(reminder.id, {
                    title: String(data.get('title') || reminder.title),
                    type: String(data.get('type') || reminder.type),
                    dueAt: reminderDueAt(String(data.get('dueDate') || reminderDateInputValue(reminder)), String(data.get('dueTime') || '09:00'), 'exact'),
                    recurrence: String(data.get('recurrence') || reminder.recurrence || 'none') as ReminderRecurrence,
                  });
                  if (saved) setEditingReminderId(null);
                }}>
                  <input name="title" defaultValue={reminder.title} aria-label="Название дела" />
                  <div className="reminder-edit-row">
                    <select name="type" defaultValue={reminder.type} aria-label="Тип дела">{careTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                    <input name="dueDate" type="date" defaultValue={reminderDateInputValue(reminder)} aria-label="Дата дела" />
                  </div>
                  <div className="reminder-edit-row">
                    <input name="dueTime" type="time" defaultValue={new Date(reminder.dueAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} aria-label="Время дела" />
                    <select name="recurrence" defaultValue={reminder.recurrence || 'none'} aria-label="Повтор дела">{reminderRecurrenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  </div>
                  <div className="care-row-actions"><button type="submit" disabled={Boolean(reminderMutationBusy)}>{reminderMutationBusy ? 'Сохраняю…' : 'Сохранить'}</button><button type="button" onClick={() => setEditingReminderId(null)} disabled={Boolean(reminderMutationBusy)}>Отмена</button></div>
                </form> : <>
                  <div className="care-task-main">
                    <span>{careTypeLabel(reminder.type)}</span>
                    <b>{reminder.title}</b>
                    <p>{reminderTimeLabel(reminder)} · {reminderRecurrenceLabel(reminder.recurrence)}</p>
                    {reminder.nextDueAt && <p>Следующий раз: {new Date(reminder.nextDueAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>}
                  </div>
                  <div className="care-row-actions">
                    <button disabled={Boolean(reminderMutationBusy)} onClick={() => completeReminder(reminder.id)}>Готово</button>
                    <button disabled={Boolean(reminderMutationBusy)} onClick={() => snoozeReminder(reminder.id)}>Отложить</button>
                    <button disabled={Boolean(reminderMutationBusy)} onClick={() => setEditingReminderId(reminder.id)}>Изменить</button>
                    <button disabled={Boolean(reminderMutationBusy)} className="danger-action" onClick={() => setPendingCareDeletion({ id: reminder.id, title: reminder.title })}>Удалить</button>
                  </div>
                </>}
              </article>)}
            </div>}

            {careView === 'history' && <div className="care-task-list">
              {doneReminders.length === 0 && Object.values(reminderHistory).every((items) => items.length === 0) && <article className="care-empty-state"><b>История начнётся после первого «Готово»</b><p>Так будет видно, когда была обработка, вакцина, груминг или визит.</p></article>}
              {doneReminders.slice(0, 12).map((reminder) => <article key={reminder.id} className="care-task-card done">
                <div className="care-task-main">
                  <span>{careTypeLabel(reminder.type)}</span>
                  <b>{reminder.title}</b>
                  <p>{new Date(reminder.completedAt || reminder.dueAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div className="care-row-actions"><button onClick={() => createReminder(reminder.title, reminder.type, 0)}>Создать снова</button><button className="danger-action" onClick={() => setPendingCareDeletion({ id: reminder.id, title: reminder.title })}>Удалить</button></div>
              </article>)}
              {reminders.flatMap((reminder) => (reminderHistory[reminder.id] ?? []).map((entry) => ({ reminder, entry }))).slice(0, 20).map(({ reminder, entry }) => <article key={entry.id} className="care-task-card done"><div className="care-task-main"><span>{careTypeLabel(reminder.type)}</span><b>{reminder.title}</b><p>Выполнено {new Date(entry.payload?.completedAt || entry.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</p>{entry.payload?.nextDueAt && <p>Следующий раз: {new Date(entry.payload.nextDueAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>}</div></article>)}
            </div>}
          </section>

          <article className="today-add-care care-composer">
            <div className="today-add-copy">
              <span className="eyebrow">новое дело</span>
              <b>Что нужно не забыть</b>
              <p>Название, тип и дата. Всё остальное можно поправить прямо в списке.</p>
            </div>
            <div className="quick-add today-quick-add">
              <input value={newReminderTitle} onChange={(event) => setNewReminderTitle(event.target.value)} placeholder="Например: обработка от клещей" />
              <button aria-label="Добавить дело" onClick={() => createReminder()}>+</button>
            </div>
            <div className="care-form-row">
              <select value={newReminderType} onChange={(event) => setNewReminderType(event.target.value)} aria-label="Тип дела">{careTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <input type="date" value={newReminderDueDate} onChange={(event) => setNewReminderDueDate(event.target.value)} aria-label="Дата дела" />
            </div>
            <div className="care-form-row">
              <select value={newReminderTimeMode} onChange={(event) => setNewReminderTimeMode(event.target.value as ReminderTimeMode)} aria-label="Точность времени">{reminderTimeModeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              {newReminderTimeMode === 'exact' ? <input type="time" value={newReminderDueTime} onChange={(event) => setNewReminderDueTime(event.target.value)} aria-label="Время дела" /> : <select value={newReminderRecurrence} onChange={(event) => setNewReminderRecurrence(event.target.value as ReminderRecurrence)} aria-label="Повтор дела">{reminderRecurrenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
            </div>
            {newReminderTimeMode === 'exact' && <label>Повтор<select value={newReminderRecurrence} onChange={(event) => setNewReminderRecurrence(event.target.value as ReminderRecurrence)}>{reminderRecurrenceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
            <div className="care-preset-grid" aria-label="Быстро добавить уход">
              <button onClick={() => createReminder('Обработка от клещей и паразитов', 'parasite', 30)}>Обработка</button>
              <button onClick={() => createReminder('Проверить дату вакцинации', 'vaccine', 7)}>Вакцинация</button>
              <button onClick={() => createReminder('Груминг: шерсть и когти', 'grooming', 14)}>Груминг</button>
            </div>
          </article>
        </WatercolorScreen>}

        {hasDog && tab === 'card' && <WatercolorScreen className="public-card-screen" tone="gold" eyebrow="памятка" title="Что увидит другой человек" caption="Короткая карточка для догситтера, грумера, друга или человека во дворе. Без точного адреса и без лишней анкеты." aside={<PawPrint className="watercolor-hero-mark" weight="duotone" aria-hidden="true" />}>
          <SecondaryFlowHeader label="Назад в Псё" onBack={() => closeSecondaryFlow('profile')} />
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
                <p>{publicCardShows('triggers') ? profile.triggers ? `Не делать: ${profile.triggers}.` : 'Лучше подходить спокойно, без резких рук и еды без разрешения.' : 'Дополнительные детали скрыты владельцем.'}</p>
              </div>
              <div className="public-card-preview-grid">
                <article><span>характер</span><b>{publicCardShows('character') ? profile.temperament || profile.energyLevel || 'Добавить характер' : 'скрыт'}</b></article>
                <article><span>район</span><b>{publicCardShows('area') ? safePublicArea(socialProfile?.district ?? undefined) : 'скрыт'}</b></article>
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
            <button className="primary" disabled={publicCardLinkBusy} onClick={publicCardReady ? shareDogCard : () => setTab('profile')}>{publicCardReady ? 'Поделиться' : 'Дозаполнить памятку'}</button>
            <button className="secondary" disabled={publicCardLinkBusy} onClick={publicCardReady ? openPublicCard : () => setTab('profile')}>{publicCardReady ? 'Открыть' : 'Заполнить'}</button>
            <button className="secondary" disabled={publicCardLinkBusy} onClick={publicCardReady ? openDogCardPdf : () => setTab('profile')}>{publicCardReady ? 'PDF / печать' : 'Заполнить перед печатью'}</button>
            {publishedPublicCardPath && <>
              <button className="secondary" disabled={publicCardLinkBusy} onClick={regeneratePublicDogCard}>Пересоздать ссылку</button>
              <button className="secondary danger" disabled={publicCardLinkBusy} onClick={revokePublicDogCard}>Отозвать</button>
            </>}
            {publishedPublicCardPath && <p>Активная ссылка: {publishedPublicCardPath}</p>}
          </section>

          <article className="public-card-privacy-note">
            <b>Что не публикуем автоматически</b>
            <p>Точный адрес, контакты владельца, медицинские заметки, лекарства и внутреннюю историю ухода. В памятку попадает только то, что нужно человеку рядом с собакой.</p>
          </article>
        </WatercolorScreen>}

        {hasDog && tab === 'profile' && journeyDetail === 'profile' && <WatercolorScreen className="profile-settings-screen" tone="green" eyebrow="настройки" title="Данные и доступ" caption="Профиль собаки редактируется в одном месте. Здесь — только доступ, документы сервиса и удаление данных.">
          <SecondaryFlowHeader label="Назад в Псё" onBack={closeJourneyDetail} />

          <section className="profile-settings-links" aria-label="Настройки и документы">
            <button type="button" onClick={() => setTab('card')}><span><b>Памятка для других</b><small>Проверить поля и ссылку перед отправкой</small></span><ArrowRight weight="bold" aria-hidden="true" /></button>
            <a href="/legal/privacy"><span><b>Приватность</b><small>Какие данные хранит Псё</small></span><ArrowRight weight="bold" aria-hidden="true" /></a>
            <a href="/legal/terms"><span><b>Условия использования</b><small>Правила сервиса</small></span><ArrowRight weight="bold" aria-hidden="true" /></a>
            <a href="/support"><span><b>Помощь</b><small>Поддержка и частые вопросы</small></span><ArrowRight weight="bold" aria-hidden="true" /></a>
          </section>

          <section className="plus-gate-card profile-plus-card" aria-label="Псё Плюс">
            <div><span className="eyebrow">{isPlusActive ? 'подписка активна' : 'псё плюс'}</span><h3>{plusPlan?.name || 'Псё Плюс'} · {plusPriceLabel}</h3><p>{plusPlan?.headline || 'Больше истории и собак без ограничения базовой безопасности.'}</p><small className="plus-gate-note">{plusGateLine}</small></div>
            <button className="primary" type="button" disabled={isPlusActive} onClick={startPlusCheckout}>{isPlusActive ? 'Подписка активна' : plusPlan?.cta || 'Оформить'}</button>
          </section>

          <section className="profile-danger-zone" aria-label="Удаление данных">
            <div><span className="eyebrow">управление данными</span><h3>Удаление</h3><p>Перед отправкой Псё попросит точное подтверждение. Действия необратимы.</p></div>
            {profile.backendPetId && <details><summary>Удалить собаку</summary><div className="profile-delete-form"><p>Будут удалены профиль {profile.dogName}, дела, записи, вещи и места.</p><label>Введите имя собаки полностью<input value={dogDeleteName} onChange={(event) => setDogDeleteName(event.target.value)} placeholder={profile.dogName} /></label><button type="button" className="danger-action" disabled={dogDeleteName.trim() !== profile.dogName.trim() || petMutationBusy} onClick={deleteCurrentDog}>Удалить собаку</button></div></details>}
            {!isGuestMode() && <details><summary>Удалить аккаунт</summary><div className="profile-delete-form"><p>Будут удалены аккаунт и данные всех собак без возможности восстановления.</p><label>Для подтверждения введи УДАЛИТЬ АККАУНТ<input value={accountDeleteConfirmation} onChange={(event) => setAccountDeleteConfirmation(event.target.value)} placeholder="УДАЛИТЬ АККАУНТ" /></label><button type="button" className="danger-action" disabled={accountDeleteConfirmation.trim() !== 'УДАЛИТЬ АККАУНТ' || petMutationBusy} onClick={deleteAccount}>Удалить аккаунт</button></div></details>}
          </section>
        </WatercolorScreen>}

        {hasDog && tab === 'things' && journeyDetail === 'things' && <WatercolorScreen className="things-composition" tone="gold" eyebrow="вещи" title={`Что нужно ${petNameDatv}`} caption="Личный список покупок и того, что заканчивается." aside={<ShoppingBag className="watercolor-hero-mark" weight="duotone" aria-hidden="true" />}>
          <div className="screen-primary-action">
            <button className="primary" type="button" aria-expanded={thingCaptureOpen} onClick={() => setThingCaptureOpen((open) => !open)}>
              {thingCaptureOpen ? 'Закрыть добавление' : 'Добавить вещь'}
            </button>
            <span>{formatCount(wantedWishlist.length, ['позиция', 'позиции', 'позиций'])}</span>
          </div>

          {thingCaptureOpen && <PaperSheet className="thing-capture">
            <div className="section-title">
              <div><span className="eyebrow">новая позиция</span><h3>Что нужно</h3></div>
            </div>
            <label>Название<input value={newWishTitle} onChange={(event) => setNewWishTitle(event.target.value)} placeholder="Например, адресник" /></label>
            <label>Категория<select value={newWishCategory} onChange={(event) => setNewWishCategory(event.target.value)}>
              <option value="gear">амуниция</option>
              <option value="food">корм</option>
              <option value="treats">лакомства</option>
              <option value="toy">игрушка</option>
              <option value="health">здоровье</option>
              <option value="grooming">груминг</option>
              <option value="service">сервис</option>
              <option value="other">другое</option>
            </select></label>
            <label>Зачем <span className="field-optional">необязательно</span><input value={newWishReason} onChange={(event) => setNewWishReason(event.target.value)} placeholder="Например, старый адресник потерялся" /></label>
            <button className="primary full" onClick={() => createWishlistItem()} disabled={!newWishTitle.trim()}>{newWishTitle.trim() ? 'Добавить в вещи' : 'Напиши название'}</button>
          </PaperSheet>}

          {wantedWishlist.length === 0 && boughtWishlist.length === 0 && <article className="empty-state"><b>Список пока пуст</b><p>Здесь можно держать покупки и услуги для {profile.dogName}.</p></article>}

          {wantedWishlist.length > 0 && <section className="things-masonry" aria-label="Вещи собаки">
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

          {removedWishlistItem && <div className="restore-notice" role="status">
            <span>Вещь убрана</span>
            <button type="button" onClick={restoreWishlistItem}>Вернуть</button>
          </div>}

        </WatercolorScreen>}

        {error && <p className="error-text" role="alert">{error}</p>}
        {notice !== 'idle' && <div className="toast" role="status" aria-live="polite">{notice === 'loaded' ? 'Данные загружены' : notice === 'mapSaved' ? 'Сохранено на карте' : notice === 'copied' ? 'Скопировано' : notice === 'sharing' ? 'Открываю отправку' : notice === 'downloaded' ? 'Карточка сохранена' : notice === 'applied' ? 'Действие выполнено' : 'Профиль сохранён'}</div>}
      </section>

      {hasDog && <AppNavigation active={activePrimaryRoute} onAskAssistant={openAssistantSheet} onNavigate={(route) => {
        setJourneyDetail(null);
        setAssistantOpen(false);
        setTab(route);
      }} />}

      <DesktopContextPanel
        mode={journeyDetail || tab}
        dogName={petName || 'собаки'}
        nearestTitle={nextBestAction.title}
        nearestCaption={nextBestAction.caption}
        nearestAction={nextBestAction.action}
        activeCount={activeReminders.length}
        completedCount={doneReminders.length}
        cardReady={publicCardReady}
        onNearestAction={() => nextBestAction.reminderId
          ? completeReminder(nextBestAction.reminderId)
          : nextBestAction.target === 'today'
            ? document.querySelector<HTMLInputElement>('.today-quick-add input')?.focus()
            : setTab(nextBestAction.target)}
        onOpenPlan={() => { setCareView('active'); setTab('calendar'); }}
        onOpenHistory={() => { setCareView('history'); setTab('calendar'); }}
        onOpenCard={() => setTab('card')}
      />
      <CareActionNotice
        feedback={careFeedback}
        onUndo={undoLastCareCompletion}
        onDismiss={() => setCareFeedback(null)}
      />
      <DeleteCareDialog
        reminder={pendingCareDeletion}
        busy={careDeletionBusy}
        onCancel={() => setPendingCareDeletion(null)}
        onConfirm={confirmCareDeletion}
      />
      <RouteDeleteDialog
        route={pendingRouteDeletion}
        busy={Boolean(routeMutationBusy)}
        onCancel={() => setPendingRouteDeletion(null)}
        onConfirm={deleteOwnerRoute}
      />
      <CoreOnboarding
        open={dogCreationOpen}
        dogName={heroNameDraft}
        lifeStage={profile.lifeStage}
        sex={profile.sex}
        breedValue={profile.breedId === 'custom' ? profile.breedCustom : selectedBreed.id === 'mixed' ? '' : selectedBreed.title}
        lifeStageOptions={lifeStageOptions}
        sexOptions={sexOptions}
        breedOptions={breedCatalog}
        busy={onboardingSaving}
        onNameChange={(value) => { setHeroNameDraft(value); dogCreationKeyRef.current = null; setError(''); }}
        onLifeStageChange={(value) => updateProfile({ lifeStage: value })}
        onSexChange={(value) => updateProfile({ sex: value })}
        onBreedChange={(value) => {
          const normalizedValue = value.trim().toLocaleLowerCase('ru');
          const breed = breedCatalog.find((item) => item.title.toLocaleLowerCase('ru') === normalizedValue);
          updateProfile(breed
            ? { breedId: breed.id, breedGroupId: breed.groupId, breedCustom: '' }
            : { breedId: value.trim() ? 'custom' : 'mixed', breedGroupId: 'mixed', breedCustom: value });
        }}
        onDismiss={() => { if (!onboardingSaving) setDogCreationOpen(false); }}
        onSubmit={saveMinimalDog}
      />

    </main>
  );
}
