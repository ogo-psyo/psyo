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
