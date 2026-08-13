export type IsoDateTime = string;
export type EntityId = string;
export type PsyoUserId = string;

export type ServiceReadinessState = 'ready' | 'partial' | 'blocked' | 'demo';

export type ServiceReadiness = {
  service: 'IdentityService' | 'ProfileService' | 'PetService' | 'ReadinessService';
  state: ServiceReadinessState;
  persisted: string[];
  localOnly: string[];
  blockedPromises: string[];
  privacyState: string;
  qaState: string;
};

export type ProblemJson = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  requestId?: string;
  meta?: Record<string, unknown>;
};

export type TelegramSessionDto = {
  psyoUserId: PsyoUserId;
  ownerId?: EntityId;
  authDate?: number;
  locale?: string;
  verifiedTelegramContact: { username: string | null };
  issuedAt: number;
  expiresAt: number;
};

export type TelegramSessionResponse = {
  service: 'IdentityService';
  mode: 'telegram';
  connected: true;
  session: TelegramSessionDto;
  readiness: ServiceReadiness;
};

export type ActionType = 'create_reminder' | 'add_wishlist' | 'add_map_note';

export interface ActionSuggestion {
  type: ActionType;
  humanLabel: string;
  payload: {
    title?: string;
    category?: string;
    dueDate?: string;
    note?: string;
  };
  safetyFlag?: 'vet_boundary' | null;
}

export interface AssistantResponse {
  answer: string;
  threadId?: string;
  actionSuggestions?: ActionSuggestion[];
}

export type PlanTier = 'free' | 'plus';

export interface Entitlements {
  tier: PlanTier;
  maxPets: number;
  aiActionsPerDay: number;
  advancedAnalytics: boolean;
  expiresAt: string | null;
}

export type CreatePetCommand = {
  dogName: string;
  breedId?: string;
  breedGroupId?: string;
  breedCustom?: string;
  sex?: string;
  lifeStage?: string;
  weight?: string | number;
  isPublic?: boolean;
  microchip?: string;
  vetClinic?: string;
  diet?: string;
  allergies?: string;
  medication?: string;
  healthNotes?: string;
  vaccineStatus?: string;
  parasiteStatus?: string;
  socialMode?: string;
  temperament?: string;
  energyLevel?: string;
  playStyle?: string;
  trainability?: string;
  childFriendly?: string;
  dogFriendly?: string;
  catFriendly?: string;
  triggers?: string;
  aloneTime?: string;
  backendPetId?: string;
  avatarImageUrl?: string;
  photoUrls?: string[];
};

export type PetProfileDto = {
  id: EntityId;
  name: string;
  species: 'dog';
  breedId?: string;
  breedGroupId?: string;
  publicSlug?: string;
  createdAt?: IsoDateTime;
  updatedAt?: IsoDateTime;
};

export type FirstReminderCommand = {
  title: string;
  dueAt: IsoDateTime;
  type?: 'vaccine' | 'parasite' | 'medication' | 'grooming' | 'food' | 'training' | 'vet' | 'custom';
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
};

export type CreatePetInput = {
  name: string;
  idempotencyKey: string;
};

export type CreatePetResult = {
  petId: string;
  created: boolean;
};

export type OnboardingActivationCommand = {
  profile: CreatePetCommand;
  firstReminder: FirstReminderCommand;
};

export function validateCreatePetInput(value: unknown): { ok: true; input: CreatePetInput } | { ok: false; error: ProblemJson } {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const name = String(source.name ?? '').trim();
  const idempotencyKey = String(source.idempotencyKey ?? '').trim();

  if (!name) {
    return { ok: false, error: problem('VALIDATION_FAILED', 400, 'Dog name is required', 'Provide the dog name.', { field: 'name' }) };
  }
  if (name.length > 80) {
    return { ok: false, error: problem('VALIDATION_FAILED', 400, 'Dog name is too long', 'Use no more than 80 characters.', { field: 'name' }) };
  }
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    return { ok: false, error: problem('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency key is required', 'Send an Idempotency-Key header containing 8-128 safe characters.', { field: 'idempotencyKey' }) };
  }

  return { ok: true, input: { name, idempotencyKey } };
}

export function problem(code: string, status: number, title: string, detail: string, meta?: Record<string, unknown>): ProblemJson {
  return {
    type: `https://errors.psyo.app/${code.toLowerCase().replaceAll('_', '-')}`,
    title,
    status,
    code,
    detail,
    meta,
  };
}

export function validateCreatePetCommand(value: unknown): { ok: true; command: CreatePetCommand } | { ok: false; error: ProblemJson } {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const profile = source.profile && typeof source.profile === 'object' ? source.profile as Record<string, unknown> : source;
  const dogName = String(profile.dogName ?? '').trim();
  if (!dogName) {
    return {
      ok: false,
      error: problem('VALIDATION_FAILED', 400, 'Dog name is required', 'ProfileService requires dogName before creating a pet profile.', {
        field: 'dogName',
      }),
    };
  }
  return {
    ok: true,
    command: {
      ...profile,
      dogName,
    } as CreatePetCommand,
  };
}

const reminderTypes = new Set(['vaccine', 'parasite', 'medication', 'grooming', 'food', 'training', 'vet', 'custom']);
const reminderRecurrences = new Set(['none', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']);

export function validateOnboardingActivationCommand(value: unknown): { ok: true; command: OnboardingActivationCommand } | { ok: false; error: ProblemJson } {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const parsedProfile = validateCreatePetCommand(source.profile);
  if (!parsedProfile.ok) return parsedProfile;

  const reminder = source.firstReminder && typeof source.firstReminder === 'object'
    ? source.firstReminder as Record<string, unknown>
    : {};
  const title = String(reminder.title ?? '').trim();
  const dueAt = String(reminder.dueAt ?? '').trim();
  const type = String(reminder.type ?? 'custom').trim();
  const recurrence = String(reminder.recurrence ?? 'none').trim();

  if (!title) {
    return { ok: false, error: problem('VALIDATION_FAILED', 400, 'First care reminder is required', 'Provide firstReminder.title.', { field: 'firstReminder.title' }) };
  }
  if (!dueAt || !Number.isFinite(Date.parse(dueAt))) {
    return { ok: false, error: problem('VALIDATION_FAILED', 400, 'Reminder time is invalid', 'Provide firstReminder.dueAt as an ISO date-time.', { field: 'firstReminder.dueAt' }) };
  }
  if (!reminderTypes.has(type)) {
    return { ok: false, error: problem('VALIDATION_FAILED', 400, 'Reminder type is invalid', 'Choose a supported firstReminder.type.', { field: 'firstReminder.type' }) };
  }
  if (!reminderRecurrences.has(recurrence)) {
    return { ok: false, error: problem('VALIDATION_FAILED', 400, 'Reminder recurrence is invalid', 'Choose a supported firstReminder.recurrence.', { field: 'firstReminder.recurrence' }) };
  }

  return {
    ok: true,
    command: {
      profile: parsedProfile.command,
      firstReminder: {
        title,
        dueAt: new Date(dueAt).toISOString(),
        type: type as FirstReminderCommand['type'],
        recurrence: recurrence as FirstReminderCommand['recurrence'],
      },
    },
  };
}
