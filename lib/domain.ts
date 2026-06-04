export type EntityId = string;
export type ISODateString = string;

export type AppUser = {
  id: EntityId;
  email?: string;
  displayName?: string;
  createdAt: ISODateString;
};

export type Pet = {
  id: EntityId;
  ownerId: EntityId;
  name: string;
  species: 'dog';
  breedId?: string;
  breedGroupId?: string;
  customBreed?: string;
  sex?: string;
  lifeStage?: string;
  weightKg?: number;
  avatarUrl?: string;
  photoUrls: string[];
  publicSlug?: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type PetPassport = {
  petId: EntityId;
  microchip?: string;
  vetClinic?: string;
  vetContact?: string;
  diet?: string;
  allergies?: string;
  medication?: string;
  healthNotes?: string;
  vaccineStatus?: 'actual' | 'due_soon' | 'overdue' | 'unknown';
  parasiteStatus?: 'actual' | 'needs_reminder' | 'overdue' | 'unknown';
};

export type SocialProfile = {
  petId: EntityId;
  socialMode?: 'ok' | 'ask_first' | 'calm_dogs_only' | 'do_not_approach' | 'known_only';
  temperament?: string;
  energyLevel?: string;
  playStyle?: string;
  trainability?: string;
  childFriendly?: 'yes' | 'careful' | 'no' | 'unknown';
  dogFriendly?: 'yes' | 'careful' | 'no' | 'unknown';
  catFriendly?: 'yes' | 'careful' | 'no' | 'unknown';
  triggers?: string[];
  aloneTimeNote?: string;
};

export type Reminder = {
  id: EntityId;
  petId: EntityId;
  type: 'vaccine' | 'parasite' | 'medication' | 'grooming' | 'food' | 'training' | 'vet' | 'custom';
  title: string;
  dueAt: ISODateString;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  status: 'active' | 'done' | 'snoozed';
};

export type MapZone = {
  id: EntityId;
  petId: EntityId;
  type: 'home_area' | 'walk_route' | 'safe_place' | 'risk_zone' | 'clinic' | 'shop' | 'grooming';
  title: string;
  // Privacy-first: approximate center + radius, never exact default GPS.
  approximateCenter?: { lat: number; lng: number };
  radiusMeters?: number;
  note?: string;
};

export type WishlistItem = {
  id: EntityId;
  petId: EntityId;
  title: string;
  category: 'food' | 'treats' | 'toy' | 'gear' | 'health' | 'grooming' | 'course' | 'service' | 'other';
  reason?: string;
  url?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'wanted' | 'bought' | 'not_suitable';
};

export type AssistantThread = {
  id: EntityId;
  petId: EntityId;
  kind: 'training' | 'care' | 'health_triage' | 'shopping' | 'travel' | 'general';
  title: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type AppBootstrap = {
  user: AppUser;
  pet: Pet;
  passport: PetPassport;
  social: SocialProfile;
  reminders: Reminder[];
  zones: MapZone[];
  wishlist: WishlistItem[];
};
