export const socialScenarios = ['meet', 'walk', 'socialize', 'mating'] as const;
export const socialCities = ['moscow', 'saint_petersburg'] as const;

export type SocialScenario = typeof socialScenarios[number];
export type SocialCity = typeof socialCities[number];
export type SocialRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'blocked';
export type SocialRequestAction = 'accept' | 'reject' | 'cancel' | 'close' | 'block';
export type WalkPace = 'calm' | 'balanced' | 'active';

export type CoarseLocation = { lat: number; lng: number };

export type SocialProfile = {
  petId: string;
  discoverable: boolean;
  city: SocialCity;
  district: string | null;
  coarseLocation: CoarseLocation | null;
  scenarios: SocialScenario[];
};

export type SocialCandidateSource = {
  petId: string;
  ownerId: string;
  name: string;
  avatarUrl: string | null;
  lifeStage?: string | null;
  weightKg?: number | null;
  temperament?: string | null;
  energyLevel?: string | null;
  dogFriendly?: string | null;
  playStyle?: string | null;
  profile: SocialProfile;
};

export type SocialCandidate = {
  petId: string;
  name: string;
  avatarUrl: string | null;
  lifeStage: string | null;
  weightKg: number | null;
  temperament: string | null;
  energyLevel: string | null;
  dogFriendly: string | null;
  playStyle: string | null;
  city: SocialCity;
  district: string | null;
  scenarios: SocialScenario[];
  sharedScenarios: SocialScenario[];
  distance: 'до 5 км' | '5–10 км' | '10–15 км' | null;
  reasons: string[];
  contactVisibility: 'hidden_until_mutual_consent';
};

export type CandidateGroup = {
  nearby: SocialCandidate[];
  city: SocialCandidate[];
};

export type WalkSignal = {
  id: string;
  petId: string;
  name: string;
  avatarUrl: string | null;
  city: SocialCity;
  district: string | null;
  approximateLocation: CoarseLocation;
  privacyRadiusMeters: 700;
  startsAt: string;
  expiresAt: string;
  pace: WalkPace;
  note: string | null;
  temperament: string | null;
  dogFriendly: string | null;
  isMine: boolean;
  contactVisibility: 'hidden_until_mutual_consent';
};

export type WalkSignalInput = {
  petId: string;
  city: SocialCity;
  district: string | null;
  coarseLocation: CoarseLocation;
  startsAt: string;
  pace: WalkPace;
  note: string | null;
};

export type SocialContactBoundaryResult =
  | { ok: true }
  | { ok: false; code: 'TELEGRAM_CONTACT_SERVER_CONTROLLED'; field: 'telegramUsername' };

export type SocialContactRequest = {
  status: string;
  senderOwnerId: string;
  recipientOwnerId: string;
};

type ProfileValidationResult =
  | { ok: true; value: Omit<SocialProfile, 'petId'> }
  | { ok: false; code: string; field?: string };

const scenarioSet = new Set<string>(socialScenarios);
const citySet = new Set<string>(socialCities);
const forbiddenContactKeys = ['telegramUsername', 'telegram_username', 'telegramContact', 'telegram_contact'];
const forbiddenExactLocationKeys = ['exactLocation', 'exact_location', 'latitude', 'longitude', 'coordinates'];
const districtAddressMarkers = /(улица|ул\.|дом|д\.|корпус|квартира|кв\.|подъезд|строение|проспект|переулок|шоссе|набережная)/i;
const safeDistrictPattern = /^[А-ЯЁа-яё -]{2,50}$/;
const walkPaces = new Set<WalkPace>(['calm', 'balanced', 'active']);

function sourceRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? input as Record<string, unknown> : {};
}

function cleanText(value: unknown, max: number) {
  const cleaned = String(value ?? '').trim().replace(/\s+/g, ' ');
  return cleaned ? cleaned.slice(0, max) : null;
}

function cleanScenarios(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item).trim()).filter(Boolean))).slice(0, socialScenarios.length);
}

function finiteCoordinate(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A one-hundredth degree grid is deliberately approximate (roughly 0.6–1.1 km
 * in the supported cities). The raw device coordinate must never be retained.
 */
export function quantizeCoarseLocation(input: unknown): CoarseLocation | null {
  const source = sourceRecord(input);
  const lat = finiteCoordinate(source.lat);
  const lng = finiteCoordinate(source.lng);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  };
}

export function validateSocialContactBoundary(input: unknown): SocialContactBoundaryResult {
  const source = sourceRecord(input);
  if (forbiddenContactKeys.some((key) => key in source)) {
    return { ok: false, code: 'TELEGRAM_CONTACT_SERVER_CONTROLLED', field: 'telegramUsername' };
  }
  return { ok: true };
}

export function normalizeSocialProfileInput(input: unknown): ProfileValidationResult {
  const source = sourceRecord(input);
  const contactBoundary = validateSocialContactBoundary(input);
  if (!contactBoundary.ok) return contactBoundary;
  if (forbiddenExactLocationKeys.some((key) => key in source)) {
    return { ok: false, code: 'EXACT_LOCATION_FORBIDDEN', field: 'coarseLocation' };
  }

  const discoverable = source.discoverable === true;
  const city = String(source.city ?? '').trim();
  const scenarios = cleanScenarios(source.scenarios);
  if (!citySet.has(city)) return { ok: false, code: 'INVALID_CITY', field: 'city' };
  if (scenarios.some((scenario) => !scenarioSet.has(scenario))) {
    return { ok: false, code: 'INVALID_SCENARIOS', field: 'scenarios' };
  }
  if (discoverable && scenarios.length === 0) {
    return { ok: false, code: 'SCENARIO_REQUIRED_WHEN_DISCOVERABLE', field: 'scenarios' };
  }

  const hasCoarseLocation = source.coarseLocation !== undefined && source.coarseLocation !== null;
  const coarseLocation = hasCoarseLocation ? quantizeCoarseLocation(source.coarseLocation) : null;
  if (hasCoarseLocation && !coarseLocation) {
    return { ok: false, code: 'INVALID_COARSE_LOCATION', field: 'coarseLocation' };
  }

  const district = cleanText(source.district, 50);
  if (district && (!safeDistrictPattern.test(district) || /\d/.test(district) || districtAddressMarkers.test(district))) {
    return { ok: false, code: 'INVALID_DISTRICT', field: 'district' };
  }

  return {
    ok: true,
    value: {
      discoverable,
      city: city as SocialCity,
      district,
      coarseLocation,
      scenarios: scenarios as SocialScenario[],
    },
  };
}

export function normalizeWalkSignalInput(input: unknown, now = Date.now()):
  | { ok: true; value: WalkSignalInput & { expiresAt: string } }
  | { ok: false; code: string; field?: string } {
  const source = sourceRecord(input);
  const contactBoundary = validateSocialContactBoundary(input);
  if (!contactBoundary.ok) return contactBoundary;
  if (forbiddenExactLocationKeys.some((key) => key in source)) {
    return { ok: false, code: 'EXACT_LOCATION_FORBIDDEN', field: 'coarseLocation' };
  }
  const petId = String(source.petId ?? '').trim();
  const district = cleanText(source.district, 50);
  const coarseLocation = quantizeCoarseLocation(source.coarseLocation);
  const pace = String(source.pace ?? '').trim() as WalkPace;
  const startsAtMs = Date.parse(String(source.startsAt ?? ''));
  const note = cleanText(source.note, 180);
  if (!petId) return { ok: false, code: 'PET_ID_REQUIRED', field: 'petId' };
  if (district && (!safeDistrictPattern.test(district) || /\d/.test(district) || districtAddressMarkers.test(district))) {
    return { ok: false, code: 'INVALID_DISTRICT', field: 'district' };
  }
  if (!coarseLocation) return { ok: false, code: 'COARSE_LOCATION_REQUIRED', field: 'coarseLocation' };
  const city = socialCityForLocation(coarseLocation);
  if (!city) return { ok: false, code: 'INVALID_CITY', field: 'coarseLocation' };
  if (!walkPaces.has(pace)) return { ok: false, code: 'INVALID_PACE', field: 'pace' };
  if (!Number.isFinite(startsAtMs) || startsAtMs < now - 15 * 60 * 1000 || startsAtMs > now + 48 * 60 * 60 * 1000) {
    return { ok: false, code: 'INVALID_START_TIME', field: 'startsAt' };
  }
  const durationMs = startsAtMs <= now + 30 * 60 * 1000 ? 2 * 60 * 60 * 1000 : 3 * 60 * 60 * 1000;
  return { ok: true, value: {
    petId,
    city,
    district,
    coarseLocation,
    startsAt: new Date(startsAtMs).toISOString(),
    expiresAt: new Date(startsAtMs + durationMs).toISOString(),
    pace,
    note,
  } };
}

export function walkSignalFingerprint(input: WalkSignalInput & { expiresAt: string }) {
  return JSON.stringify({
    petId: input.petId,
    city: input.city,
    district: input.district,
    coarseLocation: input.coarseLocation,
    startsAt: input.startsAt,
    expiresAt: input.expiresAt,
    pace: input.pace,
    note: input.note,
  });
}

/** Deterministic display-only offset, bounded inside the disclosed 700 m area. */
export function blurredSignalLocation(id: string, location: CoarseLocation): CoarseLocation {
  let seed = 2166136261;
  for (const char of id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const angle = ((seed >>> 0) % 360) * Math.PI / 180;
  const meters = 180 + ((seed >>> 8) % 170);
  const latOffset = (meters * Math.sin(angle)) / 111_320;
  const lngOffset = (meters * Math.cos(angle)) / (111_320 * Math.max(0.2, Math.cos(location.lat * Math.PI / 180)));
  return { lat: Number((location.lat + latOffset).toFixed(5)), lng: Number((location.lng + lngOffset).toFixed(5)) };
}

export function distanceKm(left: CoarseLocation, right: CoarseLocation) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(right.lat - left.lat);
  const deltaLng = toRadians(right.lng - left.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(left.lat)) * Math.cos(toRadians(right.lat)) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const supportedCityBounds: Array<{ city: SocialCity; minLat: number; maxLat: number; minLng: number; maxLng: number }> = [
  { city: 'moscow', minLat: 55.45, maxLat: 56.05, minLng: 36.8, maxLng: 38.2 },
  { city: 'saint_petersburg', minLat: 59.65, maxLat: 60.25, minLng: 29.4, maxLng: 31.0 },
];

export function socialCityForLocation(location: CoarseLocation): SocialCity | null {
  const coarse = quantizeCoarseLocation(location);
  if (!coarse) return null;
  return supportedCityBounds.find((bounds) => coarse.lat >= bounds.minLat && coarse.lat <= bounds.maxLat
    && coarse.lng >= bounds.minLng && coarse.lng <= bounds.maxLng)?.city ?? null;
}

export function parseWalkSignalViewerSearch(searchParams: Pick<URLSearchParams, 'get'>): CoarseLocation | null {
  const rawLat = searchParams.get('lat');
  const rawLng = searchParams.get('lng');
  if (rawLat === null || rawLng === null || rawLat.trim() === '' || rawLng.trim() === '') return null;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export const walkSignalRadiusOptions = [3, 5, 10, 15] as const;

export function parseWalkSignalRadiusSearch(searchParams: Pick<URLSearchParams, 'get'>): number {
  const radiusKm = Number(searchParams.get('radiusKm'));
  return walkSignalRadiusOptions.includes(radiusKm as (typeof walkSignalRadiusOptions)[number]) ? radiusKm : 3;
}

export function normalizeWalkSignalViewerInput(input: unknown):
  | { ok: true; value: { city: SocialCity; location: CoarseLocation; radiusKm: number } }
  | { ok: false; code: 'VIEWER_LOCATION_REQUIRED' | 'CITY_NOT_SUPPORTED' } {
  const source = sourceRecord(input);
  const location = quantizeCoarseLocation(source.location);
  if (!location) return { ok: false, code: 'VIEWER_LOCATION_REQUIRED' };
  const city = socialCityForLocation(location);
  if (!city) return { ok: false, code: 'CITY_NOT_SUPPORTED' };
  const requestedRadius = Number(source.radiusKm);
  const radiusKm = walkSignalRadiusOptions.includes(requestedRadius as (typeof walkSignalRadiusOptions)[number]) ? requestedRadius : 3;
  return { ok: true, value: { city, location, radiusKm } };
}

export function filterWalkSignalsForViewer<T extends { ownerId: string; location: CoarseLocation; expiresAt: string }>(input: {
  rows: T[];
  viewerOwnerId: string;
  viewerLocation: CoarseLocation;
  radiusKm: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  return input.rows.filter((row) => Date.parse(row.expiresAt) > now
    && (row.ownerId === input.viewerOwnerId || distanceKm(input.viewerLocation, row.location) <= input.radiusKm));
}

function distanceLabel(km: number): SocialCandidate['distance'] {
  if (km <= 5) return 'до 5 км';
  if (km <= 10) return '5–10 км';
  return '10–15 км';
}

function candidateProjection(candidate: SocialCandidateSource, mine: SocialProfile, km: number | null): SocialCandidate {
  const sharedScenarios = mine.scenarios.filter((scenario) => candidate.profile.scenarios.includes(scenario));
  const sameDistrict = Boolean(mine.district && candidate.profile.district
    && mine.district.localeCompare(candidate.profile.district, 'ru', { sensitivity: 'base' }) === 0);
  const isNearby = km !== null && km <= 15;
  const reasons = [
    ...(isNearby ? [`${distanceLabel(km)} от вас`] : []),
    ...(sameDistrict ? ['Один район'] : []),
    'Совпадает цель знакомства',
  ];
  return {
    petId: candidate.petId,
    name: candidate.name,
    avatarUrl: candidate.avatarUrl,
    lifeStage: candidate.lifeStage ?? null,
    weightKg: candidate.weightKg ?? null,
    temperament: candidate.temperament ?? null,
    energyLevel: candidate.energyLevel ?? null,
    dogFriendly: candidate.dogFriendly ?? null,
    playStyle: candidate.playStyle ?? null,
    city: candidate.profile.city,
    district: candidate.profile.district,
    scenarios: candidate.profile.scenarios,
    sharedScenarios,
    distance: isNearby ? distanceLabel(km) : null,
    reasons,
    contactVisibility: 'hidden_until_mutual_consent',
  };
}

export function groupSocialCandidates(input: {
  mine: SocialProfile;
  candidates: SocialCandidateSource[];
  excludedOwnerIds?: ReadonlySet<string>;
}): CandidateGroup {
  const excluded = input.excludedOwnerIds ?? new Set<string>();
  if (!input.mine.discoverable) return { nearby: [], city: [] };

  const nearby: Array<{ item: SocialCandidate; km: number }> = [];
  const city: SocialCandidate[] = [];
  const seenPetIds = new Set<string>();
  for (const candidate of input.candidates) {
    if (seenPetIds.has(candidate.petId)) continue;
    seenPetIds.add(candidate.petId);
    const profile = candidate.profile;
    if (!profile.discoverable || profile.city !== input.mine.city || excluded.has(candidate.ownerId)) continue;
    if (!input.mine.scenarios.some((scenario) => profile.scenarios.includes(scenario))) continue;

    const km = input.mine.coarseLocation && profile.coarseLocation
      ? distanceKm(input.mine.coarseLocation, profile.coarseLocation)
      : null;
    const projected = candidateProjection(candidate, input.mine, km);
    if (km !== null && km <= 15) nearby.push({ item: projected, km });
    else city.push(projected);
  }

  nearby.sort((left, right) => left.km - right.km || left.item.name.localeCompare(right.item.name, 'ru'));
  city.sort((left, right) => {
    const leftSameDistrict = Boolean(input.mine.district && left.district
      && input.mine.district.localeCompare(left.district, 'ru', { sensitivity: 'base' }) === 0);
    const rightSameDistrict = Boolean(input.mine.district && right.district
      && input.mine.district.localeCompare(right.district, 'ru', { sensitivity: 'base' }) === 0);
    return Number(rightSameDistrict) - Number(leftSameDistrict) || left.name.localeCompare(right.name, 'ru');
  });
  return { nearby: nearby.map(({ item }) => item), city };
}

export function latestActiveRequestsByPetPair<T extends {
  sender_pet_id: string;
  recipient_pet_id: string;
  status: string;
  created_at: string;
}>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    if (row.status !== 'pending' && row.status !== 'accepted') continue;
    const pairKey = [row.sender_pet_id, row.recipient_pet_id].sort().join(':');
    const current = latest.get(pairKey);
    if (!current || Date.parse(row.created_at) > Date.parse(current.created_at)) latest.set(pairKey, row);
  }
  return [...latest.values()].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
}

export function canRevealTelegramContact(
  request: SocialContactRequest,
  viewerOwnerId: string,
  participantsAvailable = true,
  pairBlocked = false,
) {
  return participantsAvailable
    && !pairBlocked
    && request.status === 'accepted'
    && (viewerOwnerId === request.senderOwnerId || viewerOwnerId === request.recipientOwnerId);
}

export function principalsAgree(input: { bearerOwnerId?: string | null; sessionOwnerId?: string | null }) {
  return !(input.bearerOwnerId && input.sessionOwnerId && input.bearerOwnerId !== input.sessionOwnerId);
}

export type RequestTransitionResult =
  | { ok: true; status: SocialRequestStatus; replayed: boolean }
  | { ok: false; code: string };

export function transitionSocialRequest(input: {
  status: SocialRequestStatus;
  actor: 'sender' | 'recipient';
  action: SocialRequestAction;
}): RequestTransitionResult {
  const { status, actor, action } = input;
  const intended = action === 'accept' ? 'accepted'
    : action === 'reject' ? 'rejected'
      : action === 'cancel' || action === 'close' ? 'cancelled'
        : 'blocked';
  if (status === intended) return { ok: true, status, replayed: true };
  if (action === 'close') {
    return status === 'accepted'
      ? { ok: true, status: 'cancelled', replayed: false }
      : { ok: false, code: 'ACCEPTED_REQUEST_REQUIRED' };
  }
  if (status !== 'pending' && action !== 'block') return { ok: false, code: 'REQUEST_ALREADY_RESOLVED' };
  if ((action === 'accept' || action === 'reject') && actor !== 'recipient') {
    return { ok: false, code: 'RECIPIENT_ACTION_REQUIRED' };
  }
  if (action === 'cancel' && actor !== 'sender') return { ok: false, code: 'SENDER_ACTION_REQUIRED' };
  if (status === 'blocked') return { ok: true, status: 'blocked', replayed: true };
  return { ok: true, status: intended, replayed: false };
}

export function inviteAvailability(input: { expiresAt: string | Date; usedAt: string | Date | null; now?: Date }) {
  if (input.usedAt) return { ok: false as const, code: 'INVITE_GONE' as const };
  const expiresAt = input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= (input.now ?? new Date()).getTime()) {
    return { ok: false as const, code: 'INVITE_GONE' as const };
  }
  return { ok: true as const };
}
