'use client';

import { isPrimaryObservationFact } from '@/lib/observationLabels';
import {isAgentWalk,type AgentWalk} from '@/lib/agentWalk';
import {isMapSearchPlace,type MapSearchPlace} from '@/lib/mapSearchPlace';
import {downloadRouteGpx,type RoutePlanning} from '@/lib/routePlanning';

import { ChangeEvent, type FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Buildings, CalendarBlank, CalendarDots, CaretDown, CheckCircle, CopySimple, FilePdf, Files, LinkSimple, MapPin, MapTrifold, PaperPlaneTilt, PawPrint, Plus, ShieldWarning, TextT, UploadSimple } from '@phosphor-icons/react';
import { GeneratedAvatar } from '@/components/GeneratedAvatar';
import { WatercolorScreen } from '@/components/watercolor';
import { normalizeWishlistReceipt, type WishlistView } from '@/lib/wishlistView';
import { AppNavigation, type PrimaryRoute } from '@/components/app/AppNavigation';
import { journalDayEntries } from '@/lib/journal';
import { ConnectedHome, ConnectedTools } from '@/components/app/ConnectedHome';
import { ProductionAssistantSheet, ProductionDocumentSheet, ProductionJourney, type JourneyProfileEntry } from '@/components/journey/ProductionJourney';
import { AgentPanel } from '@/components/journey/AgentPanel';
import type { ReviewedObservation } from '@/lib/agentObservation';
import { VoiceObservationCapture, type PrivateVoiceNoteInput } from '@/components/journey/VoiceObservationCapture';
import { ProductionMapWorkspace } from '@/components/journey/ProductionMapWorkspace';
import type { ProductionMapMode, RouteDraftMeta } from '@/components/journey/ProductionMapWorkspace';
import { RouteDeleteDialog } from '@/components/journey/RouteDeleteDialog';
import { RecordDetailDialog, type RecordDetail } from '@/components/profile/RecordDetailDialog';
import { ProfileConflictDialog } from '@/components/profile/ProfileConflictDialog';
import { mergeProfileDraft, type ProfileMerge } from '@/lib/profileMerge';
import { DesktopContextPanel } from '@/components/app/DesktopContextPanel';
import { CareActionNotice, type CareFeedback } from '@/components/care/CareActionNotice';
import { DeleteCareDialog, type PendingCareDeletion } from '@/components/care/DeleteCareDialog';
import { type ObservationEditorDraft } from '@/components/care/ObservationEditor';
import { CoreOnboarding } from '@/components/onboarding/CoreOnboarding';
import type { DogModuleSummary } from '@/components/home/AllFunctionsHub';
import { HabitScreen, type HabitDraft, type HabitView } from '@/components/habits/HabitScreen';
import { HealthTimelineScreen } from '@/components/health/HealthTimelineScreen';
import { RecommendationCard } from '@/components/recommendations/RecommendationCard';
import { ProfileMemoryWorkspace, type ProfileSurface } from '@/components/profile/ProfileMemoryWorkspace';
import { ObservationDisclosure } from '@/components/today/ObservationDisclosure';
import { CandidateCard } from '@/components/social/CandidateCard';
import { CityCommunities, type CityCommunity } from '@/components/social/CityCommunities';
import { RequestsPanel, type SocialRequestView } from '@/components/social/RequestsPanel';
import { SocialProfileSheet } from '@/components/social/SocialProfileSheet';
import { ProductionWoofWorkspace, type WoofRecommendationEntry } from '@/components/social/ProductionWoofWorkspace';
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
import { loadGuestEntityState, resetAllLocalPsoData, resetGuestEntityStorage, saveGuestEntityState } from '@/lib/guestEntityStorage';
import { buildAppReadiness, type ReadinessLevel } from '@/lib/readiness';
import { buildTodayCareView } from '@/lib/today';
import { normalizeOwnerRoutes, removeOwnerRoute, upsertOwnerRoute, type OwnerRouteView } from '@/lib/mapUi';
import { rc1Config } from '@/lib/rc1';
import { extractObservationCandidates, ingestionFingerprint, type IngestionDecision, type ObservationCandidate } from '@/lib/observationIngestion';
import type { CandidateGroup, CoarseLocation, SocialProfile, SocialScenario, WalkPace, WalkSignal } from '@/lib/socialCore';
import type { ActionSuggestion } from '@/packages/contracts';
import type { Recommendation, RecommendationAction, RecommendationLifecycleCommand } from '@/packages/recommendations/contracts';
import { loadMainRecommendation, RecommendationRequestError, transitionRecommendation } from '@/lib/recommendations/client';

type AvatarState = 'idle' | 'rendering' | 'ready';
type Notice = 'documentSaved' | 'idle' | 'saved' | 'mapSaved' | 'copied' | 'loaded' | 'sharing' | 'downloaded' | 'applied';
type ReminderRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
type ReminderTimeMode = 'exact' | 'flexible' | 'approximate';
type ReminderView = { id: string; petId: string; type: string; title: string; dueAt: string; recurrence?: ReminderRecurrence; status: string; snoozedUntil?: string; completedAt?: string; nextDueAt?: string };
type ReminderHistoryItem = { id: string; eventType?: string; payload?: { dueAt?: string; completedAt?: string; nextDueAt?: string | null }; createdAt: string };
type ZoneView = { id: string; pet_id?: string; petId?: string; type: string; title: string; note?: string; approximate_lat?: number | string | null; approximate_lng?: number | string | null; radius_meters?: number; radiusMeters?: number; visibility?: 'private' | 'shared' | 'public'; share_token?: string | null; created_at?: string };
type PetSwitchOption = { id: string; name: string; breed_id?: string; breed_group_id?: string; avatar_url?: string; avatar_source?: 'none' | 'uploaded' | 'generated'; active_avatar_asset_id?: string | null; photo_urls?: string[] };
type AuthSession = { access_token: string; user: { email?: string } };
type ObservationView = { id: string; type?: string; value?: string; petId?: string; mood?: string; appetite?: string; stool?: string; energy?: string; note?: string; createdAt: string; syncStatus?: 'local' | 'saved' };
type ObservationDraft = { mood: string; appetite: string; stool: string; energy: string; note?: string };
type DocumentView = { id: string; petId: string; kind: string; title: string; clinic?: string | null; documentDate?: string | null; originalName: string; mimeType: string; sizeBytes: number; createdAt: string };
type SocialInviteView = { token: string; scenario: SocialScenario; petName: string | null; expiresAt: string };
type Tab = 'today' | 'all' | 'diary' | 'calendar' | 'habits' | 'health' | 'nearby' | 'map' | 'card' | 'profile' | 'things';
type DrawMode = 'none' | 'point' | 'route';
type MapSaveMode = 'private' | 'shared';
type ViralCardFormat = 'story' | 'square' | 'poster';
type ViralCardMood = 'soft' | 'bold' | 'safety' | 'club';
type ViralFactKey = 'social' | 'energy' | 'care' | 'triggers' | 'area' | 'breed';
type PublicCardFieldKey = 'breed' | 'character' | 'triggers' | 'area';
type PublicCardCheck = { label: string; done: boolean; missing: string; optional?: boolean };
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
const publicCardFieldOrder = ['name', 'breed', 'character', 'bio', 'social', 'triggers', 'area', 'image'] as const;

function publicCardFingerprint(fields: Record<string, unknown> | null | undefined) {
  return publicCardFieldOrder.map((key) => `${key}:${String(fields?.[key] ?? '')}`).join('\u001f');
}
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

type AssistantActionStatus = { state: 'idle' | 'loading' | 'success' | 'error'; message?: string; plannedFor?: string };

function assistantActionKey(action: ActionSuggestion, index: number) {
  return `${action.intent}:${action.humanLabel}:${index}`;
}

function AssistantActionButtons({ actions, statuses, onApply, onOpen }: {
  actions: ActionSuggestion[];
  statuses: Record<string, AssistantActionStatus>;
  onApply: (action: ActionSuggestion, key: string) => void;
  onOpen: (action: ActionSuggestion, target?: 'primary' | 'calendar') => void;
}) {
  if (!actions.length) return null;
  return (
    <div className="assistant-action-buttons" aria-label="Предложенные действия ассистента">
      {actions.map((action, index) => {
        const key = assistantActionKey(action, index);
        const status = statuses[key] || { state: 'idle' as const };
        if (status.state === 'success') return <div className="assistant-action-result" key={key} role="status">
          <span>{status.message || 'Действие сохранено'}</span>
          <div className="assistant-action-links">
            <button type="button" onClick={() => onOpen(action)}>{action.intent === 'add_wishlist' ? 'Открыть вещи' : 'Открыть'}</button>
            {action.intent === 'add_wishlist' && status.plannedFor && <button type="button" onClick={() => onOpen(action, 'calendar')}>Открыть план</button>}
          </div>
        </div>;
        if (status.state === 'error') return <div key={key} role="alert"><span>{status.message || 'Не удалось выполнить действие.'}</span><button type="button" onClick={() => onApply(action, key)}>Повторить</button></div>;
        return <button key={key} type="button" disabled={status.state === 'loading'} aria-busy={status.state === 'loading'} onClick={() => onApply(action, key)}>
          {status.state === 'loading' ? `${action.humanLabel}…` : action.humanLabel}
        </button>;
      })}
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

function dateAfterDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
}

function wishlistReminderTitle(title: string) {
  return /^(купить|заказать|забрать)/i.test(title.trim()) ? title.trim() : `Купить: ${title.trim()}`;
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
    profileVersion: pet.profile_version ?? pet.profileVersion,
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
  const [tab, setTabState] = useState<Tab>('today');
  const [noticeState, setNoticeState] = useState<{ tab: Tab; value: Notice }>({ tab: 'today', value: 'idle' });
  const setNotice = useCallback((value: Notice) => setNoticeState({ tab, value }), [tab]);
  const notice: Notice = noticeState.tab === tab ? noticeState.value : 'idle';
  const [errorState, setErrorState] = useState<{ tab: Tab; message: string }>({ tab: 'today', message: '' });
  const setError = useCallback((message: string) => setErrorState({ tab, message }), [tab]);
  const [storageError, setStorageError] = useState('');
  const error = (errorState.tab === tab ? errorState.message : '') || storageError;
  const [healthFactsDraft, setHealthFactsDraft] = useState<DogProfile | null>(null);
  const [recordDetail, setRecordDetail] = useState<RecordDetail | null>(null);
  const [profileSurface, setProfileSurface] = useState<ProfileSurface>('overview');
  type FlowOrigin = { from: Tab; to: Tab; detail: Tab | null; shellScroll: number; windowScroll: number; focusText: string };
  const secondaryOrigins = useRef<FlowOrigin[]>([]);
  const pendingViewRestore = useRef<FlowOrigin | null>(null);
  const [journeyDetail, setJourneyDetail] = useState<Tab | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [reminders, setReminders] = useState<ReminderView[]>([]);
  const [wishlist, setWishlist] = useState<WishlistView[]>([]);
  const [zones, setZones] = useState<ZoneView[]>([]);
  type WishlistOperation = { petId: string; scope: string; token: string };
  const wishlistOperation = useRef<WishlistOperation | null>(null);
  const [wishlistWriting, setWishlistWriting] = useState<WishlistOperation | null>(null);
  const [wishlistIssue, setWishlistIssue] = useState<{petId: string; scope: string; message: string} | null>(null);
  const [removedWishlistItem, setRemovedWishlistItem] = useState<WishlistView | null>(null);
  const [removedZone, setRemovedZone] = useState<ZoneView | null>(null);
  const [editingWishlistId, setEditingWishlistId] = useState<string | null>(null);
  const wishlistEditDrafts = useRef(new Map<string,{title:string;reason:string}>());
  const [wishlistTitleDraft, setWishlistTitleDraft] = useState('');
  const [wishlistReasonDraft, setWishlistReasonDraft] = useState('');
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneTitleDraft, setZoneTitleDraft] = useState('');
  const [zoneNoteDraft, setZoneNoteDraft] = useState('');
  const [pets, setPets] = useState<PetSwitchOption[]>([]);
  const [activePetId, setActivePetId] = useState('');
  const [observations, setObservations] = useState<ObservationView[]>([]);
  const [documents, setDocuments] = useState<DocumentView[]>([]);
  const [documentUploadOpen, setDocumentUploadOpen] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentFileName, setDocumentFileName] = useState('');
  const [documentError, setDocumentError] = useState('');
  const documentSaveAttempt = useRef<{ signature: string; key: string } | null>(null);
  const documentActivePet = useRef(profile.backendPetId);
  useEffect(() => { documentActivePet.current = profile.backendPetId; setDocumentError(''); setDocumentFileName(''); documentSaveAttempt.current = null; }, [profile.backendPetId]);
  const [documentBusyId, setDocumentBusyId] = useState<string | null>(null);
  const documentUploadTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [habits, setHabits] = useState<HabitView[]>([]);
  const [habitLoading, setHabitLoading] = useState(false);
  const [habitBusyId, setHabitBusyId] = useState<string | null>(null);
  const [suggestedHabitDraft, setSuggestedHabitDraft] = useState<HabitDraft | null>(null);
  const [dogSummary, setDogSummary] = useState<DogModuleSummary | null>(null);
  const [moduleErrors, setModuleErrors] = useState<{ habits?: string; health?: string }>({});
  const [socialResult, setSocialResult] = useState('');
  const [socialLoadedPet,setSocialLoadedPet] = useState<string|null>(null);
  const [socialProfile, setSocialProfile] = useState<SocialProfile | null>(null);
  const [socialCandidates, setSocialCandidates] = useState<CandidateGroup>({ nearby: [], city: [] });
  const [socialRequests, setSocialRequests] = useState<SocialRequestView[]>([]);
  const [walkSignals, setWalkSignals] = useState<WalkSignal[]>([]);
  const [walkSignalReason, setWalkSignalReason] = useState('');
  const [socialViewerLocation, setSocialViewerLocation] = useState<CoarseLocation | null>(null);
  const [socialViewerRadiusKm, setSocialViewerRadiusKm] = useState(3);
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
  const [observationCaptureOpen, setObservationCaptureOpen] = useState(false);
  const [observationIssue, setObservationIssue] = useState<{scope:string;message:string}|null>(null);
  const [healthFactsError, setHealthFactsError] = useState('');
  const [healthNextCursor, setHealthNextCursor] = useState<string|null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const healthReadVersion = useRef(0);
  const healthLoadedPet = useRef<string|null>(null);
  const observationWrite = useRef<symbol|null>(null);
  const [editingObservationId, setEditingObservationId] = useState<string | null>(null);
  const agentObservationEdits = useRef(new Map<string,ReviewedObservation>());
  const observationEditDrafts = useRef(new Map<string, ObservationEditorDraft>());
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
  const calendarAutoSelectedPetRef = useRef<string | null>(null);
  const [careView, setCareView] = useState<'active' | 'history'>('active');
  const [mapVisited, setMapVisited] = useState(false);
  const [agentSavedRouteSelection,setAgentSavedRouteSelection]=useState<{token:string;petId:string;route:OwnerRouteView}|null>(null);
  const agentMapRead=useRef<AbortController|null>(null);
  useEffect(()=>()=>{agentMapRead.current?.abort();},[profile.backendPetId,assistantOpen]);
  const [agentWalkSelection,setAgentWalkSelection]=useState<{token:string;petId:string;walk:AgentWalk}|null>(null);
  const [agentMapSelection,setAgentMapSelection]=useState<{token:string;petId:string;place:MapSearchPlace;places:MapSearchPlace[]}|null>(null);
  const [mapActivity, setMapActivity] = useState<'recording'|'paused'|null>(null);
  useEffect(() => {if (tab === 'map') setMapVisited(true);}, [tab]);
  const [routeEditSeed,setRouteEditSeed] = useState<{token:number;points:number[][];planning?:RoutePlanning;review?:boolean;pathGaps?:number[];routeSource?:'recorded'|'planned';durationSeconds?:number;startedAt?:string}|null>(null);
  const [editingRouteGeometryId,setEditingRouteGeometryId] = useState<string|null>(null);
  const [mapSavedRevision, setMapSavedRevision] = useState(0);
  const mapSaveLockRef = useRef(false);
  const mapAttemptRef = useRef<{fingerprint:string;key:string}|null>(null);
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
  const [newWishCategory, setNewWishCategory] = useState('other');
  const [newWishNeedsReminder, setNewWishNeedsReminder] = useState(false);
  const [newWishPlannedFor, setNewWishPlannedFor] = useState(() => dateAfterDays(1));
  const [thingCaptureOpen, setThingCaptureOpen] = useState(false);
  const [mainRecommendation, setMainRecommendation] = useState<Recommendation | null>(null);
  const [woofRecommendationEntry, setWoofRecommendationEntry] = useState<WoofRecommendationEntry | null>(null);
  const [recommendationState, setRecommendationState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [recommendationBusyAction, setRecommendationBusyAction] = useState<'primary' | 'snooze' | 'dismiss' | null>(null);
  const [viralCardFormat, setViralCardFormat] = useState<ViralCardFormat>('story');
  const [viralCardMood, setViralCardMood] = useState<ViralCardMood>('bold');
  const [viralCardHeadline, setViralCardHeadline] = useState('');
  const [viralSelectedFacts, setViralSelectedFacts] = useState<ViralFactKey[]>(['social', 'energy', 'care', 'triggers']);
  const [publicCardVisibleFields, setPublicCardVisibleFields] = useState<PublicCardFieldKey[]>(defaultPublicCardFields);
  const [publishedPublicCardPath, setPublishedPublicCardPath] = useState('');
  const [publishedPublicCardFingerprint, setPublishedPublicCardFingerprint] = useState('');
  const [publicCardLinkBusy, setPublicCardLinkBusy] = useState(false);
  const [publicCardRevokeConfirm, setPublicCardRevokeConfirm] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantError,setAssistantError]=useState('');
  const [assistantReturnFocus,setAssistantReturnFocus]=useState<HTMLElement|null>(null);
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [assistantActions, setAssistantActions] = useState<ActionSuggestion[]>([]);
  const [assistantActionStatuses, setAssistantActionStatuses] = useState<Record<string, AssistantActionStatus>>({});
  const [assistantSuggestedQuestions, setAssistantSuggestedQuestions] = useState<string[]>([]);
  const [assistantThreadId, setAssistantThreadId] = useState('');
  const [agentRunId,setAgentRunId]=useState('');
  const agentDelivered=useRef('');
  const agentRequestEpoch=useRef(0);
  const agentRequest=useRef<{pet:string;question:string;id:string}|null>(null);
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
  const [localDeleteConfirmation, setLocalDeleteConfirmation] = useState('');
  const [telegramSession, setTelegramSession] = useState<TelegramSessionView>({ mode: 'loading' });
  const assistantActionBusyRef = useRef(new Set<string>());

  useEffect(() => {
    setAssistantThreadId('');
    agentRequestEpoch.current+=1;
    setAgentRunId('');
    agentDelivered.current='';
    agentRequest.current=null;
    setAssistantLoading(false);
    setAssistantMessages([]);
    setAssistantAnswer('');
    setAssistantActions([]);
    setAssistantActionStatuses({});
    setAssistantSuggestedQuestions([]);
    setAssistantDiagnostic({});
  }, [profile.backendPetId,session?.access_token,telegramSession.ownerId]);
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
  const socialMutationRef = useRef(false);
  const reportAttemptRef = useRef<{signature:string;key:string}|null>(null);
  const socialLoadSequenceRef = useRef(0);
  const socialPollSequenceRef = useRef(0);
  const currentSocialPetRef = useRef(profile.backendPetId);
  useLayoutEffect(()=>{currentSocialPetRef.current = profile.backendPetId;},[profile.backendPetId]);
  const signalAttemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const careMutationKeysRef = useRef(new Map<string, string>());
  const careMutationTimesRef = useRef(new Map<string, string>());

  async function loadPublicDogCard(petId: string) {
    if (!petId || isGuestMode()) {
      setPublishedPublicCardPath('');
      setPublishedPublicCardFingerprint('');
      return;
    }
    const response = await fetch(`/api/dog-cards?petId=${encodeURIComponent(petId)}`, {
      credentials: 'include',
      headers: authHeaders(),
    });
    if (!response.ok) {
      setPublishedPublicCardPath('');
      setPublishedPublicCardFingerprint('');
      return;
    }
    const payload = await response.json().catch(() => ({}));
    setPublishedPublicCardPath(typeof payload.path === 'string' ? payload.path : '');
    setPublishedPublicCardFingerprint(publicCardFingerprint(payload.card?.fields));
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
    if (['calendar', 'habits', 'health', 'card', 'diary', 'things'].includes(nextTab)) {
      secondaryOrigins.current.push({ from: tab, to: nextTab, detail: journeyDetail, shellScroll: phoneShellRef.current?.scrollTop ?? 0, windowScroll: window.scrollY, focusText: document.activeElement instanceof HTMLButtonElement ? document.activeElement.textContent?.trim() ?? '' : '' });
    } else secondaryOrigins.current = [];
    setTabState(nextTab);
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = nextTab;
      window.history.pushState({ tab: nextTab }, '', nextUrl);
    }
  }

  function closeSecondaryFlow(parent: 'today' | 'profile' | 'all') {
    const origin = secondaryOrigins.current.at(-1);
    const valid = origin?.to === tab ? secondaryOrigins.current.pop() : undefined;
    const target = valid?.from ?? parent;
    pendingViewRestore.current = valid ?? null;
    setTabState(target);
    setJourneyDetail(valid?.detail ?? null);
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = target;
    window.history.replaceState({ tab: target, detail: valid?.detail }, '', nextUrl);
  }

  function openPrivateRecord(kind: 'observation' | 'reminder', id: string, trigger: HTMLButtonElement) {
            if (kind === 'observation') {
              const item = observations.find(entry => entry.id === id);
              if (!item) return;
              setRecordDetail({ id, trigger, title: `Запись о ${petNameGent}`, date: item.createdAt, text: item.note || item.value || '',
                facts: [item.mood && `Состояние: ${item.mood}`, item.appetite && `Аппетит: ${item.appetite}`, item.stool && `Пищеварение: ${item.stool}`, item.energy && `Энергия: ${item.energy}`].filter((value): value is string => Boolean(value)) });
            } else {
              const item = reminders.find(entry => entry.id === id);
              if (!item) return;
              setRecordDetail({ id, trigger, title: item.title, date: item.completedAt || item.dueAt, text: item.completedAt || item.status === 'done' || item.status === 'completed' ? 'Дело выполнено' : 'Запланировано',
                facts: item.nextDueAt ? [`Следующий срок: ${new Date(item.nextDueAt).toLocaleString('ru-RU')}`] : [] });
            }
          }

  function openAssistantSheet(event?:{currentTarget:EventTarget|null}) {
    setAssistantReturnFocus(event?.currentTarget instanceof HTMLElement?event.currentTarget:document.activeElement as HTMLElement|null);
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
    const knownTabs: Tab[] = ['today', 'all', 'diary', 'calendar', 'habits', 'health', 'nearby', 'map', 'card', 'profile', 'things'];
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
    const origin = pendingViewRestore.current;
    pendingViewRestore.current = null;
    if (!origin) { resetViewScroll(); return; }
    window.requestAnimationFrame(() => {
      phoneShellRef.current?.scrollTo({ top: origin.shellScroll, behavior: 'auto' });
      window.scrollTo({ top: origin.windowScroll, behavior: 'auto' });
      if (origin.focusText) [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === origin.focusText)?.focus({ preventScroll: true });
    });
  }, [tab, journeyDetail]);

  useEffect(() => {
    if (notice === 'idle') return;
    const timer = window.setTimeout(() => setNotice('idle'), 1600);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

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
      // Show existing data immediately; location permission follows an explicit area choice.
      await loadSocialSurface(controller.signal, socialViewerLocation);
    };
    bootstrap().catch((lookupError) => {
      if (controller.signal.aborted) return;
      if (lookupError instanceof DOMException && lookupError.name === 'AbortError') return;
      setSocialLoadedPet(profile.backendPetId!);
      setSocialProfile(null); setWalkSignals([]); setSocialRequests([]);
      setSocialCandidates({ nearby: [], city: [] });
      setNearbyReason('NEARBY_LOOKUP_FAILED');
      setNearbyState('error');
    });
    return () => { controller.abort(); };
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

  const refreshRecommendation = useCallback(async (signal?: AbortSignal) => {
    const petId = profile.backendPetId;
    if (!petId || (!session?.access_token && !telegramSession.ownerId)) {
      setMainRecommendation(null);
      setRecommendationState('idle');
      return;
    }
    setRecommendationState('loading');
    try {
      const headers: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      let recommendation = await loadMainRecommendation({ petId, headers, signal });
      if (recommendation?.status === 'eligible') {
        recommendation = await transitionRecommendation({
          recommendationId: recommendation.id,
          command: { action: 'show' },
          headers,
          signal,
        });
      }
      if (signal?.aborted) return;
      setMainRecommendation(recommendation);
      setRecommendationState('ready');
    } catch (recommendationError) {
      if (signal?.aborted) return;
      if (recommendationError instanceof RecommendationRequestError
        && ['RECOMMENDATIONS_DISABLED', 'AUTH_REQUIRED', 'PET_NOT_FOUND'].includes(recommendationError.code)) {
        setMainRecommendation(null);
        setRecommendationState('idle');
        return;
      }
      setRecommendationState('error');
    }
  }, [profile.backendPetId, session?.access_token, telegramSession.ownerId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void refreshRecommendation(controller.signal); }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [refreshRecommendation]);

  async function updateRecommendation(
    command: RecommendationLifecycleCommand,
    busyAction: 'primary' | 'snooze' | 'dismiss',
  ) {
    if (!mainRecommendation || recommendationBusyAction) return null;
    setRecommendationBusyAction(busyAction);
    setError('');
    try {
      const updated = await transitionRecommendation({
        recommendationId: mainRecommendation.id,
        command,
        headers: authHeaders(),
      });
      setMainRecommendation(['dismissed', 'snoozed'].includes(updated.status) ? null : updated);
      setRecommendationState('ready');
      return updated;
    } catch {
      setError('Не удалось обновить совет. Проверь соединение и попробуй снова.');
      return null;
    } finally {
      setRecommendationBusyAction(null);
    }
  }

  function openRecommendationAction(action: RecommendationAction) {
    if (action.intent === 'open_gav') {
      setWoofRecommendationEntry({
        key: crypto.randomUUID(),
        view: action.view,
        targetId: action.view === 'live_signal' ? action.signalId : action.view === 'requests' ? action.requestId : undefined,
      });
      setTabState('nearby');
      setJourneyDetail('nearby');
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = 'nearby';
      window.history.pushState({ tab: 'nearby', detail: 'nearby' }, '', nextUrl);
      return;
    }
    if (action.intent === 'open_reminder') {
      setCareView('active');
      setTab('calendar');
      return;
    }
    if (action.intent === 'open_health') {
      setTab('health');
      return;
    }
    if (action.intent === 'open_habits') {
      setSuggestedHabitDraft(action.draft ?? null);
      setTab('habits');
      return;
    }
    if (action.intent === 'plan_walk') {
      setProductionMapMode('route');
      setTab('map');
      return;
    }
    setNewWishTitle(action.draft.title);
    setNewWishCategory(action.draft.category);
    setNewWishReason(action.draft.reason);
    setThingCaptureOpen(true);
    setTab('things');
  }

  async function acceptMainRecommendation() {
    if (!mainRecommendation || recommendationBusyAction) return;
    const recommendation = mainRecommendation.status === 'accepted'
      ? mainRecommendation
      : await updateRecommendation({ action: 'accept' }, 'primary');
    if (recommendation) openRecommendationAction(recommendation.primaryAction);
  }

  function acceptedRecommendationId(intent: RecommendationAction['intent'], domainId?: string) {
    if (mainRecommendation?.status !== 'accepted' || mainRecommendation.primaryAction.intent !== intent) return undefined;
    if (intent === 'open_reminder' && mainRecommendation.primaryAction.intent === 'open_reminder'
      && mainRecommendation.primaryAction.reminderId !== domainId) return undefined;
    return mainRecommendation.id;
  }

  function acceptedGavRecommendationId(view: 'live_signal' | 'requests' | 'give_signal', targetId?: string) {
    const action = mainRecommendation?.primaryAction;
    if (mainRecommendation?.status !== 'accepted' || action?.intent !== 'open_gav' || action.view !== view) return undefined;
    if (view === 'live_signal' && action.view === 'live_signal' && action.signalId !== targetId) return undefined;
    if (view === 'requests' && action.view === 'requests' && action.requestId !== targetId) return undefined;
    return mainRecommendation.id;
  }

  function finishRecommendationOutcome(recommendationId?: string) {
    if (recommendationId && mainRecommendation?.id === recommendationId) {
      setMainRecommendation(null);
      setRecommendationState('ready');
    }
  }

  async function loadSocialSurface(signal?: AbortSignal, viewerLocationOverride?: CoarseLocation | null, radiusKmOverride?: number) {
    const petId = profile.backendPetId;
    if (!petId || (!session?.access_token && !telegramSession.ownerId)) {
      setNearbyState('idle');
      setNearbyReason('AUTH_OR_PET_REQUIRED');
      return;
    }
    const sequence = ++socialLoadSequenceRef.current;
    ++socialPollSequenceRef.current;
    setNearbyState('loading');
    setNearbyReason('');
    setWalkSignalReason('');
    const requestOptions = { headers: authHeaders(), credentials: 'include' as const, signal };
    const viewerLocation = viewerLocationOverride === undefined ? socialViewerLocation : viewerLocationOverride;
    const radiusKm = radiusKmOverride ?? socialViewerRadiusKm;
    const signalParams = new URLSearchParams({ petId });
    signalParams.set('radiusKm', String(radiusKm));
    if (viewerLocation) {
      signalParams.set('lat', String(viewerLocation.lat));
      signalParams.set('lng', String(viewerLocation.lng));
    }
    const [profileResponse, candidatesResponse, requestsResponse, signalsResponse] = await Promise.all([
      fetch(`/api/social/profile?petId=${encodeURIComponent(petId)}`, requestOptions),
      fetch(`/api/social/candidates?petId=${encodeURIComponent(petId)}`, requestOptions),
      fetch(`/api/social/requests?petId=${encodeURIComponent(petId)}&history=1`, requestOptions),
      fetch(`/api/social/signals?${signalParams.toString()}`, requestOptions),
    ]);
    const [profilePayload, candidatesPayload, requestsPayload, signalsPayload] = await Promise.all([
      profileResponse.json().catch(() => ({})),
      candidatesResponse.json().catch(() => ({})),
      requestsResponse.json().catch(() => ({})),
      signalsResponse.json().catch(() => ({})),
    ]);
    if (signal?.aborted || sequence !== socialLoadSequenceRef.current || petId !== currentSocialPetRef.current) return;
    setSocialLoadedPet(petId);
    if (!profileResponse.ok || !requestsResponse.ok) throw new Error('SOCIAL_SURFACE_FAILED');
    setSocialProfile(profilePayload.profile ?? null);
    setSocialRequests(Array.isArray(requestsPayload.requests) ? requestsPayload.requests : []);
    setMissingTelegramUsernameAction(requestsPayload.missingTelegramUsernameAction ?? null);
    if (signalsResponse.ok) {
      setWalkSignals(Array.isArray(signalsPayload.signals) ? signalsPayload.signals : []);
      if (signalsPayload.viewer?.approximateLocation) setSocialViewerLocation(signalsPayload.viewer.approximateLocation);
      if (Number.isFinite(Number(signalsPayload.viewer?.radiusMeters))) {
        const radiusMeters = Number(signalsPayload.viewer.radiusMeters);
        setSocialViewerRadiusMeters(radiusMeters);
        setSocialViewerRadiusKm(radiusMeters / 1000);
      }
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

  async function refreshLiveSocial(signal?: AbortSignal, radiusKmOverride?: number) {
    const petId = profile.backendPetId;
    if (!petId) return;
    const sequence = ++socialPollSequenceRef.current;
    const surfaceSequence = socialLoadSequenceRef.current;
    const signalParams = new URLSearchParams({ petId });
    signalParams.set('radiusKm', String(radiusKmOverride ?? socialViewerRadiusKm));
    if (socialViewerLocation) {
      signalParams.set('lat', String(socialViewerLocation.lat));
      signalParams.set('lng', String(socialViewerLocation.lng));
    }
    const requestOptions = { headers: authHeaders(), credentials: 'include' as const, signal };
    const [signalsResponse, requestsResponse] = await Promise.all([
      fetch(`/api/social/signals?${signalParams.toString()}`, requestOptions),
      fetch(`/api/social/requests?petId=${encodeURIComponent(petId)}&history=1`, requestOptions),
    ]);
    const [signalsPayload, requestsPayload] = await Promise.all([
      signalsResponse.json().catch(() => ({})),
      requestsResponse.json().catch(() => ({})),
    ]);
    if (signal?.aborted || sequence !== socialPollSequenceRef.current || surfaceSequence !== socialLoadSequenceRef.current || petId !== currentSocialPetRef.current) return;
    if (!signalsResponse.ok || !requestsResponse.ok) { setNearbyState('error'); return; }
    if (signalsResponse.ok) {
      setWalkSignals(Array.isArray(signalsPayload.signals) ? signalsPayload.signals : []);
      setWalkSignalReason('');
      if (signalsPayload.viewer?.approximateLocation) setSocialViewerLocation(signalsPayload.viewer.approximateLocation);
      if (Number.isFinite(Number(signalsPayload.viewer?.radiusMeters))) {
        const radiusMeters = Number(signalsPayload.viewer.radiusMeters);
        setSocialViewerRadiusMeters(radiusMeters);
        setSocialViewerRadiusKm(radiusMeters / 1000);
      }
    }
    if (requestsResponse.ok) {
      setSocialRequests(Array.isArray(requestsPayload.requests) ? requestsPayload.requests : []);
      setMissingTelegramUsernameAction(requestsPayload.missingTelegramUsernameAction ?? null);
    }
  }

  async function saveSocialProfile(draft: Omit<SocialProfile, 'petId'>) {
    if (!profile.backendPetId || socialBusyId || socialMutationRef.current) return false;
    socialMutationRef.current = true;
    const mutationPet = profile.backendPetId;
    setError('');
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
        return false;
      }
      if (mutationPet !== currentSocialPetRef.current) return false;
      await loadSocialSurface().catch(() => setNearbyState('error'));
      return true;
    } catch {
      setError('Не удалось подтвердить сохранение. Ввод остался в форме — попробуй ещё раз.');
      return false;
    } finally {
      socialMutationRef.current = false;
      setSocialBusyId(null);
    }
  }

  async function hideSocialProfile() {
    return runSocialMutation('profile', 'Не получилось скрыть анкету. Попробуй ещё раз.', async () => {
      const response = await fetch(`/api/social/profile?petId=${encodeURIComponent(profile.backendPetId!)}`, {
        method: 'DELETE', credentials: 'include', headers: authHeaders(),
      });
      return response.ok;
    }, 'Анкета скрыта. Сохранённые данные и связи остались.');
  }

  async function runSocialMutation(id: string, failure: string, request: () => Promise<boolean>, success: string) {
    if (!profile.backendPetId || socialBusyId || socialMutationRef.current) return false;
    const mutationPet = profile.backendPetId;
    socialMutationRef.current = true;
    setSocialBusyId(id); setError(''); setSocialResult('');
    try {
      const confirmed = await request();
      if (mutationPet !== currentSocialPetRef.current) return false;
      if (!confirmed) { setError(failure); return false; }
      setSocialResult(success);
      await loadSocialSurface().catch(() => setNearbyState('error'));
      return true;
    } catch {
      if (mutationPet === currentSocialPetRef.current) setError('Ответ не получен. Результат пока не подтверждён — обнови состояние или повтори действие.');
      return false;
    } finally { socialMutationRef.current = false; setSocialBusyId(null); }
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

  function changeWalkSignalRadius(radiusKm: number) {
    setSocialViewerRadiusKm(radiusKm);
    setSocialViewerRadiusMeters(radiusKm * 1000);
    refreshLiveSocial(undefined, radiusKm).catch(() => setNearbyState('error'));
  }

  async function sendSocialRequest(candidatePetId: string, scenario: SocialScenario, signalId?: string) {
    const keyId = `${profile.backendPetId}:${candidatePetId}:${scenario}:${signalId ?? 'profile'}`;
    const idempotencyKey = socialRequestKeysRef.current[keyId] ?? `social-request:${crypto.randomUUID()}`;
    socialRequestKeysRef.current[keyId] = idempotencyKey;
    const recommendationId = signalId ? acceptedGavRecommendationId('live_signal', signalId) : undefined;
    const confirmed = await runSocialMutation(candidatePetId, 'Отклик не отправлен. Обнови список: сигнал или доступность участника могли измениться.', async () => {
      const response = await fetch('/api/social/requests', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey, ...authHeaders() },
        body: JSON.stringify({ senderPetId: profile.backendPetId, recipientPetId: candidatePetId, scenario, signalId, recommendationId, idempotencyKey }),
      });
      return response.ok;
    }, 'Отклик отправлен. Его статус — в «Откликах и связях».');
    if (confirmed) { delete socialRequestKeysRef.current[keyId]; finishRecommendationOutcome(recommendationId); }
    return confirmed;
  }

  async function saveWalkSignal(draft: { startsAt: string; pace: WalkPace; note: string; location: CoarseLocation }) {
    if (!profile.backendPetId || socialBusyId || socialMutationRef.current) return false;
    const mutationPet = profile.backendPetId;
    const fingerprint = JSON.stringify({ petId: mutationPet, ...draft });
    if (signalAttemptRef.current?.fingerprint !== fingerprint) {
      signalAttemptRef.current = { fingerprint, key: `walk-signal:${crypto.randomUUID()}` };
    }
    const idempotencyKey = signalAttemptRef.current.key;
    socialMutationRef.current = true;
    setSocialBusyId('signal');
    setSocialViewerLocation(draft.location);
    setError('');
    const recommendationId = acceptedGavRecommendationId('give_signal');
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
          recommendationId,
        }),
      });
      if (!response.ok) {
        setError('Не получилось дать Гав. Проверь время и попробуй ещё раз.');
        return false;
      }
      if (mutationPet !== currentSocialPetRef.current) return false;
      signalAttemptRef.current = null;
      await loadSocialSurface().catch(() => setNearbyState('error'));
      finishRecommendationOutcome(recommendationId);
      return true;
    } catch {
      setError('Ответ не получен. Черновик сохранён в форме. Повтор проверит тот же запрос и не создаст второй Гав.');
      return false;
    } finally { socialMutationRef.current = false; setSocialBusyId(null); }
  }

  async function closeWalkSignal(status: 'completed' | 'cancelled') {
    return runSocialMutation('signal', 'Не получилось завершить Гав. Попробуй ещё раз.', async () => {
      const response = await fetch('/api/social/signals', {
        method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ petId: profile.backendPetId, status }),
      });
      return response.ok;
    }, status === 'completed' ? 'Гав завершён.' : 'Гав отменён.');
  }

  async function updateSocialRequest(id: string, action: 'accept' | 'reject' | 'cancel' | 'close' | 'block') {
    const recommendationId = action === 'accept' ? acceptedGavRecommendationId('requests', id) : undefined;
    const messages = { accept: 'Отклик принят. Связь доступна ниже.', reject: 'Отклик отклонён.', cancel: 'Запрос отменён.', close: 'Знакомство завершено.', block: 'Пользователь заблокирован.' };
    const confirmed = await runSocialMutation(id, 'Не получилось изменить запрос. Обнови состояние: другая сторона могла уже ответить.', async () => {
      const response = await fetch(`/api/social/requests/${encodeURIComponent(id)}`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action, recommendationId }),
      });
      return response.ok;
    }, messages[action]);
    if (confirmed) finishRecommendationOutcome(recommendationId);
    return confirmed;
  }

  async function reportSocialRequest(id: string, reason: string) {
    if (socialBusyId || socialMutationRef.current) return false;
    const signature=JSON.stringify({petId:profile.backendPetId,id,reason});
    if(reportAttemptRef.current?.signature!==signature)reportAttemptRef.current={signature,key:`social-report:${crypto.randomUUID()}`};
    const idempotencyKey=reportAttemptRef.current.key;
    socialMutationRef.current = true;
    const mutationPet = profile.backendPetId;
    setError('');
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
        return false;
      }
      if (mutationPet !== currentSocialPetRef.current) return false;
      await loadSocialSurface().catch(() => setNearbyState('error'));
      reportAttemptRef.current=null;
      return true;
    } catch {
      setError('Не удалось подтвердить сохранение. Ввод остался в форме — попробуй ещё раз.');
      return false;
    } finally {
      socialMutationRef.current = false;
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
    if (dbProfile?.backendPetId && dbProfile.profileVersion !== undefined) {
      profileBaselines.current.set(`${dbProfile.backendPetId}:${dbProfile.profileVersion}`, dbProfile);
      if (profileBaselines.current.size > 20) profileBaselines.current.delete(profileBaselines.current.keys().next().value!);
    }
    const selectedPetId = String(petId || payload.activePetId || dbProfile?.backendPetId || payload.pet?.id || '');
    const belongsToSelectedPet = (item: any) => {
      const itemPetId = String(item?.petId || item?.pet_id || '');
      return !selectedPetId || !itemPetId || itemPetId === selectedPetId;
    };
    const preserveLocalGuest = payload.mode === 'demo' && Boolean(loadProfile().dogName.trim());
    setDemoMode(payload.mode === 'demo');
    if (!preserveLocalGuest && Array.isArray(payload.pets)) setPets(payload.pets.map((pet: any) => {
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
    if (dbProfile && !preserveLocalGuest) {
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
      // Bootstrap is a profile snapshot, not a replacement for an already paged history.
      if (Array.isArray(payload.observations) && healthLoadedPet.current !== selectedPetId) {
        const bootObservations = payload.observations.filter(belongsToSelectedPet).map(normalizeObservation).filter(Boolean) as ObservationView[];
        setObservations(bootObservations);
      }
      setDocuments(Array.isArray(payload.documents) ? payload.documents.filter(belongsToSelectedPet) : []);
    } else if (!preserveLocalGuest && payload.empty && payload.user?.id) {
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
    const hydratedLocal = local.dogName.trim() && !local.backendPetId
      ? { ...local, backendPetId: `guest-pet-${crypto.randomUUID()}` }
      : local;
    guestPetIdRef.current = hydratedLocal.backendPetId || null;
    setProfile(hydratedLocal);
    if (hydratedLocal.dogName.trim() && hydratedLocal.backendPetId) {
      setPets([{ id: hydratedLocal.backendPetId, name: hydratedLocal.dogName }]);
      setActivePetId(hydratedLocal.backendPetId);
      const guestState = loadGuestEntityState(window.localStorage, hydratedLocal.backendPetId);
      setReminders(guestState.reminders as ReminderView[]);
      setWishlist(guestState.wishlist as WishlistView[]);
      setZones(guestState.zones as ZoneView[]);
      setOwnerRoutes(guestState.routes as OwnerRouteView[]);
    }
    setProfileHydrated(true);
    setHeroNameDraft(hydratedLocal.dogName || '');
    try {
      const savedObservations = JSON.parse(window.localStorage.getItem(observationsStorageKey(hydratedLocal.backendPetId)) || '[]');
      if (Array.isArray(savedObservations)) setObservations(savedObservations.map(normalizeObservation).filter(Boolean) as ObservationView[]);
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
    setStorageError(result.ok ? '' : result.message);
  }, [profile, profileHydrated]);
  useEffect(() => {
    const explicitGuestMode = !session?.access_token && (telegramSession.mode === 'browser' || telegramSession.mode === 'error');
    if (!profileHydrated || !explicitGuestMode || !profile.backendPetId) return;
    try {
      saveGuestEntityState(window.localStorage, profile.backendPetId, {
        reminders,
        wishlist,
        zones,
        routes: ownerRoutes,
      });
    } catch {
      setStorageError('Не удалось сохранить изменения на устройстве. Освободи место в браузере и попробуй снова.');
    }
  }, [ownerRoutes, profile.backendPetId, profileHydrated, reminders, session?.access_token, telegramSession.mode, wishlist, zones]);
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
  const activePrimaryRoute: PrimaryRoute = ['calendar', 'habits', 'health', 'card', 'diary', 'things'].includes(tab) ? 'all' : tab as PrimaryRoute;
  const isJourneyRoute = ['today', 'all', 'diary', 'profile', 'map', 'nearby', 'things'].includes(tab) && journeyDetail !== tab;
  const activeReminders = useMemo(() => reminders.filter((reminder) => reminder.status !== 'done'), [reminders]);
  const doneReminders = useMemo(() => reminders.filter((reminder) => reminder.status === 'done'), [reminders]);
  const wishlistBusy = wishlistWriting?.petId === (profile.backendPetId || activePetId || 'guest');
  const wishlistError = wishlistIssue?.petId === (profile.backendPetId || activePetId || 'guest') ? wishlistIssue : null;
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
      bio: 'Подходите спокойно и сначала спросите владельца.',
      social: displaySocialMode(profile.socialMode) || 'сначала спросить владельца',
      triggers: show('triggers') ? profile.triggers : '',
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
  const currentPublicCardFingerprint = useMemo(() => publicCardFingerprint(publicCardPayload), [publicCardPayload]);
  const publicCardPublished = Boolean(publishedPublicCardPath);
  const publicCardHasChanges = Boolean(publicCardPublished && publishedPublicCardFingerprint && currentPublicCardFingerprint !== publishedPublicCardFingerprint);
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
  useEffect(() => {
    const petKey = profile.backendPetId || 'guest';
    if (tab !== 'calendar' || careView !== 'active' || activeReminders.length === 0 || calendarAutoSelectedPetRef.current === petKey) return;
    const nearestReminder = [...activeReminders].sort((a, b) => new Date(a.snoozedUntil || a.dueAt).getTime() - new Date(b.snoozedUntil || b.dueAt).getTime())[0];
    const nearestDate = reminderDateInputValue(nearestReminder);
    const parsedDate = new Date(`${nearestDate}T10:00:00`);
    calendarAutoSelectedPetRef.current = petKey;
    setSelectedCalendarDate(nearestDate);
    setCalendarCursor(parsedDate);
  }, [activeReminders, careView, profile.backendPetId, tab]);
  const petName = profile.dogName.trim();
  const petNameGent = inflectPetName(profile.dogName, 'gent');
  const petNameDatv = inflectPetName(profile.dogName, 'datv');
  const petNameAccs = inflectPetName(profile.dogName, 'accs');
  const missingProfileSummary = missingProfileFields.slice(0, 3).join(', ');
  const publicCardChecks = useMemo<PublicCardCheck[]>(() => [
    { label: 'Имя', done: Boolean(profile.dogName.trim()), missing: 'имя собаки' },
    { label: 'Правило контакта', done: Boolean(profile.socialMode), missing: 'как знакомиться' },
    { label: 'Особые ограничения', done: Boolean(profile.triggers), missing: 'если они есть', optional: true },
  ], [profile.dogName, profile.socialMode, profile.triggers]);
  const publicCardReadyCount = useMemo(() => publicCardChecks.filter((item) => item.done).length, [publicCardChecks]);
  const publicCardReady = Boolean(profile.dogName.trim() && profile.socialMode);
  const publicCardMissing = useMemo(() => publicCardChecks.filter((item) => !item.done && !item.optional).map((item) => item.missing), [publicCardChecks]);
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
  const contextualAssistantSuggestions = useMemo(() => {
    const suggestions: string[] = [];
    if (tab === 'map' || ownerRoutes.length || zones.length) suggestions.push('Как спланировать спокойную прогулку?');
    if (tab === 'health' || observations.length) suggestions.push(`Что важно по последним наблюдениям ${petNameGent}?`);
    if (documents.some((item) => item.kind === 'analysis')) suggestions.push('Что важно проверить по последнему анализу?');
    if (activeReminders.length) suggestions.push('Что из дел сейчас важнее?');
    else suggestions.push('Какое дело по уходу стоит запланировать?');
    if (tab === 'nearby' || socialCandidates.nearby.length || socialCandidates.city.length) suggestions.push('Что учесть перед знакомством собак?');
    suggestions.push('Что полезно записать сегодня?');
    return [...new Set(suggestions)].slice(0, 3);
  }, [activeReminders.length, documents, observations.length, ownerRoutes.length, petNameGent, socialCandidates.city.length, socialCandidates.nearby.length, tab, zones.length]);
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
    healthReadVersion.current++; healthLoadedPet.current=null; observationWrite.current=null;
    setHealthNextCursor(null); setHealthLoading(false); setObservationIssue(null); setHealthFactsError('');
    setObservationSaving(false); setObservationMutationBusy(false); setObservationCaptureOpen(false);
    wishlistOperation.current = null; wishlistEditDrafts.current.clear(); setWishlistWriting(null); setWishlistIssue(null); setEditingWishlistId(null); setRemovedWishlistItem(null);
    setRecordDetail(null);
    setProfileSurface('overview');
    secondaryOrigins.current = [];
    setHealthFactsDraft(null);
    observationEditDrafts.current.clear();
    agentObservationEdits.current.clear();
    setAgentMapSelection(null);setAgentWalkSelection(null);setAgentSavedRouteSelection(null);
    setJourneyDetail(null);
    setTabState('today');
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href);
      nextUrl.hash = 'today';
      window.history.replaceState({ tab: 'today' }, '', nextUrl);
    }
    setAssistantOpen(false);
    setAssistantQuestion('');setAssistantError('');
    setAssistantAnswer('');
    setAssistantActions([]);
    setAssistantActionStatuses({});
    setAssistantSuggestedQuestions([]);
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
    setNewWishReason(''); setNewWishCategory('other'); setNewWishNeedsReminder(false); setNewWishPlannedFor(dateAfterDays(1));
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
    const metric=(key:string)=> {
      const stored=typeof raw[key]==='string'?raw[key]:typeof metadata[key]==='string'?metadata[key]:type===key?value:'';
      return stored.trim()||undefined;
    };
    return {
      id: id || guestId('observation'),
      petId: raw.petId || raw.pet_id ? String(raw.petId || raw.pet_id) : undefined,
      mood: metric('mood'),
      appetite: metric('appetite'),
      stool: metric('stool'),
      energy: metric('energy'),
      type, value,
      note: note || (type === 'note' ? value : '') || undefined,
      createdAt: Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString(),
      syncStatus: raw.syncStatus === 'saved' ? 'saved' : 'local',
    };
  }

  function updateObservationDraft(patch: Partial<ObservationDraft>) {
    setObservationDraft((current) => ({ ...current, ...patch }));
    if (observationIssue?.scope === 'create') setObservationIssue(null);
  }

  async function loadObservations() { await loadHealthTimeline(); }

  async function loadHealthTimeline(before?: string, signal?: AbortSignal) {
    const petId=profile.backendPetId;
    if (!petId || isGuestMode() || observationWrite.current) return;
    const version=++healthReadVersion.current;
    const current=()=>version===healthReadVersion.current && documentActivePet.current===petId && !signal?.aborted;
    setHealthLoading(true);
    setModuleErrors(value=>({...value,health:undefined}));
    try {
      const params=new URLSearchParams({petId}); if(before)params.set('before',before);
      const response=await fetch(`/api/health?${params}`,{headers:authHeaders(),credentials:'include',signal});
      const payload=await response.json();
      if(!current())return;
      if(!response.ok || !Array.isArray(payload.entries))throw new Error('HEALTH_READ_FAILED');
      const entries=payload.entries.map((entry:unknown)=>observationReceipt(entry,petId)) as ObservationView[];
      setObservations(previous=>{
        // A fresh read starts a new cursor chain; only the actively edited draft stays visible.
        const retained=before?previous:previous.filter(item=>item.id===editingObservationId);
        return [...new Map([...retained,...entries.map(item=>({...item,syncStatus:'saved' as const}))].map(item=>[item.id,item])).values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
      });
      healthLoadedPet.current=petId;
      setHealthNextCursor(payload.hasMore && typeof payload.nextCursor==='string'?payload.nextCursor:null);
    } catch {
      if(current())setModuleErrors(value=>({...value,health:'Не удалось загрузить записи. Уже открытые остались здесь.'}));
    } finally {if(current())setHealthLoading(false);}
  }

  async function loadRealModules(petId = profile.backendPetId, signal?: AbortSignal) {
    if (!petId || isGuestMode()) {
      setHabits([]);
      setDogSummary(null);
      setModuleErrors({});
      return;
    }
    setHabitLoading(true);
    setModuleErrors(value=>({...value,habits:undefined}));
    const request = { headers: authHeaders(), credentials: 'include' as const, signal };
    try {
      const [habitResponse, summaryResponse] = await Promise.all([
        fetch(`/api/habits?petId=${encodeURIComponent(petId)}`, request),
        fetch(`/api/pets/${encodeURIComponent(petId)}/summary`, request),
      ]);
      const [habitPayload, summaryPayload] = await Promise.all([
        habitResponse.json().catch(() => ({})),
        summaryResponse.json().catch(() => ({})),
      ]);
      if(signal?.aborted || documentActivePet.current!==petId)return;
      if (habitResponse.ok) setHabits(Array.isArray(habitPayload.habits) ? habitPayload.habits : []);
      if (summaryResponse.ok && summaryPayload.summary) setDogSummary(summaryPayload.summary);
      setModuleErrors(value=>({...value,habits:habitResponse.ok?undefined:'Проверь соединение и попробуй снова.'}));
      if (!summaryResponse.ok) setDogSummary(null);
    } catch (loadError) {
      if (!signal?.aborted && documentActivePet.current===petId && !(loadError instanceof DOMException && loadError.name === 'AbortError')) {
        setModuleErrors(value=>({...value,habits:'Проверь соединение и попробуй снова.'}));
      }
    } finally {
      if (!signal?.aborted) setHabitLoading(false);
    }
  }

  useEffect(() => {
    if (!profile.backendPetId || isGuestMode()) return;
    const controller = new AbortController();
    void loadRealModules(profile.backendPetId, controller.signal);
    void loadHealthTimeline(undefined, controller.signal);
    return () => controller.abort();
  }, [profile.backendPetId, session?.access_token, telegramSession.ownerId]);

  async function createHabit(draft: HabitDraft) {
    if (!profile.backendPetId || isGuestMode() || habitBusyId) return false;
    setHabitBusyId('create');
    setError('');
    try {
      const recommendationId = mainRecommendation?.status === 'accepted'
        && mainRecommendation.primaryAction.intent === 'open_habits'
        && mainRecommendation.primaryAction.draft
        && JSON.stringify(mainRecommendation.primaryAction.draft) === JSON.stringify(draft)
        ? mainRecommendation.id
        : undefined;
      const response = await fetch('/api/habits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ petId: profile.backendPetId, ...draft, recommendationId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.habit) {
        setError('Привычка не сохранилась. Проверь данные и попробуй снова.');
        return false;
      }
      await loadRealModules(profile.backendPetId);
      setSuggestedHabitDraft(null);
      finishRecommendationOutcome(recommendationId);
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
      const recommendationId = acceptedRecommendationId('open_habits');
      const response = await fetch(`/api/habits/${encodeURIComponent(habitId)}/checkins`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify({ recommendationId }),
      });
      if (!response.ok) {
        setError('Не получилось отметить привычку. Попробуй снова.');
        return;
      }
      finishCareMutation(scope);
      finishRecommendationOutcome(recommendationId);
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

  function observationReceipt(value: unknown, petId: string, expectedId?: string): ObservationView {
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_OBSERVATION_RECEIPT');
    const raw=value as Record<string,unknown>;
    const id=raw?.id, ownerPet=raw?.petId??raw?.pet_id, date=raw?.observedAt??raw?.observed_at??raw?.createdAt??raw?.created_at;
    if(typeof id!=='string'||!id||ownerPet!==petId||(expectedId&&id!==expectedId)||typeof date!=='string'||!Number.isFinite(Date.parse(date))||raw.source==='demo'||raw.deleted_at)throw new Error('INVALID_OBSERVATION_RECEIPT');
    const saved=normalizeObservation(raw); if(!saved)throw new Error('INVALID_OBSERVATION_RECEIPT');
    return {...saved,syncStatus:'saved'};
  }

  async function writeObservation<T>(scope:string, task:(current:()=>boolean)=>Promise<T>):Promise<T|null> {
    if(observationWrite.current)return null;
    const token=Symbol(scope), petId=profile.backendPetId;
    observationWrite.current=token;
    const current=()=>observationWrite.current===token && documentActivePet.current===petId;
    // Ignore an older in-flight read; the mutation receipt is newer than that snapshot.
    healthReadVersion.current++; setHealthLoading(false);
    setObservationIssue(null);
    if(scope==='create')setObservationSaving(true);else setObservationMutationBusy(true);
    try{return await task(current);}
    catch{if(current())setObservationIssue({scope,message:'Не удалось подтвердить изменение. Ввод остался здесь — повторите попытку.'});return null;}
    finally{if(current()){observationWrite.current=null;setObservationSaving(false);setObservationMutationBusy(false);}}
  }

  async function submitObservation():Promise<ObservationView|null> {
    const note=observationDraft.note?.trim();
    if(!observationDraft.mood&&!observationDraft.appetite&&!observationDraft.stool&&!observationDraft.energy&&!note)return null;
    const guest=isGuestMode(),petId=profile.backendPetId||(guest?ensureGuestPetId():undefined);
    if(!petId){setObservationIssue({scope:'create',message:'Сначала выберите собаку. Текст остался здесь.'});return null;}
    const scope=`observation:create:${JSON.stringify({petId,...observationDraft,note})}`;
    const createdAt=careMutationTime(scope,()=>new Date().toISOString());
    return writeObservation('create',async current=>{
      let saved:ObservationView={id:guestId('observation'),petId,...observationDraft,note:note||undefined,createdAt,syncStatus:'local'};
      if(!guest){
        const response=await fetch('/api/observations',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':careMutationKey(scope),...authHeaders()},body:JSON.stringify({petId,...observationDraft,note:note||null,observedAt:createdAt,source:'manual',...(note&&!observationDraft.mood&&!observationDraft.appetite&&!observationDraft.stool&&!observationDraft.energy?{type:'note',value:note}:{})})});
        const payload=await response.json();
        if(!current())return null;
        if(!response.ok||payload.mode==='demo')throw new Error('SAVE_FAILED');
        saved=observationReceipt(payload.observation,petId);
      }
      if(!current())return null;
      setObservations(previous=>[saved,...previous.filter(item=>item.id!==saved.id)]);
      setObservationDraft(defaultObservationDraft);finishCareMutation(scope);
      return saved;
    });
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
    setObservations((current) => [{ ...saved, syncStatus: 'saved' as const }, ...current.filter((item) => item.id !== saved.id)]);
    finishCareMutation(scope);
    await loadRealModules(profile.backendPetId);
    return { decisions: Array.isArray(payload.decisions) ? payload.decisions as IngestionDecision[] : [], summary: payload.summary || {} };
  }

  async function saveVoicePrivateNote(input: PrivateVoiceNoteInput) {
    const text = input.text.trim();
    const petId = input.petId || profile.backendPetId || activePetId;
    if (!text || !petId) throw new Error('PRIVATE_NOTE_REQUIRED');
    const createdAt = input.capturedAt || new Date().toISOString();
    if (isGuestMode()) {
      const draft: ObservationView = {
        id: guestId('observation'), petId, note: text, createdAt, syncStatus: 'local',
      };
      setObservations((current) => [draft, ...current]);
      return;
    }
    const scope = `observation:voice-note:${petId}:${createdAt}:${text}`;
    const response = await fetch('/api/observations', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
      body: JSON.stringify({
        petId, type: 'note', value: text, note: text, observedAt: createdAt, source: 'assistant',
        metadata: { voiceCapture: { inputSource: input.source, originalTextPreserved: true } },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(payload.error || 'PRIVATE_NOTE_SAVE_FAILED'));
    const saved = normalizeObservation(payload.observation || payload);
    if (!saved) throw new Error('PRIVATE_NOTE_SAVE_FAILED');
    setObservations((current) => [{ ...saved, syncStatus: 'saved' as const }, ...current.filter((item) => item.id !== saved.id)]);
    finishCareMutation(scope);
  }

  function startObservationEdit(observation: ObservationView) {
    setEditingObservationId(observation.id);
    setObservationEditDraft(observationEditDrafts.current.get(observation.id) ?? {
      mood: observation.mood || '',
      appetite: observation.appetite || '',
      stool: observation.stool || '',
      energy: observation.energy || '',
      note: observation.note || '',
      ...(isPrimaryObservationFact(observation.type)?{type:observation.type,value:observation.value}:{}),
    });
    setError('');
  }

  async function editObservation(id: string) {
    const scope=`observation:update:${id}:${JSON.stringify(observationEditDraft)}`;
    const original=observations.find(item=>item.id===id),petId=profile.backendPetId;
    if(!original)return;
    await writeObservation(id,async current=>{
      let saved:ObservationView={...original,...observationEditDraft};
      if(!isGuestMode()){
        const response=await fetch(`/api/observations/${id}`,{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':careMutationKey(scope),...authHeaders()},body:JSON.stringify(observationEditDraft)});
        const payload=await response.json();if(!current())return;
        if(!response.ok||!petId)throw new Error('SAVE_FAILED');
        saved=observationReceipt(payload.observation,petId,id);
      }
      if(!current())return;
      setObservations(previous=>previous.map(item=>item.id===id?saved:item));
      finishCareMutation(scope);observationEditDrafts.current.delete(id);setEditingObservationId(null);
    });
  }

  async function deleteObservation(id: string) {
    const observation=observations.find(item=>item.id===id);
    if(!observation)return;
    const scope=`observation:delete:${id}`;
    await writeObservation(id,async current=>{
      if(!isGuestMode()){
        const response=await fetch(`/api/observations/${id}`,{method:'DELETE',credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':careMutationKey(scope),...authHeaders()},body:'{}'});
        if(!current())return;
        const receipt=await response.json();
        if(!current())return;
        if(!response.ok||receipt.ok!==true||!Number.isFinite(Date.parse(receipt.deletedAt)))throw new Error('DELETE_FAILED');
      }
      if(!current())return;
      setObservations(previous=>previous.filter(item=>item.id!==id));setRecentlyDeletedObservation(observation);
      setEditingObservationId(previous=>previous===id?null:previous);
      setCareFeedback({kind:'observation-deleted',observationId:id,title:'запись'});finishCareMutation(scope);
    });
  }

  async function uploadPetDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.backendPetId || documentUploading) return;
    const petId = profile.backendPetId;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set('petId', petId);
    const file = form.get('file');
    if (!(file instanceof File) || !file.size) { setDocumentError('Выберите PDF или фото.'); return; }
    setDocumentUploading(true);
    setDocumentError('');
    try {
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
      const signature = JSON.stringify({ fields: [...form.entries()].filter(([key]) => key !== 'file'), name: file.name, type: file.type, hash });
      if (documentSaveAttempt.current?.signature !== signature) documentSaveAttempt.current = { signature, key: `document:${crypto.randomUUID()}` };
      const response = await fetch('/api/documents', { method: 'POST', headers: { ...authHeaders(), 'Idempotency-Key': documentSaveAttempt.current.key }, body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'UPLOAD_FAILED');
      if (documentActivePet.current !== petId) return;
      setDocuments(current => [payload.document, ...current.filter(item => item.id !== payload.document.id)]);
      documentSaveAttempt.current = null;
      setDocumentUploadOpen(false);
      setDocumentFileName('');
      formElement.reset();
      setNotice('documentSaved');
      window.setTimeout(() => setNotice('idle'), 1400);
    } catch (error) {
      if (documentActivePet.current !== petId) return;
      const code = error instanceof Error ? error.message : '';
      setDocumentError(code === 'FILE_TOO_LARGE' ? 'Файл больше 4 МБ. Выберите файл поменьше.'
        : code === 'FILE_TYPE_NOT_ALLOWED' ? 'Подойдёт PDF или изображение JPEG, PNG, WebP.'
        : code === 'DOCUMENT_REMOVED' ? 'Этот документ уже удалён. Выберите файл заново, если хотите добавить его снова.'
        : 'Не удалось подтвердить сохранение. Ввод и файл остались здесь — повторите попытку.');
    } finally { setDocumentUploading(false); }
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
      setError('Удаление документа не завершено. Повторите попытку; повтор не затронет другие файлы.');
    } finally {
      setDocumentBusyId(null);
    }
  }

  async function restoreObservation() {
    const observation=recentlyDeletedObservation,petId=profile.backendPetId;
    if(!observation)return;
    const scope=`observation:restore:${observation.id}`;
    await writeObservation('restore',async current=>{
      let saved=observation;
      if(!isGuestMode()){
        const response=await fetch(`/api/observations/${observation.id}/restore`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Idempotency-Key':careMutationKey(scope),...authHeaders()},body:'{}'});
        const payload=await response.json();if(!current())return;
        if(!response.ok||!petId)throw new Error('RESTORE_FAILED');
        saved=observationReceipt(payload.observation,petId,observation.id);
      }
      if(!current())return;
      setObservations(previous=>[saved,...previous.filter(item=>item.id!==saved.id)]);
      setRecentlyDeletedObservation(null);setCareFeedback(null);finishCareMutation(scope);
    });
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

  const profileBaselines = useRef(new Map<string, Partial<DogProfile>>());
  const [profileConflict, setProfileConflict] = useState<ProfileMerge | null>(null);
  const profileConflictResolver = useRef<((profile: DogProfile | null) => void) | null>(null);
  const profileSaveAttempt = useRef<{ body: string; key: string } | null>(null);

  async function savePrivateProfile(nextProfile?: DogProfile, reportError: (message:string)=>void = setError) {
    let profileToSave = nextProfile || profile;
    if (!profileToSave.dogName.trim()) { reportError('Сначала добавь имя собаки.'); return null; }
    if (profileSaving) return null;
    setProfileSaving(true);
    reportError('');
    if (isGuestMode()) {
      ensureGuestPetId();
      setProfile(profileToSave);
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1600);
      setProfileSaving(false);
      return profileToSave.backendPetId || guestPetIdRef.current;
    }
    try {
      for (;;) {
        const requestBody = JSON.stringify({ profile: { ...profileToSave, isPublic: false } });
        if (profileSaveAttempt.current?.body !== requestBody) profileSaveAttempt.current = { body: requestBody, key: `profile:${crypto.randomUUID()}` };
        const idempotencyKey = profileToSave.backendPetId ? profileSaveAttempt.current.key : (addDogKeyRef.current ?? `add-pet:${crypto.randomUUID()}`);
        if (!profileToSave.backendPetId) addDogKeyRef.current = idempotencyKey;
        const response = await fetch('/api/v1/pets', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
            ...authHeaders(),
          },
          body: requestBody,
        });
        const result = await response.json();
        if (response.status === 409 && result?.error === 'PROFILE_VERSION_CONFLICT') {
          const latest = await fetch(`/api/app/bootstrap?petId=${encodeURIComponent(profileToSave.backendPetId!)}`, { credentials: 'include', headers: authHeaders() });
          if (!latest.ok) throw new Error('PROFILE_VERSION_CONFLICT');
          const remote = dbToProfile(await latest.json(), profileToSave.backendPetId);
          if (!remote || remote.profileVersion === undefined) throw new Error('PROFILE_VERSION_CONFLICT');
          const base = profileBaselines.current.get(`${profileToSave.backendPetId}:${profileToSave.profileVersion}`);
          const merge = mergeProfileDraft(base, profileToSave, { ...profileToSave, ...remote });
          // Even disjoint changes are reviewed before re-submitting a full profile.
          const resolved = await new Promise<DogProfile | null>(resolve => {
            profileConflictResolver.current = resolve;
            setProfileConflict(merge);
          });
          if (!resolved) return null;
          profileToSave = resolved;
          continue;
        }
        if (!response.ok) throw new Error(result?.error || 'Не удалось сохранить профиль');
        profileSaveAttempt.current = null;
        const savedPetId = result.pet?.id || profileToSave.backendPetId;
        addDogKeyRef.current = null;
        setProfile({ ...profileToSave, backendPetId: savedPetId, profileVersion: result.pet?.profileVersion, isPublic: false });
        if (savedPetId) setActivePetId(savedPetId);
        await loadBootstrap(undefined, savedPetId);
        setNotice('saved');
        window.setTimeout(() => setNotice('idle'), 1600);
        return savedPetId || null;
      }
    } catch (error) {
      reportError(error instanceof Error && error.message === 'PROFILE_VERSION_CONFLICT'
        ? 'Профиль изменён на другом устройстве. Ваш ввод сохранён на экране; перед повтором нужно сверить актуальные данные.'
        : 'Не удалось сохранить личный профиль. Изменения остались на экране — попробуй ещё раз.');
      return null;
    } finally {
      setProfileSaving(false);
    }
  }
  async function signOut() {
    healthReadVersion.current++; healthLoadedPet.current=null; observationWrite.current=null; setObservationIssue(null); setHealthFactsError('');setObservationSaving(false);setObservationMutationBusy(false);setObservationCaptureOpen(false);setHealthNextCursor(null);
    wishlistOperation.current = null; setWishlistWriting(null); setWishlistIssue(null);
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

  async function performWishlistChange(scope: string, task: (isCurrent: () => boolean) => Promise<boolean>) {
    const petId = profile.backendPetId || activePetId || 'guest';
    if (wishlistOperation.current?.petId === petId) return false;
    const operation = {petId, scope, token: crypto.randomUUID()};
    const originalPet = profile.backendPetId;
    wishlistOperation.current = operation; setWishlistWriting(operation); setWishlistIssue(null);
    const isCurrent = () => wishlistOperation.current?.token === operation.token && documentActivePet.current === originalPet;
    try { return await task(isCurrent); }
    catch { if (isCurrent()) setWishlistIssue({petId,scope,message:'Не удалось подтвердить изменение. Ввод сохранён — проверь связь и повтори.'}); return false; }
    finally { if (wishlistOperation.current?.token === operation.token) { wishlistOperation.current = null; setWishlistWriting(null); } }
  }

  function reportWishlistError(message: string) {
    const operation = wishlistOperation.current;
    if (operation) setWishlistIssue({petId:operation.petId,scope:operation.scope,message});
  }

  async function createWishlistItem(preset?: { title: string; category?: string; reason?: string; priority?: string; plannedFor?: string; source?: 'assistant' | 'manual' }) {
    return performWishlistChange(preset ? 'assistant:create' : 'create', async isCurrent => {
    const title = (preset?.title || newWishTitle).trim();
    if (!title) { reportWishlistError('Добавь название позиции.'); return false; }
    setWishlistIssue(null);
    const plannedFor = preset ? preset.plannedFor : (newWishNeedsReminder ? newWishPlannedFor : undefined);
    const dueAt = plannedFor ? reminderDueAt(plannedFor, '12:00', 'flexible') : undefined;
    if (!profile.backendPetId) {
      if (!isGuestMode()) { reportWishlistError('Сначала сохрани профиль собаки.'); return false; }
      ensureGuestPetId();
    }
    if (isGuestMode()) {
      const petId = ensureGuestPetId();
      const reminderId = plannedFor ? guestId('reminder') : undefined;
      const wishlistItem: WishlistView = { id: guestId('wish'), petId, title, category: preset?.category || (preset ? 'other' : newWishCategory), reason: preset ? preset.reason : newWishReason || undefined, priority: preset?.priority || 'medium', status: 'wanted', plannedFor, reminderId, createdAt: new Date().toISOString() };
      setWishlist((current) => [wishlistItem, ...current]);
      if (plannedFor && reminderId && dueAt) {
        setReminders((current) => [{ id: reminderId, petId, type: wishlistItem.category === 'food' ? 'food' : 'custom', title: wishlistReminderTitle(title), dueAt, recurrence: 'none', status: 'active' }, ...current]);
      }
      if (!preset) {
      setNewWishTitle('');
      setNewWishReason('');
      setNewWishNeedsReminder(false);
      setNewWishPlannedFor(dateAfterDays(1));
      setThingCaptureOpen(false);
      }
      return true;
    }
    try {
      const category = preset?.category || (preset ? 'other' : newWishCategory);
      const reason = preset ? preset.reason || null : newWishReason || null;
      const recommendationId = mainRecommendation?.status === 'accepted'
        && mainRecommendation.primaryAction.intent === 'add_wishlist'
        && mainRecommendation.primaryAction.draft.title === title
        && mainRecommendation.primaryAction.draft.category === category
        && mainRecommendation.primaryAction.draft.reason === reason
        ? mainRecommendation.id
        : undefined;
      const scope = `wishlist:create:${JSON.stringify([profile.backendPetId,title,category,reason,preset?.priority || 'medium',plannedFor,dueAt])}`;
      const response = await fetch('/api/wishlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify({ petId: profile.backendPetId, title, category, reason, priority: preset?.priority || 'medium', plannedFor, dueAt, recommendationId, source: preset?.source || 'manual' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!isCurrent()) return false;
      if (!response.ok) { reportWishlistError('Не удалось подтвердить покупку. Ввод сохранён — повтори попытку.'); return false; }
      if (payload.mode === 'demo') throw new Error('PERSISTENCE_UNAVAILABLE');
      const saved = normalizeWishlistReceipt(payload.item, profile.backendPetId!);
      if (!saved) throw new Error('INVALID_WISHLIST_RECEIPT');
      setWishlist(current => [saved, ...current.filter(item => item.id !== saved.id)]);
      if (payload.reminder?.id && payload.reminder?.petId === profile.backendPetId) setReminders(current => [payload.reminder, ...current.filter(item => item.id !== payload.reminder.id)]);
      if (!preset) { setNewWishTitle(''); setNewWishCategory('other'); setNewWishReason(''); setNewWishNeedsReminder(false); setNewWishPlannedFor(dateAfterDays(1)); setThingCaptureOpen(false); }
      finishCareMutation(scope);
      finishRecommendationOutcome(recommendationId);
      return true;
    } catch {
      if (!isCurrent()) return false;
      reportWishlistError('Не удалось подтвердить покупку. Ввод сохранён — повтори попытку.');
      return false;
    }
    });
  }

  function openWishlistPlan(item: WishlistView) {
    if (!item.plannedFor) return;
    const date = new Date(`${item.plannedFor}T12:00:00`);
    calendarAutoSelectedPetRef.current = profile.backendPetId || 'guest';
    setSelectedCalendarDate(item.plannedFor);
    setNewReminderDueDate(item.plannedFor);
    setCalendarCursor(date);
    setCareView('active');
    setJourneyDetail(null);
    setTab('calendar');
  }

  async function completeWishlistItem(item: WishlistView) {
    if (!item.reminderId) return updateWishlistItem(item.id, { status: 'bought' });
    return performWishlistChange(item.id, isCurrent => completeReminder(item.reminderId!, reportWishlistError, isCurrent));
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

  function planSavedRoute(route:OwnerRouteView,edit:boolean,review=false) {
    if(routePoints.length || mapRouteMeta?.planning?.stops.length || mapActivity) {setError('Сначала сохраните или удалите текущий черновик маршрута.');return;}
    setEditingRouteGeometryId(edit||review?route.id:null);
    setNewZoneTitle(edit||review?route.title:`${route.title} · новая прогулка`);
    setNewZoneNote(route.description||'');setMapSaveMode('private');
    setRouteEditSeed({token:Date.now(),points:route.path.coordinates.map(p=>[...p]),planning:route.planning,review,pathGaps:route.pathGaps,routeSource:route.routeSource,durationSeconds:route.durationSeconds,startedAt:route.startedAt});
    setProductionMapMode('route');
  }
  async function createMapFeature(visibility: 'private' | 'shared') {
    if(drawMode==='route'&&mapRouteMeta?.ready===false)return setError('Сначала примените актуальный расчёт пути или выберите ручное построение.');
    if (drawMode === 'route' && routePoints.length < 2) return setError('Для маршрута нужны хотя бы две точки.');
    if (drawMode !== 'route' && !pickedZonePoint) return setError('Сначала коснись карты, чтобы выбрать точку.');
    const title = (newZoneTitle || (drawMode === 'route' ? 'Маршрут прогулки' : newZoneType === 'risk_zone' ? 'Опасное место' : 'Место на карте')).trim();

    if (isGuestMode()) {
      if (visibility === 'shared') return setError('Чтобы открыть ссылку, запусти Псё внутри Telegram. Личную запись можно сохранить уже сейчас.');
      if (drawMode === 'route') {
        setOwnerRoutes((current) => upsertOwnerRoute(current, {
          id: editingRouteGeometryId || guestId('route'),
          petId: ensureGuestPetId(),
          type: 'route',
          title,
          description: newZoneNote.trim() || undefined,
          path: { type: 'LineString', coordinates: routePoints },
          visibility: 'private',
          routeSource: mapRouteMeta?.routeSource || 'planned',
          planning:mapRouteMeta?.planning,
          startedAt: mapRouteMeta?.startedAt,
          durationSeconds: mapRouteMeta?.durationSeconds,
          pathGaps: mapRouteMeta?.pathGaps,
          distanceMeters: mapRouteMeta?.distanceMeters,
        }));
        setEditingRouteGeometryId(null);setRouteEditSeed(null);
        mapAttemptRef.current=null;
        setMapSavedRevision(value => value+1);
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

    const recommendationId = drawMode === 'route' ? acceptedRecommendationId('plan_walk') : undefined;
    const body = drawMode === 'route'
      ? { type: 'route', title, petId: profile.backendPetId, path: routePoints, visibility, description: newZoneNote || null, routeSource: mapRouteMeta?.routeSource || 'planned', planning:mapRouteMeta?.planning, pathGaps: mapRouteMeta?.pathGaps, startedAt: mapRouteMeta?.startedAt, durationSeconds: mapRouteMeta?.durationSeconds ?? 0, distanceMeters: mapRouteMeta?.distanceMeters ?? 0, recommendationId }
      : { type: 'point', title, petId: profile.backendPetId, lat: pickedZonePoint?.lat, lng: pickedZonePoint?.lng, zone_type: newZoneType, visibility, description: newZoneNote || null };

    const fingerprint=JSON.stringify(body);
    if(mapAttemptRef.current?.fingerprint!==fingerprint)mapAttemptRef.current={fingerprint,key:crypto.randomUUID()};
    const response = await fetch(editingRouteGeometryId?`/api/map/features/${encodeURIComponent(editingRouteGeometryId)}`:'/api/map/features', {
      method: editingRouteGeometryId?'PATCH':'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key':mapAttemptRef.current.key, ...authHeaders() },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError('Не удалось сохранить место на карте');

    if (drawMode === 'route') {
      const createdRoute = normalizeOwnerRoutes([result.feature])[0];
      if (createdRoute) setOwnerRoutes((current) => upsertOwnerRoute(current, createdRoute));
      finishRecommendationOutcome(recommendationId);
    }
    setEditingRouteGeometryId(null);setRouteEditSeed(null);mapAttemptRef.current=null;
    setMapSavedRevision(value => value+1);
    setNotice(visibility === 'shared' ? 'sharing' : 'mapSaved');
    setPickedZonePoint(null);
    setRoutePoints([]);
    setDrawMode('none');
    setNewZoneTitle('');
    setNewZoneNote('');
    setMapSaveMode('private');
    setMapRouteMeta(null);
    if (visibility === 'shared' && result.shareUrl) {
      const copied=await navigator.clipboard?.writeText(result.shareUrl).then(()=>true).catch(()=>false);
      if(copied)setNotice('copied');else setError('Маршрут сохранён, но скопировать ссылку не получилось. Повторите «Поделиться» в сохранённых маршрутах.');
    }
    await loadBootstrap();
  }

  function setProductionMapMode(mode: ProductionMapMode) {
    setError('');
    if (mode !== 'view') setNotice('idle');
    setPickedZonePoint(null);
    // Folding a route must not reset its privacy choice or metadata.
    if (mode === 'route') {
      setDrawMode('route');
      setNewZoneType('walk_route');
      return;
    }
    if (mode === 'risk') {
      setMapSaveMode('private');
      setDrawMode('point');
      setNewZoneType('risk_zone');
      return;
    }
    setDrawMode('none');
  }

  async function saveProductionMapDraft() {
    if (mapDraftSaving || mapSaveLockRef.current) return;
    mapSaveLockRef.current = true;
    setMapDraftSaving(true);
    setError('');
    try {
      if (drawMode === 'route' || mapSaveMode === 'shared') await createMapFeature(mapSaveMode);
      else await createZone();
    } catch {
      setError('Не удалось подтвердить сохранение. Черновик остался на месте.');
    } finally {
      mapSaveLockRef.current = false;
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
      if (isGuestMode()) {
        const nextRoute = { ...currentRoute, ...patch };
        setOwnerRoutes((routes) => upsertOwnerRoute(routes, nextRoute));
        setEditingRouteId(null);
        return { feature: nextRoute, shareUrl: null };
      }
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
    if (isGuestMode()) {
      setError('Ссылку можно открыть после входа через Telegram. Личный маршрут уже сохранён на устройстве.');
      return;
    }
    const result = await updateOwnerRoute(route.id, { visibility: 'shared' });
    if (result?.shareUrl) {
      const copied=await navigator.clipboard?.writeText(result.shareUrl).then(()=>true).catch(()=>false);
      if(!copied){setError('Ссылка создана, но не скопирована. Разрешите доступ к буферу и повторите.');return;}
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
      if (isGuestMode()) {
        setOwnerRoutes((routes) => removeOwnerRoute(routes, route.id));
        setPendingRouteDeletion(null);
        return;
      }
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
      setEditingZoneId(null);
      return true;
    }
    try {
      const response = await fetch(`/api/zones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(patch),
      });
      await response.json().catch(() => ({}));
      if (!response.ok) {
        setError('Не удалось обновить место. Изменения остались в форме.');
        return false;
      }
      await loadBootstrap();
      setEditingZoneId(null);
      return true;
    } catch {
      setError('Не удалось обновить место. Проверь соединение и попробуй снова.');
      return false;
    }
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

  function beginWishlistEdit(item: WishlistView) {
    const draft = wishlistEditDrafts.current.get(item.id);
    setEditingWishlistId(item.id); setWishlistTitleDraft(draft?.title ?? item.title); setWishlistReasonDraft(draft?.reason ?? item.reason ?? '');
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.wishlist-edit-form input')?.focus());
  }

  async function updateWishlistItem(id: string, patch: Partial<WishlistView>) {
    return performWishlistChange(id, async isCurrent => {
    if (isGuestMode()) {
      setWishlist((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
      wishlistEditDrafts.current.delete(id); setEditingWishlistId(null);
      return true;
    }
    try {
      const response = await fetch(`/api/wishlist/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(patch),
      });
      const payload = await response.json().catch(() => ({}));
      if (!isCurrent()) return false;
      if (!response.ok) {
        reportWishlistError('Не удалось подтвердить изменение вещи. Ввод сохранён — повтори попытку.');
        return false;
      }
      const saved = normalizeWishlistReceipt(payload.item, profile.backendPetId!, id);
      if (!saved) throw new Error('INVALID_WISHLIST_RECEIPT');
      setWishlist(current => current.map(item => item.id === id ? saved : item));
      wishlistEditDrafts.current.delete(id); setEditingWishlistId(null);
      return true;
    } catch {
      if (!isCurrent()) return false;
      reportWishlistError('Не удалось подтвердить изменение вещи. Ввод сохранён — повтори попытку.');
      return false;
    }
    });
  }

  async function deleteWishlistItem(id: string) {
    return performWishlistChange(id, async isCurrent => {
    const item = wishlist.find((entry) => entry.id === id);
    if (isGuestMode()) {
      setWishlist((current) => current.filter((entry) => entry.id !== id));
      if (item?.reminderId) {
        setReminders((current) => current.filter((reminder) => reminder.id !== item.reminderId));
      }
      if (item) setRemovedWishlistItem({ ...item, plannedFor: undefined, reminderId: undefined });
      return true;
    }
    const response = await fetch(`/api/wishlist/${id}`, { method: 'DELETE', headers: authHeaders() });
    await response.json().catch(() => ({}));
      if (!isCurrent()) return false;
    if (!response.ok) { reportWishlistError('Не удалось убрать вещь. Попробуй ещё раз.'); return false; }
    if (item) setRemovedWishlistItem({...item, plannedFor:undefined, reminderId:undefined});
    setWishlist(current => current.filter(entry => entry.id !== id));
    if (item?.reminderId) setReminders(current => current.filter(entry => entry.id !== item.reminderId));
    return true;
    });
  }

  async function restoreWishlistItem() {
    return performWishlistChange('restore', async isCurrent => {
    if (!removedWishlistItem) return false;
    if (isGuestMode()) {
      setWishlist((current) => [removedWishlistItem, ...current.filter((item) => item.id !== removedWishlistItem.id)]);
      setRemovedWishlistItem(null);
      return true;
    }
    const response = await fetch(`/api/wishlist/${removedWishlistItem.id}/restore`, { method: 'POST', headers: authHeaders() });
    const payload = await response.json().catch(() => ({}));
      if (!isCurrent()) return false;
    if (!response.ok) { reportWishlistError('Не удалось вернуть вещь. Попробуй ещё раз.'); return false; }
    const saved = normalizeWishlistReceipt(payload.item, profile.backendPetId!, removedWishlistItem.id);
    if (!saved) throw new Error('INVALID_WISHLIST_RECEIPT');
    setWishlist(current => [saved, ...current.filter(item => item.id !== saved.id)]);
    setRemovedWishlistItem(null);
    return true;
    });
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

  async function completeReminder(id: string, issue: (message: string) => void = setError, stillCurrent?: () => boolean) {
    const petId = profile.backendPetId;
    const isCurrent = stillCurrent || (() => documentActivePet.current === petId);
    const reminder = reminders.find((item) => item.id === id);
    if (!reminder) {
      issue('Не удалось найти дело в плане.');
      return false;
    }
    if (isGuestMode()) {
      setReminders((current) => current.map((item) => item.id === id ? { ...item, status: 'done', completedAt: new Date().toISOString() } : item));
      setWishlist((current) => current.map((item) => item.reminderId === id ? { ...item, status: 'bought' } : item));
      setCareFeedback({ kind: 'completed', reminderId: id, title: reminder.title });
      return true;
    }
    const scope = `reminder:complete:${id}`;
    const completedAt = careMutationTime(scope, () => new Date().toISOString());
    const recommendationId = acceptedRecommendationId('open_reminder', id);
    setReminderMutationBusy(scope);
    try {
      const response = await fetch(`/api/reminders/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': careMutationKey(scope), ...authHeaders() },
        body: JSON.stringify({ completedAt, recommendationId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!isCurrent()) return false;
      if (!response.ok) {
        issue('Не удалось подтвердить выполнение. Повтори — уже выполненное дело не запишется второй раз.');
        return false;
      }
      const row = payload.reminder;
      if (!row || row.id !== id || (row.petId ?? row.pet_id) !== reminder.petId || typeof (row.dueAt ?? row.due_at) !== 'string' || !Number.isFinite(new Date(row.dueAt ?? row.due_at).getTime()) || !['active','done'].includes(row.status)) throw new Error('INVALID_REMINDER_RECEIPT');
      const updated: ReminderView = { ...reminder, title:typeof row.title==='string'?row.title:reminder.title, status:row.status, dueAt:row.dueAt??row.due_at,
        recurrence:row.recurrence??reminder.recurrence, completedAt:row.completedAt??row.completed_at??undefined, snoozedUntil:row.snoozedUntil??row.snoozed_until??undefined, nextDueAt:row.nextDueAt??row.next_due_at??undefined };
      setReminders(current => current.map(item => item.id === id ? updated : item));
      if (updated.status === 'done') setWishlist(current => current.map(item => item.reminderId === id && item.status === 'wanted' ? {...item,status:'bought'} : item));
      if (payload.historyOccurrence) {
        setReminderHistory((current) => ({
          ...current,
          [id]: [{ id: `${id}-${completedAt}`, payload: payload.historyOccurrence, createdAt: completedAt }, ...(current[id] ?? [])],
        }));
      }
      finishCareMutation(scope);
      finishRecommendationOutcome(recommendationId);
      setCareFeedback({ kind: 'completed', reminderId: id, title: reminder.title });
      return true;
    } catch {
      if (!isCurrent()) return false;
      issue('Не удалось подтвердить выполнение. Повтори — уже выполненное дело не запишется второй раз.');
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
    const requestEpoch=agentRequestEpoch.current;
    const question = (preset || assistantQuestion).trim();
    if(assistantLoading) return;
    if (!question) return setAssistantError('Напиши вопрос ассистенту.');
    if (!profile.backendPetId) {
      if (!isGuestMode()) return setAssistantError('Сначала сохрани профиль собаки — ассистенту нужен контекст.');
      ensureGuestPetId();
    }
    if(agentRequest.current?.question!==question||agentRequest.current?.pet!==profile.backendPetId) agentRequest.current={pet:profile.backendPetId||'guest',question,id:crypto.randomUUID()};
    setAssistantQuestion(question);
    setAssistantLoading(true); setAssistantActions([]); setAssistantActionStatuses({}); setAssistantError('');
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
        requestId:agentRequest.current.id,
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
      if(requestEpoch!==agentRequestEpoch.current) return;
      setAssistantLoading(false);
      setAssistantMessages((current) => current.slice(0, -1));
      setAssistantError('Псё не ответил. Проверь связь и попробуй ещё раз.');
      return;
    }
    const result = await response.json().catch(() => ({}));
    if(requestEpoch!==agentRequestEpoch.current) return;
    if(response.status===202&&typeof result.runId==='string') {
      agentRequest.current=null;
      setAgentRunId(result.runId);
      setAssistantThreadId(result.threadId);
      setAssistantQuestion('');setAssistantError('');
      return;
    }
    setAssistantLoading(false);
    if (!response.ok) {
      setAssistantMessages((current) => current.slice(0, -1));
      return setAssistantError('Псё не ответил. Проверь связь и попробуй ещё раз.');
    }
    if(result.mode==='agent'&&typeof result.runId==='string') {
      agentDelivered.current=result.runId;
      setAgentRunId(result.runId);
      agentRequest.current=null;
    }
    setAssistantQuestion('');setAssistantError('');
    setAssistantAnswer(result.answer || 'Не получилось составить ответ. Уточни вопрос.');
    setAssistantMessages((current) => [...current, { role: 'assistant', content: result.answer || 'Не получилось составить ответ. Уточни вопрос.' }]);
    setAssistantActions(Array.isArray(result.actionSuggestions) ? result.actionSuggestions : []);
    setAssistantSuggestedQuestions(Array.isArray(result.suggestedQuestions) ? result.suggestedQuestions.filter((item: unknown): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, 3) : []);
    setAssistantThreadId(typeof result.threadId === 'string' ? result.threadId : assistantThreadId);
    setAssistantDiagnostic({ provider: result.provider, mode: result.mode });
  }

  function navigateFromAssistant(destination: ActionSuggestion['destination'], prepare?: () => void) {
    prepare?.();
    setAssistantOpen(false);
    setJourneyDetail(null);
    const nextTab: Tab = destination.screen;
    setTabState(nextTab);
    const nextUrl = new URL(window.location.href);
    nextUrl.hash = nextTab;
    window.history.replaceState({ tab: nextTab }, '', nextUrl);
  }

  function openAssistantAction(action: ActionSuggestion, target: 'primary' | 'calendar' = 'primary') {
    if (target === 'calendar' && action.intent === 'add_wishlist' && action.payload.dueDate) {
      const date = new Date(`${action.payload.dueDate}T12:00:00`);
      navigateFromAssistant({ screen: 'calendar', mode: 'create' }, () => {
        calendarAutoSelectedPetRef.current = profile.backendPetId || 'guest';
        setCareView('active');
        setSelectedCalendarDate(action.payload.dueDate || dateInputValue(date));
        setCalendarCursor(date);
      });
      return;
    }
    navigateFromAssistant(action.destination, () => {
      if (action.destination.screen === 'calendar') setCareView('active');
      if (action.destination.screen === 'things') setThingCaptureOpen(false);
      if (action.destination.screen === 'map') setProductionMapMode('view');
    });
    if (action.destination.screen === 'things') setJourneyDetail('things');
  }

  async function handleApplyAction(action: ActionSuggestion, key: string) {
    if (assistantActionBusyRef.current.has(key)) return;
    if (action.intent === 'plan_walk') {
      navigateFromAssistant(action.destination, () => {
        setProductionMapMode('route');
        setNewZoneTitle(action.payload.title?.trim() || '');
        setNewZoneNote(action.payload.note?.trim() || '');
      });
      return;
    }
    if (action.intent === 'open_health') {
      navigateFromAssistant(action.destination);
      return;
    }
    if (action.intent === 'add_map_place') {
      navigateFromAssistant(action.destination, () => {
        setProductionMapMode('risk');
        setNewZoneTitle(action.payload.title?.trim() || '');
        setNewZoneNote(action.payload.note?.trim() || '');
      });
      return;
    }
    assistantActionBusyRef.current.add(key);
    setAssistantActionStatuses((current) => ({ ...current, [key]: { state: 'loading' } }));
    const title = action.payload.title?.trim();
    let applied = false;
    if (action.intent === 'create_reminder') {
      applied = await createReminder(title, 'custom', 0, action.payload.dueDate);
    } else if (action.intent === 'add_wishlist') {
      applied = await createWishlistItem({
        title: title || 'Позиция для собаки',
        category: action.payload.category || 'other',
        reason: action.payload.note,
        priority: action.safetyFlag === 'vet_boundary' ? 'high' : 'medium',
        plannedFor: action.payload.dueDate,
        source: 'assistant',
      });
    }
    assistantActionBusyRef.current.delete(key);
    if (!applied) {
      setAssistantActionStatuses((current) => ({ ...current, [key]: { state: 'error', message: 'Не удалось сохранить. Проверь связь и повтори.' } }));
      return;
    }
    const plannedFor = action.intent === 'add_wishlist' ? action.payload.dueDate : undefined;
    const message = plannedFor
      ? `Добавлено в вещи и план на ${new Date(`${plannedFor}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
      : 'Действие сохранено';
    setAssistantActionStatuses((current) => ({ ...current, [key]: { state: 'success', message, plannedFor } }));
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
    if (publishedPublicCardPath && !regenerate && !publicCardHasChanges) return publishedPublicCardPath;
    if (isGuestMode()) {
      setPublishedPublicCardPath(publicCardHref);
      setPublishedPublicCardFingerprint(currentPublicCardFingerprint);
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1400);
      return publicCardHref;
    }

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
      setPublishedPublicCardFingerprint(publicCardFingerprint(result.card?.fields ?? publicCardPayload));
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
      setPublishedPublicCardFingerprint('');
      setPublicCardRevokeConfirm(false);
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
      setPublishedPublicCardFingerprint('');
      setPublicCardRevokeConfirm(false);
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1400);
    } finally {
      setPublicCardLinkBusy(false);
    }
  }

  async function deleteCurrentDog() {
    const expectedName = profile.dogName.trim();
    const petId = profile.backendPetId || activePetId;
    if (!expectedName || dogDeleteName.trim() !== expectedName || petMutationBusy || (!isGuestMode() && !petId)) return;
    setPetMutationBusy(true);
    setError('');
    try {
      if (!isGuestMode()) {
        const response = await fetch('/api/v1/pets', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ petId, confirmation: 'DELETE_DOG' }),
        });
        if (!response.ok) throw new Error('PET_DELETE_FAILED');
      }
      if (isGuestMode()) {
        resetGuestEntityStorage(window.localStorage, petId);
        window.localStorage.removeItem(observationsStorageKey(petId));
      }
      const remainingPets = pets.filter((pet) => pet.id !== petId);
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
        setOwnerRoutes([]);
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
      resetAllLocalPsoData(window.localStorage);
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

  function deleteLocalData() {
    if (localDeleteConfirmation.trim() !== 'ОЧИСТИТЬ ДАННЫЕ' || petMutationBusy || !isGuestMode()) return;
    resetAllLocalPsoData(window.localStorage);
    guestPetIdRef.current = null;
    setProfile(defaultProfile);
    setPets([]);
    setActivePetId('');
    setReminders([]);
    setWishlist([]);
    setZones([]);
    setOwnerRoutes([]);
    setObservations([]);
    setDocuments([]);
    setPublishedPublicCardPath('');
    setLocalDeleteConfirmation('');
    setJourneyDetail(null);
    setTab('today');
    setNotice('saved');
    window.setTimeout(() => setNotice('idle'), 1400);
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

  async function copyPublicDogCard() {
    if (!publicCardReady) {
      setTab('profile');
      return;
    }
    const path = await publishPublicDogCard();
    if (!path) return;
    const url = new URL(path, window.location.origin).toString();
    const copied = await navigator.clipboard?.writeText(url).then(() => true).catch(() => false);
    if (!copied) {
      setError('Не удалось скопировать ссылку. Открой карточку и скопируй адрес из браузера.');
      return;
    }
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
    setNotice('copied');
    window.setTimeout(() => setNotice('idle'), 1400);
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
  const mapDraftReady = drawMode === 'route' ? routePoints.length >= 2 && mapRouteMeta?.ready!==false : Boolean(pickedZonePoint);
  const mapComposerContent = <section className="production-map-composer" data-map-composer-content aria-label={productionMapMode === 'route' ? 'Новый маршрут' : 'Новое предупреждение'}>
    <div className="production-map-composer-status">
      <span aria-hidden="true">{productionMapMode === 'route' ? <MapTrifold weight="regular" /> : <ShieldWarning weight="fill" />}</span>
      <div><b>{productionMapMode === 'route' ? `Поставлено: ${routePoints.length}` : pickedZonePoint ? 'Примерное место выбрано' : 'Выберите место'}</b><p>{productionMapMode === 'route' ? 'Проверьте путь, добавьте название и сохраните маршрут.' : mapSaveMode === 'shared' ? 'По ссылке будет видна только приблизительная область.' : 'Отметка останется личной. Точное место никому не показывается.'}</p></div>
    </div>
    <label>Название <span>необязательно</span><input value={newZoneTitle} onChange={(event) => setNewZoneTitle(event.target.value)} placeholder={productionMapMode === 'route' ? 'Например, вечерний круг' : 'Например, битое стекло'} /></label>
    <label>Что важно знать <span>необязательно</span><textarea value={newZoneNote} onChange={(event) => setNewZoneNote(event.target.value)} placeholder={productionMapMode === 'route' ? 'Покрытие, вода, освещение' : 'Что произошло и когда заметили'} rows={2} /></label>
    <section className="production-map-privacy" aria-label="Кому видно">
      <button type="button" className={mapSaveMode === 'private' ? 'active' : ''} onClick={() => setMapSaveMode('private')} aria-pressed={mapSaveMode === 'private'}><b>Только мне</b><span>личная отметка</span></button>
      <button type="button" className={mapSaveMode === 'shared' ? 'active' : ''} onClick={() => setMapSaveMode('shared')} aria-pressed={mapSaveMode === 'shared'}><b>По ссылке</b><span>можно закрыть позже</span></button>
    </section>
    <div className="production-map-composer-actions">
      <button type="button" className="secondary" onClick={() => setProductionMapMode('view')}>{productionMapMode === 'route' ? 'Свернуть маршрут' : 'Отменить'}</button>

      <button type="button" className="primary" disabled={!mapDraftReady || mapDraftSaving} onClick={() => void saveProductionMapDraft()}>{mapDraftSaving ? 'Сохраняю…' : !mapDraftReady ? productionMapMode === 'route' ? 'Отметьте две точки' : 'Коснитесь карты' : mapSaveMode === 'shared' ? 'Сохранить и скопировать ссылку' : 'Сохранить лично'}</button>
    </div>
  </section>;
  const mapSavedContent = <section className="production-map-saved" data-map-saved-content aria-label="Сохранённое на карте">
    {zones.length === 0 && ownerRoutes.length === 0 && <article className="production-map-empty"><MapPin weight="regular" aria-hidden="true" /><div><b>Карта пока чистая</b><p>Сохраните маршрут или предупредите об опасном месте.</p></div></article>}
    {zones.map((zone) => <article key={zone.id} className={`production-map-saved-row ${zone.type === 'risk_zone' ? 'risk' : 'place'}`}>
      <span className="production-map-saved-mark" aria-hidden="true"><MapTrifold weight="regular" /></span>
      {editingZoneId === zone.id ? <div className="production-map-route-edit"><input value={zoneTitleDraft} onChange={(event) => setZoneTitleDraft(event.target.value)} aria-label="Название места" /><input value={zoneNoteDraft} onChange={(event) => setZoneNoteDraft(event.target.value)} aria-label="Заметка о месте" /><span><button type="button" disabled={!zoneTitleDraft.trim()} onClick={() => void updateZone(zone.id, { title: zoneTitleDraft.trim(), note: zoneNoteDraft.trim() })}>Сохранить</button><button type="button" onClick={() => setEditingZoneId(null)}>Отмена</button></span></div> : <><div><b>{zone.title}</b><p>{formatZoneMeta(zone)} · {zone.visibility === 'shared' ? 'по ссылке' : 'только вам'}</p></div><div className="production-map-row-actions"><button type="button" onClick={() => { setEditingZoneId(zone.id); setZoneTitleDraft(zone.title); setZoneNoteDraft(zone.note || ''); }}>Изменить</button><button type="button" className="danger-action" onClick={() => deleteZone(zone.id)}>Убрать</button></div></>}
    </article>)}
    {ownerRoutes.map((route) => <article key={route.id} className="production-map-saved-row route">
      <span className="production-map-saved-mark" aria-hidden="true"><MapPin weight="fill" /></span>
      {editingRouteId === route.id ? <div className="production-map-route-edit"><input value={routeTitleDraft} onChange={(event) => setRouteTitleDraft(event.target.value)} aria-label="Название маршрута" /><input value={routeDescriptionDraft} onChange={(event) => setRouteDescriptionDraft(event.target.value)} aria-label="Заметка о маршруте" /><span><button type="button" disabled={Boolean(routeMutationBusy) || !routeTitleDraft.trim()} onClick={() => updateOwnerRoute(route.id, { title: routeTitleDraft.trim(), description: routeDescriptionDraft.trim() })}>Сохранить</button><button type="button" onClick={() => setEditingRouteId(null)}>Отмена</button></span></div> : <><div><b>{route.title}</b><p>{route.routeSource === 'recorded' ? `${route.startedAt ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(route.startedAt)) + ' · ' : ''}${route.durationSeconds !== undefined ? `${Math.floor(route.durationSeconds / 60)} мин · ` : ''}${route.distanceMeters !== undefined ? route.distanceMeters < 1000 ? `${route.distanceMeters} м` : `${(route.distanceMeters / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} км` : 'Записанная прогулка'}` : route.description || 'Маршрут построен заранее'} · {route.visibility === 'shared' ? 'по ссылке' : 'только вам'}</p></div><div className="production-map-row-actions"><button type="button" onClick={() => planSavedRoute(route,false,true)}>Открыть</button><button type="button" onClick={() => planSavedRoute(route,false)}>Повторить маршрут</button><button type="button" onClick={()=>downloadRouteGpx(route.title,route.path.coordinates,route.pathGaps,route.planning?.stops)}>GPX</button>{route.routeSource==='planned'&&<button type="button" onClick={() => planSavedRoute(route,true)}>Изменить путь</button>}<button type="button" onClick={() => beginOwnerRouteEdit(route)}>Изменить</button><button type="button" onClick={() => route.visibility === 'shared' ? revokeOwnerRouteShare(route) : shareOwnerRoute(route)}>{route.visibility === 'shared' ? 'Закрыть ссылку' : 'Поделиться'}</button><button type="button" className="danger-action" onClick={() => setPendingRouteDeletion(route)}>Убрать</button></div></>}
    </article>)}
    {removedZone && <div className="restore-notice" role="status"><span>Место убрано</span><button type="button" onClick={restoreZone}>Вернуть</button></div>}
  </section>;

  return (
    <main className="app-canvas" data-connected-canvas={tab === 'today' || tab === 'all' ? '' : undefined}>
      <section ref={phoneShellRef} className={`phone-shell${hasDog ? ' journal-shell' : ''} tab-${tab}${hasDog && (isJourneyRoute || journeyDetail === 'nearby') ? ' journey-active' : ''}`}>
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
            <p>Начни с имени. Возраст, пол и породу можно указать позже.</p>
          </div>
          <button className="primary" type="button" onClick={() => setDogCreationOpen(true)}>Добавить собаку</button>
        </section>}

        {hasDog && tab === 'today' && !journeyDetail && <ConnectedHome
          key={`home:${profile.backendPetId || activePetId}`}
          dogName={profile.dogName} petId={profile.backendPetId} guest={isGuestMode()}
          question={assistantQuestion} loading={assistantLoading} headers={authHeaders}
          recentQuestion={assistantMessages.findLast(message => message.role === 'user')?.content}
          onQuestion={setAssistantQuestion}
          onAsk={() => { openAssistantSheet(); void askAssistant(); }}
          onContinue={run => { if (run) { setAgentRunId(run.id); setAssistantThreadId(run.thread_id || ''); } openAssistantSheet(); }}
          onProfile={() => { setProfileSurface('overview'); setTab('profile'); }}
          onAll={() => setTab('all')}
        />}
        {hasDog && tab === 'all' && <ConnectedTools onOpen={destination => {
          if (destination === 'passport') {
            const origin = { from: tab, to: 'profile' as Tab, detail: journeyDetail, shellScroll: phoneShellRef.current?.scrollTop ?? 0, windowScroll: window.scrollY, focusText: document.activeElement?.textContent?.trim() ?? '' };
            setProfileSurface('passport'); setTab('profile'); secondaryOrigins.current.push(origin);
          } else setTab(destination);
        }} />}
        {hasDog && tab === 'diary' && !journeyDetail && <ProductionJourney route="today"
          onBack={() => closeSecondaryFlow('all')}
          onOpenJournalEntry={(entry, trigger) => openPrivateRecord(entry.kind === 'care' ? 'reminder' : 'observation', entry.id.replace(/^(care|observation)-/, ''), trigger)}
          dogName={profile.dogName}
          breedLabel={breedLabel}
          avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />}
          dayEntries={journalDayEntries(reminders, observations, new Date())}
          careTitle={todayCare.title}
          careDetail={todayCare.detail}
          careActionLabel={todayCare.state === 'empty' ? 'Добавить первое дело' : todayCare.actionLabel}
          recommendationSlot={<RecommendationCard
            dogName={profile.dogName}
            recommendation={mainRecommendation}
            state={recommendationState}
            busyAction={recommendationBusyAction}
            onPrimary={() => { void acceptMainRecommendation(); }}
            onSnooze={() => { void updateRecommendation({ action: 'snooze', until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }, 'snooze'); }}
            onDismiss={() => { void updateRecommendation({ action: 'dismiss', reason: 'not_relevant' }, 'dismiss'); }}
            onRetry={() => { void refreshRecommendation(); }}
          />}
          profileEntries={profileJourneyEntries}
          profileFacts={[profile.lifeStage || profile.age, profile.sex, profile.energyLevel].filter(Boolean) as string[]}
          observationPoints={observations.map((item) => ({
            id: item.id,
            createdAt: item.createdAt,
            mood: item.mood,
            appetite: item.appetite,
            stool: item.stool,
            energy: item.energy,
            note: item.note,
          }))}
          voiceCapture={<VoiceObservationCapture
            petId={profile.backendPetId || activePetId}
            petName={profile.dogName}
            authorId={telegramSession.ownerId || session?.user.email || 'owner'}
            onTranscribe={transcribeVoiceObservation}
            onExtract={extractVoiceObservationCandidates}
            onSave={saveVoiceObservationCandidates}
            onSavePrivateNote={saveVoicePrivateNote}
          />}
          onOpenCare={() => {
            setCareView('active');
            setTab('calendar');
          }}
          onOpenCard={() => setTab('card')}
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
          surface={profileSurface}
          onSurfaceChange={surface => { if (surface === 'overview' && secondaryOrigins.current.at(-1)?.to === 'profile') closeSecondaryFlow('all'); else setProfileSurface(surface); }}
          key={`profile:${profile.backendPetId || activePetId}`}
          profile={profile}
          breedLabel={breedLabel}
          imageUrl={generatedAvatarUrl || profile.avatarImageUrl || (demoMode ? '/demo-avatar.png' : '')}
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
            onSavePrivateNote={saveVoicePrivateNote}
          />}
          identityOpen={avatarComposerOpen}
          avatarCapabilities={avatarCapabilities}
          avatarDraftUrl={avatarDraftAssetId ? generatedAvatarUrl : ''}
          avatarDraftSource={avatarDraftSource}
          avatarState={avatarState}
          avatarOwnerPrompt={avatarOwnerPrompt}
          avatarConsent={avatarConsent}
          error={error}
          onBack={() => secondaryOrigins.current.at(-1)?.to === 'profile' ? closeSecondaryFlow('all') : setTab('today')}
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
          onAddDocument={(trigger) => {
            if (isGuestMode()) {
              setError('Документы сохраняются только в приватном профиле Telegram. Остальные данные можно вести на этом устройстве.');
              return;
            }
            documentUploadTriggerRef.current = trigger;
            setDocumentUploadOpen(true);
          }}
          onOpenRecord={openPrivateRecord}
          onOpenDocument={(id) => window.open(`/api/documents/${id}`, '_blank', 'noopener,noreferrer')}
          onDeleteDocument={(id) => void deletePetDocument(id)}
          documentBusyId={documentBusyId}
          onAskAssistant={openAssistantSheet}
          onOpenPlan={() => { setCareView('active'); setTab('calendar'); }}
          onOpenHealth={() => setTab('health')}
          onOpenHabits={() => setTab('habits')}
          onOpenCard={() => setTab('card')}
          onOpenSettings={() => openJourneyDetail('profile')}
        />}

        {hasDog && <ProductionDocumentSheet key={`document:${profile.backendPetId}`} open={tab === 'profile' && documentUploadOpen} dogName={petNameGent} returnFocusTo={documentUploadTriggerRef.current} onClose={() => setDocumentUploadOpen(false)}>
          <form className="profile-life-document-form" data-slot="field-group" onSubmit={uploadPetDocument} onReset={() => { setDocumentFileName(''); setDocumentError(''); documentSaveAttempt.current = null; }}>
            <fieldset disabled={documentUploading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'grid', gap: 16 }}>
            <label data-slot="field"><span data-slot="field-label">Что это</span><span className="document-field-control"><TextT weight="regular" aria-hidden="true" /><input data-slot="input" name="title" required placeholder="Например, общий анализ крови" /></span></label>
            <label data-slot="field"><span data-slot="field-label">Тип документа</span><span className="document-field-control document-select-control"><Files weight="regular" aria-hidden="true" /><select data-slot="input" name="kind" defaultValue="analysis"><option value="analysis">Анализ</option><option value="prescription">Назначение</option><option value="vaccination">Вакцинация</option><option value="other">Другое</option></select><CaretDown className="document-field-action" weight="regular" aria-hidden="true" /></span></label>
            <label data-slot="field"><span data-slot="field-label">Дата документа <small>необязательно</small></span><span className="document-field-control"><CalendarBlank weight="regular" aria-hidden="true" /><input data-slot="input" name="documentDate" type="date" /></span></label>
            <label data-slot="field"><span data-slot="field-label">Клиника <small>необязательно</small></span><span className="document-field-control"><Buildings weight="regular" aria-hidden="true" /><input data-slot="input" name="clinic" placeholder="Название клиники" /></span></label>
            <label className="document-file-drop" data-slot="field"><input data-slot="input" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => setDocumentFileName(event.currentTarget.files?.[0]?.name || '')} aria-describedby={`profile-document-help${documentError ? ' profile-document-error' : ''}`} /><span className="document-file-drop-media" aria-hidden="true">{documentFileName ? <CheckCircle weight="fill" /> : <UploadSimple weight="regular" />}</span><span className="document-file-drop-copy"><b data-document-file-name>{documentFileName || 'Выбрать PDF или фото'}</b><small data-slot="field-description" id="profile-document-help">До 4 МБ · файл останется приватным</small></span><span className="document-file-drop-action" aria-hidden="true">{documentFileName ? 'Готово' : 'Выбрать'}</span></label>
            {documentError && <p className="profile-life-form-error" data-slot="field-error" id="profile-document-error" role="alert">{documentError}</p>}
            <button className="primary" data-slot="button" type="submit" disabled={documentUploading}>{documentUploading ? 'Добавляю…' : <><CheckCircle weight="regular" /> Добавить в историю {petNameGent}</>}</button>
            <button type="reset">Очистить черновик</button>
            </fieldset>
          </form>
        </ProductionDocumentSheet>}

        {hasDog && mapActivity && tab !== 'map' && <button type="button" className="map-global-activity" onClick={() => setTab('map')}>{mapActivity==='recording'?'Прогулка записывается':'Прогулка на паузе'} · Вернуться к карте</button>}
        {hasDog && (tab === 'map' || mapVisited) && <div hidden={tab !== 'map'} className="map-persistent-workspace"><ProductionJourney route="map"
          dogName={profile.dogName}
          breedLabel={breedLabel}
          avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />}
          mapWorkspace={<ProductionMapWorkspace
            actionNotice={notice==='mapSaved'?'Сохранено на карте':undefined}
            key={profile.backendPetId || activePetId}
            petId={profile.backendPetId || activePetId}
            guest={isGuestMode()}
            authHeaders={authHeaders}
            dogName={profile.dogName}
            avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />}
            zones={zones}
            features={ownerRoutes}
            recordedRoutes={ownerRoutes}
            mode={productionMapMode}
            pickedPoint={pickedZonePoint}
            routePoints={routePoints}
            draftTitle={newZoneTitle}
            draftNote={newZoneNote}
            savedRevision={mapSavedRevision}
            routeEditSeed={routeEditSeed}
            agentSelection={agentMapSelection}
            agentWalkSelection={agentWalkSelection}
            agentSavedRouteSelection={agentSavedRouteSelection}
            onReturnToAssistant={openAssistantSheet}
            editingRouteId={editingRouteGeometryId}
            onActivityChange={setMapActivity}
            onReuseRoute={id=>{const route=ownerRoutes.find(r=>r.id===id);if(route)planSavedRoute(route,false);}}
            onRestoreDraftText={(title,note,id) => { setNewZoneTitle(title);setNewZoneNote(note);setEditingRouteGeometryId(id||null); }}
            composer={mapComposerContent}
            savedContent={mapSavedContent}
            onOpenProfile={() => { setJourneyDetail(null); setTab('profile'); }}
            onModeChange={setProductionMapMode}
            onMapClick={handleMapClick}
            onAppendRoutePoint={(point) => setRoutePoints((current) => [...current, point])}
            onReplaceRoutePoints={setRoutePoints}
            onClearDraft={() => { setRoutePoints([]); setPickedZonePoint(null);setNewZoneTitle('');setNewZoneNote('');setEditingRouteGeometryId(null);setRouteEditSeed(null); }}
            onSaveDraft={() => void saveProductionMapDraft()}
            canSaveDraft={mapDraftReady}
            savingDraft={mapDraftSaving}
            onRouteMetaChange={setMapRouteMeta}
          />}
          onNavigate={(route) => { setJourneyDetail(null); setTab(route); }}
        /></div>}

        {hasDog && assistantOpen && <ProductionAssistantSheet
          returnFocusTo={assistantReturnFocus}
          dogName={profile.dogName}
          avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />}
          question={assistantQuestion}
          answer={assistantAnswer}
          messages={assistantMessages}
          loading={assistantLoading}
          error={assistantError}
          suggestions={assistantSuggestedQuestions.length ? assistantSuggestedQuestions : contextualAssistantSuggestions}
          actions={<>
            {!isGuestMode()&&profile.backendPetId&&<AgentPanel key={profile.backendPetId} petId={profile.backendPetId} runId={agentRunId} headers={authHeaders}
              observationEdits={agentObservationEdits.current}
              onOpenSavedWalk={async id=>{
                const pet=profile.backendPetId;if(!pet)return 'missing';
                agentMapRead.current?.abort();const controller=new AbortController();agentMapRead.current=controller;
                const response=await fetch(`/api/map/features/${encodeURIComponent(id)}?petId=${encodeURIComponent(pet)}`,{headers:authHeaders(),signal:controller.signal});
                const body=await response.json();if(controller.signal.aborted)return;
                if(!response.ok){if(response.status===404){setAgentSavedRouteSelection(null);setOwnerRoutes(current=>current.filter(route=>route.id!==id));return 'missing';}return 'failed';}
                const route=normalizeOwnerRoutes([body.route])[0];if(!route||route.id!==id||route.petId!==pet)return 'failed';
                setOwnerRoutes(current=>upsertOwnerRoute(current,route));setAgentMapSelection(null);setAgentWalkSelection(null);
                setAgentSavedRouteSelection({token:crypto.randomUUID(),petId:pet,route});
                setAssistantOpen(false);setJourneyDetail(null);setTabState('map');
                const url=new URL(window.location.href);url.hash='map';window.history.replaceState({tab:'map'},'',url);
              }}
              onOpenWalk={walk=>{
                if(!isAgentWalk(walk)||!profile.backendPetId)return;
                setAgentSavedRouteSelection(null);setAgentMapSelection(null);setAgentWalkSelection({token:crypto.randomUUID(),petId:profile.backendPetId,walk});
                setAssistantOpen(false);setJourneyDetail(null);setTabState('map');
                const url=new URL(window.location.href);url.hash='map';window.history.replaceState({tab:'map'},'',url);
              }}
              onOpenPlace={(place,places)=>{
                if(!isMapSearchPlace(place)||!profile.backendPetId)return;
                setAgentSavedRouteSelection(null);setAgentWalkSelection(null);setAgentMapSelection({token:crypto.randomUUID(),petId:profile.backendPetId,place,places:places.filter(isMapSearchPlace)});
                setAssistantOpen(false);setJourneyDetail(null);setTabState('map');
                const url=new URL(window.location.href);url.hash='map';window.history.replaceState({tab:'map'},'',url);
              }}
              onObservationSaved={record=>{const entry=normalizeObservation(record);if(entry)setObservations(current=>[{...entry,syncStatus:'saved' as const},...current.filter(item=>item.id!==entry.id)]);}}
              onOpenObservation={(record,trigger)=>setRecordDetail({id:record.id,title:`Запись о ${petNameGent}`,text:record.note||record.value,date:record.observed_at,facts:[],trigger})}
              onBusy={setAssistantLoading} onRetry={question=>void askAssistant(question)} onResult={result=>{
              if(agentDelivered.current===result.runId) return;
              agentDelivered.current=result.runId;
              setAssistantAnswer(result.answer);setAssistantThreadId(result.threadId);
              setAssistantMessages(current=>[...current,{role:'assistant',content:result.answer}]);
              setAssistantDiagnostic({provider:result.provider??'openai',mode:'agent'});
            }}/>}
            <AssistantActionButtons actions={assistantActions} statuses={assistantActionStatuses} onApply={(action, key) => { void handleApplyAction(action, key); }} onOpen={openAssistantAction} />
          </>}
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
          suggestedDraft={suggestedHabitDraft}
        />}

        {hasDog && tab === 'health' && <HealthTimelineScreen
          key={profile.backendPetId || activePetId}
          dogName={profile.dogName || 'Собака'}
          entries={observations}
          draft={observationDraft}
          saving={observationSaving}
          error={moduleErrors.health}
          onBack={() => closeSecondaryFlow('today')}
          onDraftChange={updateObservationDraft}
          onSave={submitObservation}
          onRetry={() => loadHealthTimeline()}
          loading={healthLoading}
          hasMore={Boolean(healthNextCursor)}
          onLoadMore={() => healthNextCursor ? loadHealthTimeline(healthNextCursor) : Promise.resolve()}
          captureOpen={observationCaptureOpen}
          onCaptureOpen={setObservationCaptureOpen}
          issue={observationIssue}
          recentlyDeleted={Boolean(recentlyDeletedObservation)}
          onRestore={restoreObservation}
          factsError={healthFactsError}
          factsSaving={profileSaving}
          editingId={editingObservationId}
          editDraft={observationEditDraft}
          mutationBusy={observationMutationBusy}
          onStartEdit={startObservationEdit}
          onEditDraftChange={(patch) => setObservationEditDraft(current => { const next = { ...current, ...patch }; if (editingObservationId) observationEditDrafts.current.set(editingObservationId, next); return next; })}
          onSaveEdit={editObservation}
          onCancelEdit={() => { if (editingObservationId) observationEditDrafts.current.set(editingObservationId,observationEditDraft); setEditingObservationId(null); }}
          onDelete={deleteObservation}
          facts={healthFactsDraft ?? profile}
          onFactChange={(patch) => setHealthFactsDraft(current => ({ ...(current ?? profile), ...patch }))}
          onSaveFacts={async () => { if (await savePrivateProfile(healthFactsDraft ?? profile,setHealthFactsError)) setHealthFactsDraft(null); }}
        />}

        {hasDog && tab === 'nearby' && <ProductionWoofWorkspace
          key={`${profile.backendPetId || activePetId}:${woofRecommendationEntry?.key ?? 'woof-workspace'}`}
          petId={profile.backendPetId || activePetId}
          error={error}
          routes={ownerRoutes}
          authHeaders={authHeaders}
          dogName={profile.dogName || 'Собака'}
          avatar={<GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" fill />}
          profile={socialLoadedPet===profile.backendPetId?socialProfile:null}
          signals={socialLoadedPet===profile.backendPetId?walkSignals:[]}
          viewerLocation={socialViewerLocation}
          viewerRadiusKm={socialViewerRadiusKm}
          viewerRadiusMeters={socialViewerRadiusMeters}
          signalReason={walkSignalReason}
          candidates={socialLoadedPet===profile.backendPetId?socialCandidates:{nearby:[],city:[]}}
          requests={socialLoadedPet===profile.backendPetId?socialRequests:[]}
          state={!hasConnectedAccount || !profile.backendPetId ? 'idle' : socialLoadedPet===profile.backendPetId?nearbyState:'loading'}
          accessMessage={!hasConnectedAccount ? 'Откройте Псё через кнопку бота в Telegram, чтобы видеть собак рядом и отправлять Гав.' : !profile.backendPetId ? 'Сначала сохраните профиль своей собаки — после этого станут доступны знакомства и Гав.' : undefined}
          busyId={socialBusyId}
          locating={socialLocating}
          missingTelegramUsernameAction={missingTelegramUsernameAction}
          invite={socialInvite ? { petName: socialInvite.petName, expiresAt: socialInvite.expiresAt } : null}
          inviteState={socialInviteState}
          recommendationEntry={woofRecommendationEntry}
          onAcceptInvite={acceptSocialInvite}
          onDismissInvite={dismissSocialInvite}
          onSaveProfile={saveSocialProfile}
          result={socialLoadedPet===profile.backendPetId?socialResult:''}
          onHideProfile={hideSocialProfile}
          onLocateProfile={locateForSocial}
          onChooseViewerLocation={(location) => {setSocialViewerLocation(location);loadSocialSurface(undefined,location).catch(()=>setNearbyState('error'));}}
          onLocateViewer={locateForWalkSignals}
          onChangeViewerRadius={changeWalkSignalRadius}
          onSaveSignal={saveWalkSignal}
          onCloseSignal={closeWalkSignal}
          onRequest={sendSocialRequest}
          onUpdateRequest={updateSocialRequest}
          onReport={reportSocialRequest}
          onOpenContact={openTelegramDestination}
          onRefresh={refreshLiveSocial}
          onRetry={() => loadSocialSurface().catch(() => setNearbyState('error'))}
        />}

        {hasDog && tab === 'calendar' && <WatercolorScreen onBack={() => closeSecondaryFlow('today')} backLabel="Назад" className="calendar-composition" tone="gold" eyebrow="план ухода" title="План заботы" caption="Дела, напоминания и история ухода." aside={<CalendarDots className="watercolor-hero-mark" weight="duotone" aria-hidden="true" />}>
          <section className="care-workbench" aria-label="Дела ухода">
            <div className="care-workbench-head">
              <div><span className="eyebrow">сейчас в плане</span><h3>{activeReminders.length ? formatCount(activeReminders.length, ['активное дело', 'активных дела', 'активных дел']) : 'Добавь первое дело'}</h3></div>
              <button className="primary" onClick={() => {
                setNewReminderDueDate(selectedCalendarDate);
                setCareView('active');
                requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.today-quick-add input')?.focus());
              }}>Добавить дело</button>
            </div>
            <div className="care-view-toggle" aria-label="Раздел плана ухода">
              <button className={careView === 'active' ? 'active' : ''} onClick={() => setCareView('active')} aria-pressed={careView === 'active'}>Календарь</button>
              <button className={careView === 'history' ? 'active' : ''} onClick={() => setCareView('history')} aria-pressed={careView === 'history'}>История</button>
            </div>

            {careView === 'active' && <div className="care-calendar-view">
              <section className="care-calendar-panel" data-care-calendar aria-label="Календарь дел">
                <div className="calendar-toolbar">
                  <button type="button" aria-label="Предыдущий месяц" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ArrowLeft weight="bold" aria-hidden="true" /></button>
                  <b>{calendarTitle}</b>
                  <button type="button" aria-label="Следующий месяц" onClick={() => setCalendarCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ArrowRight weight="bold" aria-hidden="true" /></button>
                </div>
                <div className="calendar-mode-row">
                  <span>{formatCount(activeReminders.length, ['дело в плане', 'дела в плане', 'дел в плане'])}</span>
                  <button type="button" onClick={() => {
                    const today = new Date();
                    const key = dateInputValue(today);
                    setCalendarCursor(today);
                    setSelectedCalendarDate(key);
                  }}>Сегодня</button>
                </div>
                <div className="care-calendar-grid" role="grid" aria-label={calendarTitle}>
                  {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((weekday) => <span className="calendar-weekday" role="columnheader" key={weekday}>{weekday}</span>)}
                  {calendarDays.map((day) => <button
                    type="button"
                    role="gridcell"
                    key={day.key}
                    className={`calendar-day${day.inMonth ? '' : ' muted'}${day.reminders.length ? ' has-care' : ''}${day.isToday ? ' today' : ''}${day.isSelected ? ' selected' : ''}`}
                    aria-pressed={day.isSelected}
                    aria-label={`${day.date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, ${formatCount(day.reminders.length, ['дело', 'дела', 'дел'])}`}
                    onClick={() => {
                      setSelectedCalendarDate(day.key);
                      setNewReminderDueDate(day.key);
                      if (!day.inMonth) setCalendarCursor(day.date);
                    }}
                  >
                    <span>{day.date.getDate()}</span>
                    {day.reminders.length > 0 && <b aria-hidden="true">{day.reminders.length}</b>}
                  </button>)}
                </div>
              </section>

              <div className="selected-day-panel">
                <div><span>Дела на выбранную дату</span><b>{selectedDateLabel}</b></div>
                <button type="button" onClick={() => {
                  setNewReminderDueDate(selectedCalendarDate);
                  document.querySelector<HTMLInputElement>('.today-quick-add input')?.focus();
                }}>Добавить</button>
              </div>

              <div className="care-task-list" aria-live="polite">
              {selectedDateReminders.length === 0 && <article className="care-empty-state"><b>На этот день дел нет</b><p>Выбери другую дату или добавь дело — выбранный день уже подставлен в форму.</p></article>}
              {selectedDateReminders.map((reminder) => <article key={reminder.id} className={`care-task-card ${new Date(reminder.snoozedUntil || reminder.dueAt).getTime() < new Date().setHours(0, 0, 0, 0) ? 'warning' : ''}`}>
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
              </div>
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
            <label htmlFor="care-new-title">Название дела</label>
            <div className="quick-add today-quick-add">
              <input id="care-new-title" value={newReminderTitle} onChange={(event) => setNewReminderTitle(event.target.value)} placeholder="Например: обработка от клещей" />
              <button aria-label="Добавить дело" onClick={() => createReminder()}><Plus aria-hidden="true" /></button>
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

        {hasDog && tab === 'card' && <WatercolorScreen onBack={() => closeSecondaryFlow('profile')} backLabel="Назад" className="public-card-screen" tone="gold" eyebrow="" title="Публичная карточка" caption="Одна безопасная ссылка для догситтера, грумера, друга или человека во дворе. Ты решаешь, что показать и когда закрыть доступ." aside={<PawPrint className="watercolor-hero-mark" weight="duotone" aria-hidden="true" />}>

          <section className={`public-card-lifecycle ${publicCardPublished ? 'is-published' : 'is-draft'} ${publicCardHasChanges ? 'has-changes' : ''}`} aria-live="polite">
            <div className="public-card-lifecycle-icon" aria-hidden="true">{publicCardPublished ? <CheckCircle weight="fill" /> : <LinkSimple weight="duotone" />}</div>
            <div className="public-card-lifecycle-copy">
              <h3>{!publicCardReady ? 'Сначала подготовь памятку' : publicCardHasChanges ? 'Обнови опубликованную карточку' : publicCardPublished ? 'Карточка опубликована' : 'Создай безопасную ссылку'}</h3>
              <p>{!publicCardReady ? `Осталось: ${publicCardMissing.join(', ')}.` : publicCardHasChanges ? 'Активная ссылка пока показывает предыдущую версию. Опубликуй изменения, когда закончишь.' : publicCardPublished ? 'Ссылка активна. Её можно отправить, открыть или отозвать в любой момент.' : 'После создания никто не найдёт карточку через поиск — она откроется только по твоей ссылке.'}</p>
              {publicCardPublished && <code>{publishedPublicCardPath}</code>}
            </div>
            {!publicCardReady ? <button className="primary" onClick={() => setTab('profile')}>Дозаполнить профиль</button> : !publicCardPublished || publicCardHasChanges ? <button className="primary" disabled={publicCardLinkBusy} onClick={() => void publishPublicDogCard()}>{publicCardLinkBusy ? publicCardPublished ? 'Обновляю…' : 'Создаю…' : publicCardPublished ? 'Опубликовать изменения' : 'Создать публичную карточку'}</button> : <div className="public-card-published-actions">
              <button className="primary" disabled={publicCardLinkBusy} onClick={copyPublicDogCard}><CopySimple weight="bold" />Скопировать ссылку</button>
              <button className="secondary" disabled={publicCardLinkBusy} onClick={shareDogCard}><PaperPlaneTilt weight="bold" />Отправить</button>
              <button className="secondary" disabled={publicCardLinkBusy} onClick={openPublicCard}>Открыть</button>
            </div>}
          </section>

          <section className="public-card-review" aria-label="Предпросмотр памятки собаки">
            <article className="public-card-preview-panel">
              <div className="public-card-preview-head">
                <b>{publicCardPublished ? publicCardHasChanges ? 'есть изменения' : 'опубликована' : publicCardReady ? 'готова к публикации' : 'черновик'}</b>
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
              {publicCardChecks.map((item) => <div key={item.label} className={item.done ? 'done' : item.optional ? 'optional' : ''}><span>{item.done ? '✓' : item.optional ? '○' : '•'}</span><b>{item.label}</b><small>{item.done ? 'готово' : item.optional ? 'необязательно' : `добавить: ${item.missing}`}</small></div>)}
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
            <button className="secondary" disabled={!publicCardReady || publicCardLinkBusy} onClick={openDogCardPdf}><FilePdf weight="bold" />PDF / печать</button>
            {publicCardPublished && <button className="secondary" disabled={publicCardLinkBusy} onClick={regeneratePublicDogCard}>Создать новую ссылку</button>}
            {publicCardPublished && !publicCardRevokeConfirm && <button className="secondary danger" disabled={publicCardLinkBusy} onClick={() => setPublicCardRevokeConfirm(true)}>Отозвать доступ</button>}
            {publicCardPublished && publicCardRevokeConfirm && <div className="public-card-revoke-confirm" role="group" aria-label="Подтверждение отзыва ссылки">
              <p>Старая ссылка сразу перестанет открываться.</p>
              <button className="secondary danger" disabled={publicCardLinkBusy} onClick={revokePublicDogCard}>Да, отозвать</button>
              <button className="secondary" disabled={publicCardLinkBusy} onClick={() => setPublicCardRevokeConfirm(false)}>Отмена</button>
            </div>}
          </section>

          <article className="public-card-privacy-note">
            <b>Что не публикуем автоматически</b>
            <p>Точный адрес, контакты владельца, медицинские заметки, лекарства и внутреннюю историю ухода. В памятку попадает только то, что нужно человеку рядом с собакой.</p>
          </article>
        </WatercolorScreen>}

        {hasDog && tab === 'profile' && journeyDetail === 'profile' && <WatercolorScreen onBack={closeJourneyDetail} backLabel="В профиль" className="profile-settings-screen" tone="green" eyebrow="настройки" title="Данные и доступ" caption="Аккаунт, приватность и помощь.">
          {session && <section className="journal-account"><p>Вы вошли в аккаунт Псё.</p><button type="button" className="secondary" onClick={signOut}>Выйти из аккаунта</button></section>}

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
            {profile.dogName.trim() && <details><summary>Удалить собаку</summary><div className="profile-delete-form"><p>Будут удалены профиль {profile.dogName}, дела, записи, вещи и места.</p><label>Введите имя собаки полностью<input value={dogDeleteName} onChange={(event) => setDogDeleteName(event.target.value)} placeholder={profile.dogName} /></label><button type="button" className="danger-action" disabled={dogDeleteName.trim() !== profile.dogName.trim() || petMutationBusy} onClick={deleteCurrentDog}>Удалить собаку</button></div></details>}
            {!isGuestMode() && <details><summary>Удалить аккаунт</summary><div className="profile-delete-form"><p>Будут удалены аккаунт и данные всех собак без возможности восстановления.</p><label>Для подтверждения введи УДАЛИТЬ АККАУНТ<input value={accountDeleteConfirmation} onChange={(event) => setAccountDeleteConfirmation(event.target.value)} placeholder="УДАЛИТЬ АККАУНТ" /></label><button type="button" className="danger-action" disabled={accountDeleteConfirmation.trim() !== 'УДАЛИТЬ АККАУНТ' || petMutationBusy} onClick={deleteAccount}>Удалить аккаунт</button></div></details>}
            {isGuestMode() && <details><summary>Очистить данные на этом устройстве</summary><div className="profile-delete-form"><p>Псё удалит локальный профиль, дела, записи, вещи, места и черновики. Данные других сайтов не затрагиваются.</p><label>Для подтверждения введи ОЧИСТИТЬ ДАННЫЕ<input value={localDeleteConfirmation} onChange={(event) => setLocalDeleteConfirmation(event.target.value)} placeholder="ОЧИСТИТЬ ДАННЫЕ" /></label><button type="button" className="danger-action" disabled={localDeleteConfirmation.trim() !== 'ОЧИСТИТЬ ДАННЫЕ' || petMutationBusy} onClick={deleteLocalData}>Очистить данные на устройстве</button></div></details>}
          </section>
        </WatercolorScreen>}

        {hasDog && tab === 'things' && <ProductionJourney route="things" onBack={() => closeSecondaryFlow('all')} dogName={profile.dogName} breedLabel={breedLabel}
          avatar={<GeneratedAvatar profile={profile} ready={Boolean(profile.avatarImageUrl) || demoMode} imageUrl={profile.avatarImageUrl} demo={demoMode} size="small" />}
          onNavigate={setTab} onAskAssistant={openAssistantSheet}>
          <fieldset className="things-write-scope" disabled={wishlistBusy} aria-busy={wishlistBusy}>
          <form className="thing-capture" onSubmit={async event => { event.preventDefault(); const saved = await createWishlistItem(); if (saved) requestAnimationFrame(() => document.getElementById('wish-quick-title')?.focus()); }}>
            <label htmlFor="wish-quick-title">Нужно купить</label>
            <div className="thing-quick-row"><input id="wish-quick-title" value={newWishTitle} onChange={event => setNewWishTitle(event.target.value)} placeholder="Например, корм" maxLength={160} enterKeyHint="done" />
            <button type="submit" aria-label={newWishNeedsReminder ? 'Добавить в вещи и план' : 'Добавить в вещи'} disabled={!newWishTitle.trim() || (newWishNeedsReminder && !newWishPlannedFor)}><Plus aria-hidden="true" /></button></div>
            <details open={thingCaptureOpen} onToggle={event => setThingCaptureOpen(event.currentTarget.open)}><summary>Категория, пояснение и срок</summary>
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
            <label className="thing-plan-option">
              <input type="checkbox" checked={newWishNeedsReminder} onChange={(event) => setNewWishNeedsReminder(event.target.checked)} />
              <span><b>Добавить в план</b><small>Покупка появится в плане на эту дату</small></span>
            </label>
            {newWishNeedsReminder && <label>Купить до<input type="date" min={dateInputValue(new Date())} value={newWishPlannedFor} onChange={(event) => setNewWishPlannedFor(event.target.value)} /></label>}
            </details>
            {wishlistError?.scope === 'create' && <p className="things-error" role="alert">{wishlistError.message}</p>}
          </form>

          {wantedWishlist.length === 0 && boughtWishlist.length === 0 && <p className="things-empty">Пока ничего не нужно. Запиши здесь, когда что-то понадобится.</p>}

          {wantedWishlist.length > 0 && <section className="things-masonry" aria-label="Вещи собаки" aria-live="polite">
            {wantedWishlist.map((item) => <article key={item.id} data-wishlist-id={item.id} className={`wishlist-item priority-${item.priority}`}>
              {editingWishlistId === item.id ? <form className="wishlist-edit-form" onSubmit={async (event) => { event.preventDefault(); await updateWishlistItem(item.id, { title: wishlistTitleDraft.trim(), reason: wishlistReasonDraft.trim() }); }}><label>Название<input value={wishlistTitleDraft} maxLength={160} onChange={event => { setWishlistTitleDraft(event.target.value); wishlistEditDrafts.current.set(item.id,{title:event.target.value,reason:wishlistReasonDraft}); }} /></label><label>Зачем <span className="field-optional">необязательно</span><input value={wishlistReasonDraft} maxLength={500} onChange={event => { setWishlistReasonDraft(event.target.value); wishlistEditDrafts.current.set(item.id,{title:wishlistTitleDraft,reason:event.target.value}); }} /></label><div className="wishlist-actions"><button type="submit" disabled={!wishlistTitleDraft.trim()}>Сохранить</button><button type="button" onClick={() => setEditingWishlistId(null)}>Закрыть</button></div></form> : <><div className="thing-row"><button type="button" className="thing-title" aria-label={`Изменить: ${item.title}`} onClick={() => beginWishlistEdit(item)}><b>{item.title}</b></button><button type="button" className="thing-complete" onClick={() => completeWishlistItem(item)}>Куплено</button></div><details className="thing-details"><summary>Подробнее</summary>{(item.category !== 'other' || item.reason || item.priority !== 'medium') && <p>{formatWishlistMeta(item.category, item.priority === 'medium' ? undefined : item.priority, item.reason)}</p>}<div className="wishlist-actions">
                {item.plannedFor && <p className="wishlist-plan-date"><CalendarBlank weight="bold" aria-hidden="true" />В плане на {new Date(`${item.plannedFor}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>}
                {item.url && <a href={item.url} target="_blank" rel="noreferrer">Открыть</a>}
                {item.plannedFor && <button type="button" onClick={() => openWishlistPlan(item)}>Открыть в плане</button>}
                <button onClick={() => beginWishlistEdit(item)}>Изменить</button>
                <button className="danger-action" onClick={() => deleteWishlistItem(item.id)}>Убрать</button>
              </div></details></>}
              {wishlistError?.scope === item.id && <p className="things-error" role="alert">{wishlistError.message}</p>}
            </article>)}
          </section>}


          {boughtWishlist.length > 0 && <section className="wishlist-list" aria-label="История вещей" aria-live="polite">
            <div className="section-title"><div><span className="eyebrow">история</span><h3>Куплено</h3></div></div>
            {boughtWishlist.map((item) => <article key={item.id} data-wishlist-id={item.id} className="wishlist-item">
              <div><b>{item.title}</b>{(item.category !== 'other' || item.reason || item.priority !== 'medium') && <p>{formatWishlistMeta(item.category, item.priority === 'medium' ? undefined : item.priority, item.reason)}</p>}</div>
              <div className="wishlist-actions"><button onClick={() => updateWishlistItem(item.id, { status: 'wanted', plannedFor: undefined, reminderId: undefined })}>Вернуть</button><button className="danger-action" onClick={() => deleteWishlistItem(item.id)}>Убрать</button></div>
              {wishlistError?.scope === item.id && <p className="things-error" role="alert">{wishlistError.message}</p>}
            </article>)}
          </section>}

          {removedWishlistItem && <div className="restore-notice" role="status">
            <span>Вещь убрана. Вернётся без срока.</span>
            <button type="button" onClick={restoreWishlistItem}>Вернуть</button>
            {wishlistError?.scope === 'restore' && <p className="things-error" role="alert">{wishlistError.message}</p>}
          </div>}
          </fieldset>

        </ProductionJourney>}

        {error && <p className="error-text" role="alert">{error}</p>}
        {notice !== 'idle' && !(tab === 'map' && notice === 'mapSaved') && <div className="toast" role="status" aria-live="polite">{notice === 'documentSaved' ? 'Документ сохранён' : notice === 'loaded' ? 'Данные загружены' : notice === 'mapSaved' ? 'Сохранено на карте' : notice === 'copied' ? 'Скопировано' : notice === 'sharing' ? 'Открываю отправку' : notice === 'downloaded' ? 'Карточка сохранена' : notice === 'applied' ? 'Действие выполнено' : 'Профиль сохранён'}</div>}
      </section>

      {hasDog && !(tab === 'map' && productionMapMode !== 'view') && <AppNavigation dogName={profile.dogName} active={activePrimaryRoute} onAskAssistant={openAssistantSheet} onNavigate={(route) => {
        if (route === 'profile') { setProfileSurface('overview'); secondaryOrigins.current = []; }
        setJourneyDetail(null);
        setAssistantOpen(false);
        setTab(route);
      }} />}

      {tab !== 'today' && tab !== 'all' && <DesktopContextPanel
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
      />}
      <CareActionNotice
        feedback={careFeedback?.kind === 'observation-deleted' ? null : careFeedback}
        onUndo={undoLastCareCompletion}
        onDismiss={() => setCareFeedback(null)}
      />
      {recordDetail && <RecordDetailDialog record={recordDetail} onClose={() => setRecordDetail(null)} />}
      {profileConflict && <ProfileConflictDialog key={profileConflict.remote.profileVersion} conflict={profileConflict} onResolve={resolved => {
        setProfileConflict(null);
        profileConflictResolver.current?.(resolved);
        profileConflictResolver.current = null;
      }} />}
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
