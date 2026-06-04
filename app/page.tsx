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
import { fileToLocalAvatarDataUrl, filesToPhotos, loadProfile, resetProfileStorage, saveProfile } from '@/lib/profileStorage';

type AvatarState = 'idle' | 'rendering' | 'ready';
type Notice = 'idle' | 'saved' | 'copied' | 'loaded';
type AuthUiState = 'idle' | 'sending' | 'sent' | 'rate_limited' | 'retryable_error';
type OnboardingStage = 'intro' | 'photo' | 'style' | 'generating' | 'reveal' | 'done';
type ReminderView = { id: string; petId: string; type: string; title: string; dueAt: string; status: string; snoozedUntil?: string; completedAt?: string };
type WishlistView = { id: string; petId: string; title: string; category: string; reason?: string; url?: string; priority: string; status: string; created_at?: string };
type ZoneView = { id: string; pet_id?: string; petId?: string; type: string; title: string; note?: string; approximate_lat?: number | string | null; approximate_lng?: number | string | null; radius_meters?: number; radiusMeters?: number; created_at?: string };
type AuthSession = { access_token: string; user: { email?: string } };
type Tab = 'today' | 'passport' | 'map' | 'assistant' | 'shop';
const styleOptions = avatarStyles.slice(0, 4);
const onboardingKey = 'pso.topapp.onboarding.v1';
const heroStyleOptions = avatarStyles.filter((style) => ['city', 'space', 'sticker'].includes(style.id));

function FieldSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">не указано</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function MiniMetric({ label, value, fallback = '—' }: { label: string; value?: string; fallback?: string }) {
  return <div className="mini-metric"><span>{label}</span><b>{value || fallback}</b></div>;
}

function TaskCard({ emoji, title, caption, action, onClick }: { emoji: string; title: string; caption: string; action: string; onClick?: () => void }) {
  return <article className="task-card"><span>{emoji}</span><div><b>{title}</b><p>{caption}</p></div><button onClick={onClick}>{action}</button></article>;
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

function dbToProfile(payload: any): Partial<DogProfile> | null {
  if (!payload?.connected || !payload?.pet) return null;
  const pet = payload.pet;
  const passport = payload.passport ?? {};
  const social = payload.social ?? {};
  return {
    backendPetId: pet.id,
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
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newZoneTitle, setNewZoneTitle] = useState('');
  const [newZoneNote, setNewZoneNote] = useState('');
  const [newZoneType, setNewZoneType] = useState('safe_place');
  const [pickedZonePoint, setPickedZonePoint] = useState<{ lat: number; lng: number } | null>(null);
  const [newWishTitle, setNewWishTitle] = useState('');
  const [newWishReason, setNewWishReason] = useState('');
  const [newWishCategory, setNewWishCategory] = useState('gear');
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [assistantAnswer, setAssistantAnswer] = useState('');
  const [breedSearch, setBreedSearch] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [onboardingStage, setOnboardingStage] = useState<OnboardingStage>('intro');
  const [heroNameDraft, setHeroNameDraft] = useState('');
  const guestPetIdRef = useRef<string | null>(null);

  function authHeaders(): Record<string, string> {
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  }

  function isGuestMode() { return !session?.access_token; }
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

  async function loadBootstrap(accessToken?: string) {
    const headers: Record<string, string> = accessToken ? { Authorization: `Bearer ${accessToken}` } : authHeaders();
    const response = await fetch('/api/app/bootstrap', { headers });
    const payload = await response.json();
    const dbProfile = dbToProfile(payload);
    if (dbProfile) {
      setProfile((current) => ({ ...current, ...dbProfile, photos: current.photos, selectedStyle: current.selectedStyle }));
      setReminders(payload.reminders ?? []);
      setWishlist(payload.wishlist ?? []);
      setZones(payload.zones ?? []);
      setNotice('loaded');
      window.setTimeout(() => setNotice('idle'), 1400);
    } else if (payload.empty) {
      setProfile((current) => ({ ...current, backendPetId: undefined }));
      setReminders([]);
      setWishlist([]);
      setZones([]);
    }
  }

  useEffect(() => {
    const local = loadProfile();
    setProfile(local);
    setHeroNameDraft(local.dogName || '');
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
  useEffect(() => { const result = saveProfile(profile); if (!result.ok) setError(result.message); }, [profile]);
  useEffect(() => {
    if (authCooldown <= 0) return;
    const timer = window.setInterval(() => setAuthCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [authCooldown]);

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
    const params = new URLSearchParams({
      name: profile.dogName.trim() || 'Моя собака',
      breed: breedLabel,
      style: profile.temperament || profile.energyLevel || 'спокойный друг',
      bio: profile.bio || profile.triggers || 'Пожалуйста, подходите спокойно и сначала спросите владельца.',
      social: profile.socialMode || 'сначала спросить владельца',
      area: profile.neighborhood || 'район скрыт',
    });
    return `/dog/card?${params.toString()}`;
  }, [breedLabel, profile.bio, profile.dogName, profile.energyLevel, profile.neighborhood, profile.socialMode, profile.temperament, profile.triggers]);
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
  const nextBestAction = useMemo(() => {
    if (!profile.backendPetId) return { emoji: '🪪', title: 'Заполнить профиль', caption: `Готовность ${completionCount}/6. Напоминания, места и Псё работают локально без входа.`, action: 'Открыть', target: 'passport' as Tab };
    if (!profileReady) return { emoji: '🧩', title: 'Довести профиль до минимума', caption: `Не хватает: ${missingProfileFields.slice(0, 3).join(', ')}. Тогда Псё станет точнее.`, action: 'Заполнить', target: 'passport' as Tab };
    if (groupedReminders.overdue.length) return { emoji: '🚩', title: 'Есть просроченная забота', caption: groupedReminders.overdue[0].title, action: 'Закрыть', target: 'today' as Tab, reminderId: groupedReminders.overdue[0].id };
    if (activeReminders.length === 0) return { emoji: '⏰', title: 'Создай первое напоминание', caption: 'Например: обработка, вакцина, корм, груминг или прогулка.', action: 'Добавить', target: 'today' as Tab };
    return { emoji: '🐾', title: 'Всё спокойно', caption: `${activeReminders.length} активн. задач · профиль готов ${completionCount}/6`, action: 'Спросить Псё', target: 'assistant' as Tab };
  }, [activeReminders.length, completionCount, groupedReminders.overdue, missingProfileFields, profile.backendPetId, profileReady]);


  function updateProfile(patch: Partial<DogProfile>) {
    setProfile((current) => ({ ...current, ...patch }));
    setError('');
  }

  function updateBreedGroup(value: BreedGroupId) {
    const firstBreed = breedCatalog.find((breed) => breed.groupId === value)?.id ?? 'mixed';
    updateProfile({ breedGroupId: value, breedId: firstBreed as BreedId });
  }

  async function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) return setError('Нужно фото собаки: JPG, PNG или HEIC.');
    if (imageFiles.find((file) => file.size > 8 * 1024 * 1024)) return setError('Фото больше 8 МБ. Возьми файл поменьше.');
    const [photos, localAvatar] = await Promise.all([
      filesToPhotos(imageFiles, maxPhotos),
      fileToLocalAvatarDataUrl(imageFiles[0]),
    ]);
    setGeneratedAvatarUrl(''); setDemoMode(false); setAvatarState('ready');
    updateProfile({ photos, avatarImageUrl: localAvatar, avatarSource: 'uploaded', createdAt: new Date().toISOString() });
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
      if (String(result.imageUrl).length < 450_000) updateProfile({ avatarImageUrl: result.imageUrl, avatarSource: 'generated' });
    } catch {
      setDemoMode(true); setAvatarState('ready');
      setError('Генерация временно недоступна — показываю premium demo-render.');
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
      if (!response.ok) throw new Error(result?.error || 'Не удалось сохранить в базу');
      updateProfile({ backendPetId: result.pet?.id || profile.backendPetId, isPublic: true });
      await loadBootstrap();
      setNotice('saved');
      window.setTimeout(() => setNotice('idle'), 1600);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить в базу');
    }
  }
  async function signIn() {
    const supabase = getSupabaseBrowser();
    if (!supabase) return setError('Supabase client env не настроен.');
    if (!email.trim()) return setError('Введи email для входа.');
    if (authUiState === 'sending' || authCooldown > 0) return;
    setError('');
    setAuthUiState('sending');
    const productionUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pso-mvp-uglanovrms-projects.vercel.app';
    const redirectTo = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? productionUrl : window.location.origin;
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
    setSession(null);
    setProfile(defaultProfile);
    setReminders([]);
    setWishlist([]);
    setZones([]);
  }

  async function createReminder(title?: string, type = 'custom', dueInDays = 1) {
    const reminderTitle = (title || newReminderTitle || 'Проверить уход').trim();
    if (!profile.backendPetId) {
      if (!isGuestMode()) return setError('Сначала сохрани профиль собаки.');
      ensureGuestPetId();
    }
    if (isGuestMode()) {
      const petId = ensureGuestPetId();
      setReminders((current) => [{ id: guestId('reminder'), petId, type, title: reminderTitle, dueAt: new Date(Date.now() + dueInDays * 86400000).toISOString(), status: 'active' }, ...current]);
      setNewReminderTitle('');
      return;
    }
    const response = await fetch('/api/reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ petId: profile.backendPetId, title: reminderTitle, dueAt: new Date(Date.now() + dueInDays * 86400000).toISOString(), type, source: 'today_quick_action' }),
    });
    const result = await response.json();
    if (!response.ok) return setError(result.error || 'Не удалось создать напоминание');
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
    if (!response.ok) return setError(result.error || 'Не удалось добавить вишлист');
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
    if (!response.ok) return setError(result.error || 'Не удалось сохранить зону');
    setNewZoneTitle('');
    setNewZoneNote('');
    setPickedZonePoint(null);
    await loadBootstrap();
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
    if (!response.ok) return setError(result.error || 'Не удалось обновить зону');
    await loadBootstrap();
  }

  async function deleteZone(id: string) {
    if (isGuestMode()) { setZones((current) => current.filter((zone) => zone.id !== id)); return; }
    const response = await fetch(`/api/zones/${id}`, { method: 'DELETE', headers: authHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError(result.error || 'Не удалось удалить зону');
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
    if (!response.ok) return setError(result.error || 'Не удалось обновить вишлист');
    await loadBootstrap();
  }

  async function deleteWishlistItem(id: string) {
    if (isGuestMode()) { setWishlist((current) => current.filter((item) => item.id !== id)); return; }
    const response = await fetch(`/api/wishlist/${id}`, { method: 'DELETE', headers: authHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError(result.error || 'Не удалось удалить позицию');
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
    if (!response.ok) return setError(result.error || 'Не удалось обновить напоминание');
    await loadBootstrap();
  }

  async function deleteReminder(id: string) {
    if (isGuestMode()) { setReminders((current) => current.filter((reminder) => reminder.id !== id)); return; }
    const response = await fetch(`/api/reminders/${id}`, { method: 'DELETE', headers: authHeaders() });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return setError(result.error || 'Не удалось удалить напоминание');
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
    if (isGuestMode()) { setReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, snoozedUntil } : reminder)); return; }
    const response = await fetch(`/api/reminders/${id}/snooze`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ snoozedUntil }) });
    if (!response.ok) return setError('Не удалось отложить напоминание');
    await loadBootstrap();
  }

  async function askAssistant(preset?: string) {
    const question = (preset || assistantQuestion).trim();
    if (!question) return setError('Напиши вопрос ассистенту.');
    if (!profile.backendPetId) {
      if (!isGuestMode()) return setError('Сначала сохрани профиль собаки — ассистенту нужен контекст.');
      ensureGuestPetId();
    }
    setAssistantLoading(true); setError('');
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
    if (!response.ok) return setError(result.error || 'Псё не ответил');
    setAssistantQuestion(question);
    setAssistantAnswer(result.answer || 'Нет ответа');
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

  if (onboardingStage !== 'done') return (
    <main className="app-canvas onboarding-canvas">
      <section className="phone-shell onboarding-shell">
        {onboardingStage === 'intro' && <section className="onboarding-screen hero-intro">
          <div className="hero-copy">
            <p className="eyebrow">Псё · всё про пса</p>
            <h1>Своё место для всего важного.</h1>
            <p>Профиль, места, записи и вещи — коротко, спокойно, без лишнего.</p>
          </div>
          <div className="hero-product-shot passport-shot" aria-label="Превью паспорта собаки">
            <div className="shot-toolbar"><span /> <b>Профиль</b><i>QR</i></div>
            <div className="shot-hero-row">
              <GeneratedAvatar profile={profile} ready demo size="large" />
              <div><small>публичная карточка</small><b>{profile.dogName || 'Мята'}</b><p>можно знакомиться · боится самокатов</p></div>
            </div>
            <div className="passport-note"><b>Как общаться</b><p>Сначала спросить владельца. Подходить сбоку, без резких движений. Не давать еду.</p></div>
            <div className="shot-grid"><span>QR</span><span>SOS</span><span>догситтеру</span></div>
          </div>
          <div className="hero-actions">
            <button className="primary full" onClick={startHeroFlow}>Добавить пса</button>
            <button className="secondary full" onClick={seedDemoExperience}>Открыть пример</button>
          </div>
          <button className="ghost-link" onClick={() => completeOnboarding('passport')}>заполнить вручную</button>
        </section>}

        {onboardingStage === 'photo' && <section className="onboarding-screen">
          <p className="eyebrow">шаг 1 / фото</p>
          <h2>Добавь фото</h2>
          <p>Фото помогает узнавать пса. Можно пропустить и вернуться позже.</p>
          <label className="photo-drop"><input type="file" accept="image/*" multiple onChange={handlePhotos} /><span>{hasPhoto ? 'Фото выбрано · можно дальше' : 'Выбрать фото'}</span></label>
          {hasPhoto && <GeneratedAvatar profile={profile} ready imageUrl={profile.avatarImageUrl || profile.photos[0]?.dataUrl} size="large" />}
          <button className="primary full" onClick={() => setOnboardingStage('style')}>{hasPhoto ? 'Дальше к профилю' : 'Продолжить без фото'}</button>
          <button className="secondary full" onClick={skipHeroPhoto}>Заполнить сначала текст</button>
        </section>}

        {onboardingStage === 'style' && <section className="onboarding-screen">
          <p className="eyebrow">шаг 2 / минимум</p>
          <h2>Что важно знать людям?</h2>
          <p>Для старта хватит имени и того, как с ним знакомиться. Остальное добавишь в профиле.</p>
          <input className="hero-name-input" value={heroNameDraft} onChange={(event) => setHeroNameDraft(event.target.value)} placeholder="Как зовут собаку?" />
          <div className="style-picker-grid passport-picker">
            <button className={profile.socialMode === 'можно знакомиться' ? 'active' : ''} onClick={() => updateProfile({ socialMode: 'можно знакомиться' })}><span>🐕</span><b>Можно знакомиться</b><small>но лучше спокойно и по одному</small></button>
            <button className={profile.socialMode === 'сначала спросить' ? 'active' : ''} onClick={() => updateProfile({ socialMode: 'сначала спросить' })}><span>✋</span><b>Сначала спросить</b><small>самый безопасный публичный вариант</small></button>
            <button className={profile.socialMode === 'лучше не подходить' ? 'active' : ''} onClick={() => updateProfile({ socialMode: 'лучше не подходить' })}><span>⚠️</span><b>Лучше не подходить</b><small>для тревожных, реактивных или болеющих собак</small></button>
          </div>
          <button className="primary full" onClick={() => { const nextName = heroNameDraft.trim(); if (nextName) updateProfile({ dogName: nextName }); setOnboardingStage('reveal'); }}>Собрать карточку</button>
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
          <div className="launch-next-grid"><button onClick={() => completeOnboarding('passport')}>🪪 Профиль</button><button onClick={() => completeOnboarding('today')}>● Псё</button><button onClick={() => window.open(publicCardHref, '_blank')}>↗︎ Карточка</button></div>
          <button className="primary full" onClick={() => { const id = ensureGuestPetId(); if (heroNameDraft.trim()) updateProfile({ dogName: heroNameDraft.trim(), backendPetId: id, isPublic: false }); completeOnboarding('passport'); }}>Довести профиль до нормального вида</button>
          <button className="secondary full" onClick={() => completeOnboarding('today')}>Открыть приложение</button>
        </section>}

        {error && <p className="error-text" role="alert">{error}</p>}
      </section>
    </main>
  );

  return (
    <main className="app-canvas">
      <section className={`phone-shell tab-${tab}`}>
        <header className="app-header">
          <div>{session?.user.email && <p>{session.user.email}</p>}<h1>{profile.dogName ? `Псё · ${profile.dogName}` : 'Псё'}</h1></div>
          {session ? <button onClick={signOut}>Выйти</button> : <button onClick={() => setTab(tab === 'passport' ? 'today' : 'passport')}>{tab === 'passport' ? 'Псё' : 'Профиль'}</button>}
        </header>

        <section className="dog-hero-card">
          <div className="hero-avatar-wrap"><GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" /></div>
          <div className="dog-main-info"><span>{selectedBreed.emoji} {breedLabel}</span><h2>{profile.dogName || 'Добавь имя'}</h2><p>{profile.bio || 'Профиль, места, записи и вещи в одном спокойном месте.'}</p></div>
          <button className="round-action" aria-label="Редактировать профиль собаки" onClick={() => setTab('passport')}>✎</button>
        </section>

        <nav className="app-tabs">
          {[
            ['today', '● Псё'], ['passport', '◇ Профиль'], ['map', '⌖ Места'], ['assistant', '✦ Ассистент'], ['shop', '□ Вещи'],
          ].map(([id, title]) => <button key={id} onClick={() => setTab(id as Tab)} className={tab === id ? 'active' : ''} aria-current={tab === id ? 'page' : undefined}>{title}</button>)}
        </nav>

        {tab === 'today' && <section className="screen-stack today-screen watercolor-today">
          <section className="watercolor-field-app" aria-label="Псё — всё важное про пса">
            <div className="watercolor-title">
              <h2>{profile.dogName || 'Что у нас сегодня'}</h2>
              <p>{profile.bio || `${breedLabel} · ${profile.socialMode || 'как знакомиться'} · ${profile.energyLevel || 'ритм дня'}`}</p>
            </div>

            <div className="watercolor-dog-orb">
              <GeneratedAvatar profile={profile} ready={avatarReady || Boolean(generatedAvatarUrl) || Boolean(profile.avatarImageUrl) || demoMode} imageUrl={generatedAvatarUrl || profile.avatarImageUrl} demo={!generatedAvatarUrl && !profile.avatarImageUrl && demoMode} size="small" />
            </div>

            <article className={`watercolor-note ${nextBestAction.reminderId ? 'warning' : ''}`}>
              <span>что важно</span>
              <h3>{nextBestAction.title}</h3>
              <p>{nextBestAction.caption}</p>
              <button onClick={() => nextBestAction.reminderId ? completeReminder(nextBestAction.reminderId) : nextBestAction.target === 'today' ? createReminder('Проверить уход', 'custom', 1) : setTab(nextBestAction.target)}>{nextBestAction.action}</button>
            </article>

            <button className="watercolor-map-spot" onClick={() => setTab('map')} aria-label="Открыть места">
              <span>⌖</span>
              <b>{zones[0]?.title || 'Места'}</b>
            </button>

            <button className="watercolor-ask" onClick={() => setTab('assistant')}>
              <b>Спросить Псё</b>
              <span>→</span>
            </button>

            <div className="watercolor-shelf" aria-label="Быстрые переходы">
              <button onClick={() => setTab('passport')}><b>{completionCount}/6</b><span>Профиль</span></button>
              <button onClick={() => createReminder()}><b>{activeReminders.length}</b><span>Напомнить</span></button>
              <button onClick={() => setTab('shop')}><b>{wantedWishlist.length}</b><span>Вещи</span></button>
            </div>
          </section>

          <section className="watercolor-below">
            <article className="watercolor-mini-action">
              <b>Добавить дело</b>
              <div className="quick-add"><input value={newReminderTitle} onChange={(event) => setNewReminderTitle(event.target.value)} placeholder="Корм, обработка, прогулка…" /><button aria-label="Добавить дело" onClick={() => createReminder()}>+</button></div>
            </article>
            {!profileReady && <article className="watercolor-mini-action quiet"><b>Псё узнаёт пса</b><p>{`Не хватает: ${missingProfileFields.slice(0, 3).join(', ') || '—'}`}</p><button className="secondary" onClick={() => setTab('passport')}>Уточнить данные</button></article>}
          </section>
        </section>}

        {tab === 'passport' && <WatercolorScreen className="profile-ux-2025" tone="gold" eyebrow="умный профиль" title={profile.dogName || 'Профиль пса'} caption={profileReady ? 'Минимум готов: Псё уже персонализирует подсказки, места и напоминания.' : `Следующий шаг: ${missingProfileFields[0] || 'сохранить профиль'}.`}>
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
              <div><b>{profileReady ? 'Карточка собрана' : 'Что дальше'}</b><p>{profileReady ? 'Можно проверить карточку для людей.' : missingProfileFields[0] || 'Сохранить профиль'}</p><button className="mini-next-action" onClick={() => document.querySelector<HTMLInputElement | HTMLSelectElement>('.profile-minimum-panel input, .profile-minimum-panel select')?.focus()}>{profileReady ? 'Проверить карточку' : 'Записать'}</button></div>
            </div>
          </section>

          <PaperSheet className="profile-minimum-panel">
            <div className="profile-panel-head"><span>01</span><div><b>Что важно знать</b></div></div>
            <div className="smart-field-grid">
              <label className="field-wide">Имя<input value={profile.dogName} onChange={(event) => updateProfile({ dogName: event.target.value })} placeholder="Имя собаки" /></label>
              <FieldSelect label="Возраст" value={profile.lifeStage} options={lifeStageOptions} onChange={(value) => updateProfile({ lifeStage: value })} />
              <FieldSelect label="Размер" value={profile.size} options={sizeOptions} onChange={(value) => updateProfile({ size: value })} />
              <FieldSelect label="Вакцины" value={profile.vaccineStatus} options={vaccineOptions} onChange={(value) => updateProfile({ vaccineStatus: value })} />
              <FieldSelect label="Обработка" value={profile.parasiteStatus} options={parasiteOptions} onChange={(value) => updateProfile({ parasiteStatus: value })} />
              <FieldSelect label="Как знакомиться" value={profile.socialMode} options={socialOptions} onChange={(value) => updateProfile({ socialMode: value })} />
              <FieldSelect label="Энергия" value={profile.energyLevel} options={energyOptions} onChange={(value) => updateProfile({ energyLevel: value })} />
            </div>
          </PaperSheet>

          <details className="profile-details smart-section" open><summary><span>02</span><div><b>Карточка для людей</b></div></summary>
            <div className="details-body public-card-composer">
              <label>Короткое био<input value={profile.bio} onChange={(event) => updateProfile({ bio: event.target.value })} placeholder="Спокойная, любит нюхать, боится самокатов" /></label>
              <label>Район без точного адреса<input value={profile.neighborhood} onChange={(event) => updateProfile({ neighborhood: event.target.value })} placeholder="например: Сокол / парк рядом" /></label>
              <article className="public-card-preview-smart">
                <div><small>публично</small><b>{profile.dogName.trim() || 'Моя собака'}</b><p>{profile.socialMode || 'сначала спросить владельца'}</p></div>
                <span>{profile.isPublic ? 'активна' : 'черновик'}</span>
              </article>
              <button className="secondary full" onClick={saveCard}>Обновить карточку</button>
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
              <div className="two-fields"><FieldSelect label="Темперамент" value={profile.temperament} options={temperamentOptions} onChange={(value) => updateProfile({ temperament: value })} /><FieldSelect label="Игра" value={profile.playStyle} options={playStyleOptions} onChange={(value) => updateProfile({ playStyle: value })} /></div>
              <div className="two-fields"><FieldSelect label="Дети" value={profile.childFriendly} options={friendlinessOptions} onChange={(value) => updateProfile({ childFriendly: value })} /><FieldSelect label="Собаки" value={profile.dogFriendly} options={friendlinessOptions} onChange={(value) => updateProfile({ dogFriendly: value })} /></div>
              <FieldSelect label="Кошки" value={profile.catFriendly} options={friendlinessOptions} onChange={(value) => updateProfile({ catFriendly: value })} />
              <label>Триггеры<input value={profile.triggers} onChange={(event) => updateProfile({ triggers: event.target.value })} placeholder="самокаты, гром, дети, лифт…" /></label>
              <label>Один дома<input value={profile.aloneTime} onChange={(event) => updateProfile({ aloneTime: event.target.value })} placeholder="как переносит одиночество" /></label>
            </div>
          </details>

          <details className="profile-details smart-section"><summary><span>06</span><div><b>Фото и заметки</b></div></summary>
            <div className="details-body">
              <div className="upload-inline"><label><input type="file" accept="image/*" multiple onChange={handlePhotos} /><span>{profile.avatarSource === 'uploaded' ? 'Фото уже аватар · заменить' : hasPhoto ? 'Фото выбрано · использовать как аватар' : 'Фото как аватар'}</span></label><button onClick={() => createAvatar()}>{avatarState === 'rendering' ? 'Генерирую…' : 'Стилизовать / сгенерировать'}</button></div>
              {doneReminders.length === 0 && <article className="empty-state"><b>Пока заметок нет</b><p>Первое наблюдение можно сохранить здесь.</p></article>}
              {doneReminders.length > 0 && <div className="reminder-list">{doneReminders.slice(0, 5).map((reminder) => <article key={reminder.id} className="reminder-card done"><div><b>{reminder.title}</b><p>{new Date(reminder.completedAt || reminder.dueAt).toLocaleDateString('ru-RU')} · готово</p></div><div><button onClick={() => updateReminder(reminder.id, { status: 'active' })}>Вернуть</button></div></article>)}</div>}
              <div className="wishlist-form"><textarea placeholder="Например: испугался самоката, хорошо прошла прогулка, была реакция на корм…" /><button className="secondary full" onClick={() => setError('Записи как отдельная история будут следующим шагом. Пока можно сохранить важное в заметках здоровья или напоминании.')}>Сохранить запись</button></div>
            </div>
          </details>
        </WatercolorScreen>}

        {tab === 'assistant' && <WatercolorScreen className="assistant-composition" tone="blue" eyebrow="ассистент" title="Спросить про уход" caption={profileReady ? 'Ответы по профилю собаки.' : `Профиль ${completionCount}/6 — начнём с осторожных подсказок.`} aside={<span className="watercolor-hero-mark">✦</span>}>
          <PaperSheet className="assistant-main-sheet"><div className="assistant-box"><textarea value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} placeholder="Что случилось или что планируем?" /><button className="primary full" onClick={() => askAssistant()} disabled={assistantLoading}>{assistantLoading ? 'Думаю…' : 'Спросить'}</button>{assistantAnswer && <div className="assistant-answer">{assistantAnswer}</div>}</div></PaperSheet>
          <div className="prompt-river">
            <TaskCard emoji="🎓" title="План воспитания" caption="подзыв, поводок, лай" action="План" onClick={() => askAssistant('Собери план воспитания на 7 дней с учётом профиля собаки')} />
            <TaskCard emoji="🩺" title="Здоровье" caption="что заметить и когда к врачу" action="Проверить" onClick={() => askAssistant('Сделай безопасную проверку здоровья: что наблюдать и какие красные флаги')} />
            <TaskCard emoji="🏡" title="Ритм дня" caption="прогулка, еда, отдых" action="Собрать" onClick={() => askAssistant('Собери режим дня: прогулка, нагрузка, еда, отдых и напоминания')} />
          </div>
        </WatercolorScreen>}

        {tab === 'map' && <WatercolorScreen className="places-composition" tone="green" eyebrow="места" title="Куда можно" caption="Места для прогулок, рисков и клиник." aside={<span className="watercolor-hero-mark">⌖</span>}>
          <section className="places-field">
            <PaperSheet className="map-sheet"><LiveMap zones={zones} picked={pickedZonePoint} onPick={setPickedZonePoint} /></PaperSheet>
            <FloatingNote className="map-help"><b>Добавь место</b><p>Сохраним примерно, без точного адреса.</p>{pickedZonePoint && <small>Выбрана точка: {pickedZonePoint.lat}, {pickedZonePoint.lng}</small>}</FloatingNote>
            <div className="care-actions place-chips"><button onClick={() => createZone({ title: 'Тихий двор для спокойной прогулки', type: 'safe_place', note: 'Без точного GPS, только памятка владельца.' })}>🟢 Тихое место</button><button onClick={() => createZone({ title: 'Зона риска: самокаты / шум', type: 'risk_zone', note: profile.triggers || 'Уточнить триггеры в паспорте.' })}>⚠️ Зона риска</button><button onClick={() => createZone({ title: 'Ветклиника', type: 'clinic', note: profile.vetClinic || 'Добавить контакт в паспорте.' })}>🏥 Ветклиника</button></div>
          </section>
          <FloatingNote className="place-add-note">
            <input value={newZoneTitle} onChange={(event) => setNewZoneTitle(event.target.value)} placeholder="Например: тихий двор, опасный перекрёсток, ветклиника" />
            <select value={newZoneType} onChange={(event) => setNewZoneType(event.target.value)}><option value="safe_place">безопасное место</option><option value="risk_zone">зона риска</option><option value="home_area">домашний район</option><option value="walk_route">маршрут</option><option value="clinic">клиника</option><option value="shop">зоомагазин</option><option value="grooming">груминг</option></select>
            <input value={newZoneNote} onChange={(event) => setNewZoneNote(event.target.value)} placeholder="Заметка: самокаты, тихо утром, хороший врач…" />
            <button className="primary full" onClick={() => createZone()}>{pickedZonePoint ? 'Сохранить место' : 'Сохранить место'}</button>
          </FloatingNote>
          {zones.length === 0 && <article className="empty-state"><b>Мест пока нет</b><p>Добавь клинику, парк или любое важное место.</p></article>}
          {zones.length > 0 && <div className="place-ribbon">{zones.map((zone) => <article key={zone.id} className={`zone-card ${zone.type}`}><div><b>{zone.title}</b><p>{zone.type} · ≈{zone.radius_meters || zone.radiusMeters || 500}м{zone.approximate_lat && zone.approximate_lng ? ` · ${zone.approximate_lat}, ${zone.approximate_lng}` : ' · без точки'}{zone.note ? ` · ${zone.note}` : ''}</p></div><div className="wishlist-actions"><button onClick={() => updateZone(zone.id, { type: zone.type === 'risk_zone' ? 'safe_place' : 'risk_zone' })}>{zone.type === 'risk_zone' ? 'Безопасно' : 'Риск'}</button>{pickedZonePoint && <button onClick={() => updateZone(zone.id, { approximateLat: pickedZonePoint.lat, approximateLng: pickedZonePoint.lng })}>Переставить</button>}<button onClick={() => updateZone(zone.id, { radiusMeters: (zone.radius_meters || zone.radiusMeters || 500) + 250 })}>+радиус</button><button onClick={() => deleteZone(zone.id)}>Удалить</button></div></article>)}</div>}
        </WatercolorScreen>}


        {tab === 'shop' && <WatercolorScreen className="things-composition" tone="rose" eyebrow="вещи" title="Его вещи" caption="Корм, лекарства и всё нужное." aside={<span className="watercolor-hero-mark">□</span>}>
          <FloatingNote className="thing-capture">
            <input value={newWishTitle} onChange={(event) => setNewWishTitle(event.target.value)} placeholder="Например: адресник, корм, игрушка, щётка…" />
            <select value={newWishCategory} onChange={(event) => setNewWishCategory(event.target.value)}><option value="gear">амуниция</option><option value="food">корм</option><option value="treats">лакомства</option><option value="toy">игрушки</option><option value="health">здоровье</option><option value="grooming">груминг</option><option value="course">курс</option><option value="service">сервис</option><option value="other">другое</option></select>
            <input value={newWishReason} onChange={(event) => setNewWishReason(event.target.value)} placeholder="Зачем это собаке?" />
            <button className="primary full" onClick={() => createWishlistItem()}>Добавить предмет</button>
          </FloatingNote>
          {wishlistHints.length > 0 && <div className="things-hint-shelf">{wishlistHints.map((hint) => <article key={hint.title}><span>💡</span><div><b>{hint.title}</b><p>{hint.reason}</p><button onClick={() => createWishlistItem(hint)}>Добавить</button></div></article>)}</div>}
          {wantedWishlist.length === 0 && wishlistHints.length === 0 && <article className="empty-state"><b>Пока вещей нет</b><p>Запишем корм, лекарства и всё нужное.</p></article>}
          {wantedWishlist.length > 0 && <div className="things-masonry">{wantedWishlist.map((item) => <article key={item.id} className={`wishlist-item priority-${item.priority}`}><div><b>{item.title}</b><p>{item.category} · {item.priority}{item.reason ? ` · ${item.reason}` : ''}</p></div><div className="wishlist-actions">{item.url && <a href={item.url} target="_blank" rel="noreferrer">Открыть</a>}<button onClick={() => updateWishlistItem(item.id, { priority: item.priority === 'high' ? 'medium' : 'high' })}>{item.priority === 'high' ? 'Обычный' : 'Важно'}</button><button onClick={() => updateWishlistItem(item.id, { status: 'bought' })}>Куплено</button><button onClick={() => deleteWishlistItem(item.id)}>Удалить</button></div></article>)}</div>}
          {boughtWishlist.length > 0 && <details className="history-block"><summary>Куплено · {boughtWishlist.length}</summary><div className="wishlist-list">{boughtWishlist.slice(0, 5).map((item) => <article key={item.id} className="wishlist-item"><div><b>{item.title}</b><p>{item.category}{item.reason ? ` · ${item.reason}` : ''}</p></div><div className="wishlist-actions"><button onClick={() => updateWishlistItem(item.id, { status: 'wanted' })}>Вернуть</button><button onClick={() => deleteWishlistItem(item.id)}>Удалить</button></div></article>)}</div></details>}
        </WatercolorScreen>}

        {error && <p className="error-text" role="alert">{error}</p>}
        {notice !== 'idle' && <div className="toast" role="status" aria-live="polite">{notice === 'loaded' ? 'Данные загружены' : 'Профиль сохранён'}</div>}
      </section>

    </main>
  );
}
