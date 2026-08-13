export const socialScenarios = ['meet', 'walk', 'socialize', 'mating'] as const;
export const socialCities = ['moscow', 'saint_petersburg'] as const;

export type SocialScenario = typeof socialScenarios[number];
export type SocialCity = typeof socialCities[number];
export type SocialRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'blocked';
export type SocialRequestAction = 'accept' | 'reject' | 'cancel' | 'block';

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
  profile: SocialProfile;
};

export type SocialCandidate = {
  petId: string;
  name: string;
  avatarUrl: string | null;
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

  return {
    ok: true,
    value: {
      discoverable,
      city: city as SocialCity,
      district: cleanText(source.district, 100),
      coarseLocation,
      scenarios: scenarios as SocialScenario[],
    },
  };
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

function distanceLabel(km: number): SocialCandidate['distance'] {
  if (km <= 5) return 'до 5 км';
  if (km <= 10) return '5–10 км';
  return '10–15 км';
}

function candidateProjection(candidate: SocialCandidateSource, mine: SocialProfile, km: number | null): SocialCandidate {
  const sharedScenarios = mine.scenarios.filter((scenario) => candidate.profile.scenarios.includes(scenario));
  const sameDistrict = Boolean(mine.district && candidate.profile.district
    && mine.district.localeCompare(candidate.profile.district, 'ru', { sensitivity: 'base' }) === 0);
  const reasons = [
    ...(km !== null ? [`${distanceLabel(km)} от вас`] : []),
    ...(sameDistrict ? ['Один район'] : []),
    'Совпадает цель знакомства',
  ];
  return {
    petId: candidate.petId,
    name: candidate.name,
    avatarUrl: candidate.avatarUrl,
    city: candidate.profile.city,
    district: candidate.profile.district,
    scenarios: candidate.profile.scenarios,
    sharedScenarios,
    distance: km !== null && km <= 15 ? distanceLabel(km) : null,
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
  for (const candidate of input.candidates) {
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

export function canRevealTelegramContact(
  request: SocialContactRequest,
  viewerOwnerId: string,
  participantsAvailable = true,
) {
  return participantsAvailable
    && request.status === 'accepted'
    && (viewerOwnerId === request.senderOwnerId || viewerOwnerId === request.recipientOwnerId);
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
      : action === 'cancel' ? 'cancelled'
        : 'blocked';
  if (status === intended) return { ok: true, status, replayed: true };
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
