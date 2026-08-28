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
  const localOnly = input.isAuthenticated ? [] : ['профиль и черновики этого браузера'];
  const persisted = input.isAuthenticated
    ? ['профиль', 'напоминания', 'места', 'вещи']
    : hasLocalPet
      ? ['локальный профиль в браузере']
      : [];

  const blockedPromises: string[] = [];
  if (!input.isAuthenticated) blockedPromises.push('синхронизация между устройствами', 'восстановление после очистки браузера');
  if (!input.profileReady) blockedPromises.push('точные подсказки по уходу');
  if (!input.profile.socialMode) blockedPromises.push('публичная карточка для знакомств');
  if (!input.isAuthenticated) blockedPromises.push('напоминания Telegram и совместные сценарии Гав');

  const stage: ReadinessLevel = input.demoMode ? 'demo' : input.profileReady && input.isAuthenticated ? 'ready' : hasLocalPet || input.profileReady ? 'partial' : 'blocked';

  return {
    service: 'ReadinessService',
    persistenceMode,
    stage,
    persisted,
    localOnly,
    blockedPromises,
    privacyState: 'точная геопозиция не публикуется; видимость в Гав управляется отдельно',
    safetyState: input.profileReady ? 'ассистент отвечает осторожно по профилю, без ветеринарных диагнозов' : 'ассистент ограничен: не хватает минимума профиля',
    qaState: 'локальный контракт проверяется smoke-тестом; production readiness требует отдельного smoke перед деплоем',
    nextUsefulAction: chooseNextUsefulAction(input),
    services: {
      profile: input.profileReady ? 'ready' : hasLocalPet ? 'partial' : 'blocked',
      today: input.profileReady || input.remindersCount > 0 ? 'partial' : 'blocked',
      reminders: input.isAuthenticated ? 'partial' : input.remindersCount > 0 ? 'demo' : 'blocked',
      assistant: input.profileReady || input.hasAssistantAnswer ? 'partial' : 'blocked',
      map: input.isAuthenticated ? 'partial' : input.zonesCount > 0 ? 'demo' : 'blocked',
      wishlist: input.isAuthenticated ? 'partial' : input.wishlistCount > 0 ? 'demo' : 'blocked',
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
  return { title: 'задать вопрос Псё', detail: 'профиль уже даёт достаточно контекста для осторожных подсказок', target: 'assistant' };
}
