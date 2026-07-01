import type { DogProfile } from './data';

export type PersistenceMode = 'empty' | 'local' | 'authenticated';
export type ReadinessLevel = 'ready' | 'partial' | 'blocked' | 'demo';

export type AppReadinessInput = {
  profile: DogProfile;
  isAuthenticated: boolean;
  profileReady: boolean;
  missingProfileFields: string[];
  remindersCount: number;
  zonesCount: number;
  wishlistCount: number;
  hasAssistantAnswer: boolean;
  demoMode: boolean;
};

export type ReadinessContract = {
  service: 'ReadinessService';
  persistenceMode: PersistenceMode;
  stage: ReadinessLevel;
  persisted: string[];
  localOnly: string[];
  blockedPromises: string[];
  privacyState: string;
  safetyState: string;
  qaState: string;
  nextUsefulAction: {
    title: string;
    detail: string;
    target: 'today' | 'passport' | 'map' | 'assistant' | 'shop';
  };
  services: {
    profile: ReadinessLevel;
    today: ReadinessLevel;
    reminders: ReadinessLevel;
    assistant: ReadinessLevel;
    map: ReadinessLevel;
    wishlist: ReadinessLevel;
    avatar: ReadinessLevel;
  };
};

export function buildAppReadiness(input: AppReadinessInput): ReadinessContract {
  const hasLocalPet = Boolean(input.profile.backendPetId);
  const persistenceMode: PersistenceMode = input.isAuthenticated ? 'authenticated' : hasLocalPet ? 'local' : 'empty';
  const localOnly = input.isAuthenticated ? [] : ['профиль', 'напоминания', 'места', 'вещи'];
  const persisted = input.isAuthenticated
    ? ['профиль', 'напоминания', 'места', 'вещи']
    : hasLocalPet
      ? ['локальный профиль в браузере']
      : [];

  const blockedPromises: string[] = [];
  if (!input.isAuthenticated) blockedPromises.push('синхронизация между устройствами', 'восстановление после очистки браузера');
  if (!input.profileReady) blockedPromises.push('точные подсказки по уходу');
  if (!input.profile.socialMode) blockedPromises.push('публичная карточка для знакомств');
  if (!input.profile.isOnMap) blockedPromises.push('видимость на карте для других владельцев');
  if (input.wishlistCount === 0) blockedPromises.push('персональный список вещей');

  const stage: ReadinessLevel = input.demoMode ? 'demo' : input.profileReady && input.isAuthenticated ? 'ready' : hasLocalPet || input.profileReady ? 'partial' : 'blocked';

  return {
    service: 'ReadinessService',
    persistenceMode,
    stage,
    persisted,
    localOnly,
    blockedPromises,
    privacyState: input.profile.isOnMap ? 'карта включена владельцем, точные адреса не публикуются' : 'карта приватна: собака не видна другим',
    safetyState: input.profileReady ? 'ассистент отвечает осторожно по профилю, без ветеринарных диагнозов' : 'ассистент ограничен: не хватает минимума профиля',
    qaState: 'локальный контракт проверяется smoke-тестом; production readiness требует отдельного smoke перед деплоем',
    nextUsefulAction: chooseNextUsefulAction(input),
    services: {
      profile: input.profileReady ? 'ready' : hasLocalPet ? 'partial' : 'blocked',
      today: input.profileReady || input.remindersCount > 0 ? 'partial' : 'blocked',
      reminders: input.isAuthenticated ? 'ready' : input.remindersCount > 0 ? 'demo' : 'partial',
      assistant: input.profileReady || input.hasAssistantAnswer ? 'partial' : 'blocked',
      map: input.profile.isOnMap ? 'partial' : 'blocked',
      wishlist: input.isAuthenticated && input.wishlistCount > 0 ? 'partial' : input.wishlistCount > 0 ? 'demo' : 'blocked',
      avatar: input.profile.avatarSource === 'generated' || input.profile.avatarSource === 'uploaded' ? 'partial' : input.demoMode ? 'demo' : 'blocked',
    },
  };
}

function chooseNextUsefulAction(input: AppReadinessInput): ReadinessContract['nextUsefulAction'] {
  if (!input.profile.dogName.trim()) {
    return { title: 'дать собаке имя', detail: 'без имени карточка и подсказки выглядят черновиком', target: 'passport' };
  }
  if (!input.profileReady) {
    return { title: 'закрыть минимум профиля', detail: `не хватает: ${input.missingProfileFields.slice(0, 3).join(', ')}`, target: 'passport' };
  }
  if (input.remindersCount === 0) {
    return { title: 'создать первое напоминание', detail: 'обработка, вакцина, корм или груминг', target: 'today' };
  }
  if (!input.profile.isOnMap) {
    return { title: 'решить приватность карты', detail: 'оставить приватно или включить видимость вручную', target: 'map' };
  }
  return { title: 'задать вопрос Псё', detail: 'профиль уже даёт достаточно контекста для осторожных подсказок', target: 'assistant' };
}
