import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecommendationEvidence } from '@/packages/recommendations/contracts';
import { distanceKm } from '@/lib/socialCore';

type Row = Record<string, unknown>;
type QueryResult<T> = { data: T; error: unknown };

type WithEvidence = { evidence: RecommendationEvidence };

export type RecommendationContextSnapshot = {
  petId: string;
  capturedAt: string;
  pet: {
    id: string;
    lifeStage?: string;
    weightKg?: number;
    breedId?: string;
    breedGroupId?: string;
  } & WithEvidence;
  passport: ({
    diet?: string;
    allergies?: string;
    medication?: string;
    healthNotes?: string;
    vaccineStatus?: string;
    parasiteStatus?: string;
  } & WithEvidence) | null;
  social: ({
    socialMode?: string;
    temperament?: string;
    energyLevel?: string;
    playStyle?: string;
    trainability?: string;
    childFriendly?: string;
    dogFriendly?: string;
    catFriendly?: string;
    triggers: string[];
  } & WithEvidence) | null;
  socialDiscovery: ({
    discoverable: boolean;
    city: string;
    scenarios: string[];
    hasCoarseLocation: boolean;
    ownSignalActive: boolean;
  } & WithEvidence) | null;
  socialRequests: Array<{
    id: string;
    scenario: string;
    source: string;
    status: string;
    createdAt: string;
  } & WithEvidence>;
  walkSignals: Array<{
    id: string;
    petId: string;
    name: string;
    startsAt: string;
    expiresAt: string;
    pace: string;
    temperament?: string;
    dogFriendly?: string;
  } & WithEvidence>;
  reminders: Array<{
    id: string;
    type: string;
    title: string;
    dueAt: string;
    snoozedUntil?: string;
    status: string;
  } & WithEvidence>;
  observations: Array<{
    id: string;
    type: string;
    observedAt: string;
    source: string;
    sufficient: boolean;
    value?: string;
  } & WithEvidence>;
  habits: Array<{
    id: string;
    kind: string;
    title: string;
    cadence: string;
    targetPerPeriod: number;
    status: string;
  } & WithEvidence>;
  zones: Array<{
    id: string;
    type: string;
    title: string;
    areaLabel?: string;
    note?: string;
  } & WithEvidence>;
  wishlist: Array<{
    id: string;
    title: string;
    category: string;
    reason?: string;
    priority: string;
    status: string;
  } & WithEvidence>;
  facts: RecommendationEvidence[];
};

function row(value: unknown): Row | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}

function rows(value: unknown): Row[] {
  if (!Array.isArray(value)) return [];
  const result: Row[] = [];
  for (const item of value) {
    const mapped = row(item);
    if (mapped) result.push(mapped);
  }
  return result;
}

function nestedRow(value: unknown): Row | null {
  if (Array.isArray(value)) return row(value[0]);
  return row(value);
}

function text(value: unknown, limit = 160): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, limit) : undefined;
}

function iso(value: unknown): string | undefined {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

function number(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((item) => text(item, 80) ?? []).slice(0, 20) : [];
}

function evidence(input: Omit<RecommendationEvidence, 'capturedAt'>, capturedAt: string): RecommendationEvidence {
  return { ...input, capturedAt };
}

function throwQueryError(result: QueryResult<unknown>) {
  if (result.error) throw result.error;
}

export async function loadRecommendationContext(input: {
  supabase: SupabaseClient;
  ownerId: string;
  petId: string;
  now: Date;
}): Promise<RecommendationContextSnapshot> {
  const capturedAt = input.now.toISOString();
  const petResult = await input.supabase
    .from('pets')
    .select('id,owner_id,life_stage,weight_kg,breed_id,breed_group_id')
    .eq('id', input.petId)
    .eq('owner_id', input.ownerId)
    .maybeSingle() as unknown as QueryResult<Row | null>;
  throwQueryError(petResult);
  if (!petResult.data) throw new Error('PET_NOT_FOUND');

  const discoveryResult = await input.supabase.from('social_discovery_profiles')
    .select('pet_id,discoverable,city,scenarios,coarse_lat,coarse_lng,updated_at')
    .eq('pet_id', input.petId).maybeSingle() as unknown as QueryResult<Row | null>;
  throwQueryError(discoveryResult);
  const discoveryRow = row(discoveryResult.data);
  const discoveryCity = text(discoveryRow?.city, 40);

  const [passportResult, socialResult, remindersResult, observationsResult, habitsResult, zonesResult, wishlistResult,
    socialRequestsResult, blocksResult, reportsResult, walkSignalsResult] = await Promise.all([
    input.supabase.from('pet_passports')
      .select('pet_id,diet,allergies,medication,health_notes,vaccine_status,parasite_status,updated_at')
      .eq('pet_id', input.petId).maybeSingle(),
    input.supabase.from('social_profiles')
      .select('pet_id,social_mode,temperament,energy_level,play_style,trainability,child_friendly,dog_friendly,cat_friendly,triggers,updated_at')
      .eq('pet_id', input.petId).maybeSingle(),
    input.supabase.from('reminders')
      .select('id,type,title,due_at,snoozed_until,status,updated_at')
      .eq('pet_id', input.petId).neq('status', 'done'),
    input.supabase.from('pet_observations')
      .select('id,type,value,observed_at,source,metadata,updated_at')
      .eq('pet_id', input.petId).is('deleted_at', null)
      .order('observed_at', { ascending: false }).limit(20),
    input.supabase.from('pet_habits')
      .select('id,kind,title,cadence,target_per_period,status,created_at,updated_at')
      .eq('pet_id', input.petId).eq('status', 'active'),
    input.supabase.from('map_zones')
      .select('id,type,title,area_label,note,created_at,updated_at')
      .eq('pet_id', input.petId).eq('is_active', true).is('deleted_at', null),
    input.supabase.from('wishlist_items')
      .select('id,title,category,reason,priority,status,created_at,updated_at')
      .eq('pet_id', input.petId).is('deleted_at', null),
    input.supabase.from('social_match_requests')
      .select('id,sender_owner_id,sender_pet_id,recipient_owner_id,recipient_pet_id,scenario,source,signal_id,status,created_at,updated_at')
      .or(`sender_pet_id.eq.${input.petId},recipient_pet_id.eq.${input.petId}`).in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false }).limit(20),
    input.supabase.from('social_blocks').select('blocker_owner_id,blocked_owner_id')
      .or(`blocker_owner_id.eq.${input.ownerId},blocked_owner_id.eq.${input.ownerId}`),
    input.supabase.from('social_reports').select('reported_owner_id').eq('reporter_owner_id', input.ownerId),
    discoveryCity ? input.supabase.from('social_walk_signals')
      .select('id,owner_id,pet_id,city,coarse_lat,coarse_lng,starts_at,expires_at,pace,status,updated_at,pets!inner(name,social_profiles(temperament,dog_friendly))')
      .eq('city', discoveryCity).eq('status', 'active').gt('expires_at', capturedAt)
      .order('starts_at', { ascending: true }).limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]) as unknown as [
    QueryResult<Row | null>, QueryResult<Row | null>, QueryResult<Row[]>, QueryResult<Row[]>,
    QueryResult<Row[]>, QueryResult<Row[]>, QueryResult<Row[]>, QueryResult<Row[]>,
    QueryResult<Row[]>, QueryResult<Row[]>, QueryResult<Row[]>,
  ];
  for (const result of [passportResult, socialResult, remindersResult, observationsResult, habitsResult, zonesResult, wishlistResult,
    socialRequestsResult, blocksResult, reportsResult, walkSignalsResult]) {
    throwQueryError(result);
  }

  const petEvidence = evidence({ sourceType: 'profile', sourceId: input.petId, ownerConfirmed: true }, capturedAt);
  const pet = {
    id: String(petResult.data.id),
    lifeStage: text(petResult.data.life_stage, 40),
    weightKg: number(petResult.data.weight_kg),
    breedId: text(petResult.data.breed_id, 80),
    breedGroupId: text(petResult.data.breed_group_id, 80),
    evidence: petEvidence,
  };

  const passportRow = row(passportResult.data);
  const passport = passportRow ? {
    diet: text(passportRow.diet),
    allergies: text(passportRow.allergies),
    medication: text(passportRow.medication),
    healthNotes: text(passportRow.health_notes),
    vaccineStatus: text(passportRow.vaccine_status, 40),
    parasiteStatus: text(passportRow.parasite_status, 40),
    evidence: evidence({
      sourceType: 'passport', sourceId: input.petId, ownerConfirmed: true,
      updatedAt: iso(passportRow.updated_at),
    }, capturedAt),
  } : null;

  const socialRow = row(socialResult.data);
  const social = socialRow ? {
    socialMode: text(socialRow.social_mode, 40),
    temperament: text(socialRow.temperament, 80),
    energyLevel: text(socialRow.energy_level, 40),
    playStyle: text(socialRow.play_style, 80),
    trainability: text(socialRow.trainability, 40),
    childFriendly: text(socialRow.child_friendly, 40),
    dogFriendly: text(socialRow.dog_friendly, 40),
    catFriendly: text(socialRow.cat_friendly, 40),
    triggers: strings(socialRow.triggers),
    evidence: evidence({
      sourceType: 'profile', sourceId: `social:${input.petId}`, ownerConfirmed: true,
      updatedAt: iso(socialRow.updated_at),
    }, capturedAt),
  } : null;

  const discoveryLat = number(discoveryRow?.coarse_lat);
  const discoveryLng = number(discoveryRow?.coarse_lng);
  const discoveryLocation = discoveryLat !== undefined && discoveryLng !== undefined
    ? { lat: discoveryLat, lng: discoveryLng }
    : null;
  const excludedOwners = new Set<string>();
  for (const item of rows(blocksResult.data)) {
    const blocker = text(item.blocker_owner_id, 160);
    const blocked = text(item.blocked_owner_id, 160);
    if (blocker === input.ownerId && blocked) excludedOwners.add(blocked);
    if (blocked === input.ownerId && blocker) excludedOwners.add(blocker);
  }
  for (const item of rows(reportsResult.data)) {
    const reported = text(item.reported_owner_id, 160);
    if (reported) excludedOwners.add(reported);
  }
  const signalRows = rows(walkSignalsResult.data);
  const ownSignalActive = signalRows.some((item) => text(item.owner_id, 160) === input.ownerId
    && text(item.pet_id, 160) === input.petId
    && text(item.status, 40) === 'active'
    && (iso(item.expires_at) ? Date.parse(String(item.expires_at)) > input.now.getTime() : false));
  const discoveryEvidence = discoveryRow ? evidence({
    sourceType: 'profile', sourceId: `social-discovery:${input.petId}`, ownerConfirmed: true,
    updatedAt: iso(discoveryRow.updated_at),
  }, capturedAt) : null;
  const socialDiscovery = discoveryRow && discoveryCity ? {
    discoverable: discoveryRow.discoverable === true,
    city: discoveryCity,
    scenarios: strings(discoveryRow.scenarios),
    hasCoarseLocation: Boolean(discoveryLocation),
    ownSignalActive,
    evidence: discoveryEvidence!,
  } : null;

  const socialRequests = rows(socialRequestsResult.data).flatMap((item) => {
    const id = text(item.id, 160);
    const senderOwnerId = text(item.sender_owner_id, 160);
    const scenario = text(item.scenario, 40);
    const source = text(item.source, 40);
    const status = text(item.status, 40);
    const createdAt = iso(item.created_at);
    if (!id || !senderOwnerId || excludedOwners.has(senderOwnerId)
      || text(item.recipient_owner_id, 160) !== input.ownerId || text(item.recipient_pet_id, 160) !== input.petId
      || !scenario || !source || status !== 'pending' || !createdAt) return [];
    return [{ id, scenario, source, status, createdAt, evidence: evidence({
      sourceType: 'social_request', sourceId: id, observedAt: createdAt, ownerConfirmed: true,
      updatedAt: iso(item.updated_at),
    }, capturedAt) }];
  });

  const requestedSignalIds = new Set(rows(socialRequestsResult.data).flatMap((item) => {
    if (text(item.source, 40) !== 'signal' || text(item.sender_owner_id, 160) !== input.ownerId
      || text(item.sender_pet_id, 160) !== input.petId || !['pending', 'accepted'].includes(text(item.status, 40) ?? '')) return [];
    const signalId = text(item.signal_id, 160);
    return signalId ? [signalId] : [];
  }));

  const walkSignals = signalRows.flatMap((item) => {
    const id = text(item.id, 160);
    const ownerId = text(item.owner_id, 160);
    const petId = text(item.pet_id, 160);
    const city = text(item.city, 40);
    const lat = number(item.coarse_lat);
    const lng = number(item.coarse_lng);
    const startsAt = iso(item.starts_at);
    const expiresAt = iso(item.expires_at);
    const pace = text(item.pace, 40);
    const status = text(item.status, 40);
    const pet = nestedRow(item.pets);
    const traits = nestedRow(pet?.social_profiles);
    const name = text(pet?.name, 80);
    if (!discoveryLocation || !id || requestedSignalIds.has(id) || !ownerId || ownerId === input.ownerId || excludedOwners.has(ownerId)
      || !petId || city !== discoveryCity || lat === undefined || lng === undefined || !startsAt || !expiresAt
      || Date.parse(expiresAt) <= input.now.getTime() || !pace || status !== 'active' || !name
      || distanceKm(discoveryLocation, { lat, lng }) > 3) return [];
    return [{
      id, petId, name, startsAt, expiresAt, pace,
      temperament: text(traits?.temperament, 80), dogFriendly: text(traits?.dog_friendly, 40),
      evidence: evidence({
        sourceType: 'social_signal', sourceId: id, observedAt: startsAt, ownerConfirmed: true,
        updatedAt: iso(item.updated_at), excerpt: name,
      }, capturedAt),
    }];
  });

  const reminders = rows(remindersResult.data).flatMap((item) => {
    const id = text(item.id, 160);
    const type = text(item.type, 40);
    const title = text(item.title, 120);
    const dueAt = iso(item.due_at);
    const status = text(item.status, 40);
    if (!id || !type || !title || !dueAt || !status) return [];
    const reminderEvidence = evidence({
      sourceType: 'reminder', sourceId: id, ownerConfirmed: true, dueAt,
      updatedAt: iso(item.updated_at), excerpt: title,
    }, capturedAt);
    return [{ id, type, title, dueAt, snoozedUntil: iso(item.snoozed_until), status, evidence: reminderEvidence }];
  });

  const observations = rows(observationsResult.data).flatMap((item) => {
    const id = text(item.id, 160);
    const type = text(item.type, 40);
    const observedAt = iso(item.observed_at);
    const source = text(item.source, 40);
    if (!id || !type || !observedAt || !source) return [];
    const metadata = row(item.metadata) ?? {};
    const candidate = row(metadata.candidate) ?? {};
    const inferred = source === 'assistant';
    const ownerConfirmed = metadata.ownerConfirmed === true || candidate.confirmed === true;
    const inputConfidence = number(metadata.inputConfidence) ?? number(candidate.confidence);
    const excerpt = text(metadata.excerpt, 160) ?? text(candidate.transcriptSpan, 160);
    const sufficient = !inferred || (
      ownerConfirmed
      && inputConfidence !== undefined
      && inputConfidence >= 0.8
      && Boolean(excerpt)
    );
    const observationEvidence = evidence({
      sourceType: 'observation', sourceId: id, observedAt, updatedAt: iso(item.updated_at),
      ownerConfirmed: inferred ? ownerConfirmed : true,
      inputConfidence: inferred ? inputConfidence : undefined,
      excerpt: sufficient ? (inferred ? excerpt : text(item.value, 160)) : undefined,
    }, capturedAt);
    return [{
      id, type, observedAt, source, sufficient,
      value: sufficient ? text(item.value, 120) : undefined,
      evidence: observationEvidence,
    }];
  });

  const habits = rows(habitsResult.data).flatMap((item) => {
    const id = text(item.id, 160);
    const kind = text(item.kind, 40);
    const title = text(item.title, 120);
    const cadence = text(item.cadence, 40);
    const targetPerPeriod = number(item.target_per_period);
    const status = text(item.status, 40);
    if (!id || !kind || !title || !cadence || targetPerPeriod === undefined || !status) return [];
    return [{ id, kind, title, cadence, targetPerPeriod, status, evidence: evidence({
      sourceType: 'habit', sourceId: id, ownerConfirmed: true,
      updatedAt: iso(item.updated_at), excerpt: title,
    }, capturedAt) }];
  });

  const zones = rows(zonesResult.data).flatMap((item) => {
    const id = text(item.id, 160);
    const type = text(item.type, 40);
    const title = text(item.title, 120);
    if (!id || !type || !title) return [];
    return [{
      id, type, title, areaLabel: text(item.area_label, 120), note: text(item.note, 160),
      evidence: evidence({
        sourceType: 'map_zone', sourceId: id, ownerConfirmed: true,
        updatedAt: iso(item.updated_at) ?? iso(item.created_at), excerpt: title,
      }, capturedAt),
    }];
  });

  const wishlist = rows(wishlistResult.data).flatMap((item) => {
    const id = text(item.id, 160);
    const title = text(item.title, 120);
    const category = text(item.category, 40);
    const priority = text(item.priority, 40);
    const status = text(item.status, 40);
    if (!id || !title || !category || !priority || !status) return [];
    return [{
      id, title, category, reason: text(item.reason, 160), priority, status,
      evidence: evidence({
        sourceType: 'wishlist', sourceId: id, ownerConfirmed: true,
        updatedAt: iso(item.updated_at) ?? iso(item.created_at), excerpt: title,
      }, capturedAt),
    }];
  });

  const facts = [
    pet.evidence,
    ...(passport ? [passport.evidence] : []),
    ...(social ? [social.evidence] : []),
    ...(socialDiscovery ? [socialDiscovery.evidence] : []),
    ...socialRequests.map((item) => item.evidence),
    ...walkSignals.map((item) => item.evidence),
    ...reminders.map((item) => item.evidence),
    ...observations.map((item) => item.evidence),
    ...habits.map((item) => item.evidence),
    ...zones.map((item) => item.evidence),
    ...wishlist.map((item) => item.evidence),
  ];

  return {
    petId: input.petId, capturedAt, pet, passport, social,
    socialDiscovery, socialRequests, walkSignals,
    reminders, observations, habits, zones, wishlist, facts,
  };
}
