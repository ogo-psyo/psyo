import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

const allowedTypes = new Set([
  'mood',
  'energy',
  'appetite',
  'stool',
  'sleep',
  'weight',
  'activity',
  'fear_trigger',
  'dog_reaction',
  'people_reaction',
  'walk',
  'training',
  'medication',
  'procedure',
  'symptom',
  'behavior_change',
  'note',
]);

const allowedSources = new Set(['manual', 'assistant', 'import', 'demo']);
const quickMetricTypes = ['mood', 'appetite', 'stool', 'energy'] as const;
type QuickMetricType = typeof quickMetricTypes[number];

function mapObservation(row: any) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  return {
    id: row.id,
    petId: row.pet_id,
    type: row.type,
    value: row.value,
    note: row.note ?? undefined,
    observedAt: row.observed_at,
    mood: typeof metadata.mood === 'string' ? metadata.mood : row.type === 'mood' ? row.value : undefined,
    appetite: typeof metadata.appetite === 'string' ? metadata.appetite : row.type === 'appetite' ? row.value : undefined,
    stool: typeof metadata.stool === 'string' ? metadata.stool : row.type === 'stool' ? row.value : undefined,
    energy: typeof metadata.energy === 'string' ? metadata.energy : row.type === 'energy' ? row.value : undefined,
    source: row.source,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed) || parsed < 1) return 50;
  return Math.min(Math.trunc(parsed), 100);
}

function quickMetricValue(body: any, key: QuickMetricType) {
  return typeof body?.[key] === 'string' && body[key].trim() ? body[key].trim() : null;
}

function normalizeObservationInput(body: any) {
  const metadata = body?.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? { ...body.metadata } : {};
  const metricEntries = quickMetricTypes
    .map((key) => [key, quickMetricValue(body, key)] as const)
    .filter((entry): entry is readonly [QuickMetricType, string] => Boolean(entry[1]));

  if (allowedTypes.has(body?.type) && typeof body?.value === 'string' && body.value.trim()) {
    for (const [key, value] of metricEntries) metadata[key] = value;
    return { type: body.type, value: body.value.trim(), metadata };
  }

  if (metricEntries.length > 0) {
    const [primaryType, primaryValue] = metricEntries[0];
    for (const [key, value] of metricEntries) metadata[key] = value;
    return { type: primaryType, value: primaryValue, metadata };
  }

  return null;
}

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const url = new URL(request.url);
  const petId = url.searchParams.get('petId');
  const type = url.searchParams.get('type');
  const since = parseDate(url.searchParams.get('since'));
  const until = parseDate(url.searchParams.get('until'));

  if (type && !allowedTypes.has(type)) return NextResponse.json({ error: 'INVALID_OBSERVATION_TYPE' }, { status: 400 });
  if (since === undefined || until === undefined) return NextResponse.json({ error: 'INVALID_DATE_FILTER' }, { status: 400 });
  if (!supabase) return NextResponse.json({ observations: [], ...demoModeResponse('Connect Supabase to persist observations.') });
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  let query = supabase
    .from('pet_observations')
    .select('*, pets!inner(owner_id)')
    .eq('pets.owner_id', ownerId)
    .order('observed_at', { ascending: false })
    .limit(parseLimit(url.searchParams.get('limit')));

  if (petId) query = query.eq('pet_id', petId);
  if (type) query = query.eq('type', type);
  if (since) query = query.gte('observed_at', since);
  if (until) query = query.lte('observed_at', until);

  const { data, error } = await query;
  if (error) {
    if (error.code === '42P01') return NextResponse.json({ observations: [], mode: 'supabase', warning: 'OBSERVATIONS_SCHEMA_NOT_READY' });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ observations: (data ?? []).map(mapObservation), mode: 'supabase' });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.petId) return NextResponse.json({ error: 'petId is required' }, { status: 400 });
  const input = normalizeObservationInput(body);
  if (!input) return NextResponse.json({ error: 'type/value or quick observation metrics are required' }, { status: 400 });

  const observedAt = body.observedAt || body.createdAt ? parseDate(body.observedAt || body.createdAt) : new Date().toISOString();
  if (!observedAt) return NextResponse.json({ error: 'INVALID_OBSERVED_AT' }, { status: 400 });

  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const source = allowedSources.has(body.source) ? body.source : 'manual';

  if (!supabase) {
    const now = new Date().toISOString();
    return NextResponse.json({
      observation: {
        id: crypto.randomUUID(),
        petId: body.petId,
        type: input.type,
        value: input.value,
        note: typeof body.note === 'string' ? body.note.trim() || undefined : undefined,
        observedAt,
        mood: input.metadata.mood,
        appetite: input.metadata.appetite,
        stool: input.metadata.stool,
        energy: input.metadata.energy,
        source: 'demo',
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      },
      ...demoModeResponse('Connect Supabase to persist observations.'),
    }, { status: 201 });
  }

  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const { data: pet, error: petError } = await supabase.from('pets').select('id').eq('id', body.petId).eq('owner_id', ownerId).single();
  if (petError || !pet) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

  const { data, error } = await supabase
    .from('pet_observations')
    .insert({
      pet_id: body.petId,
      type: input.type,
      value: input.value,
      note: typeof body.note === 'string' ? body.note.trim() || null : null,
      observed_at: observedAt,
      source,
      metadata: input.metadata,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ error: 'OBSERVATIONS_SCHEMA_NOT_READY' }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ observation: mapObservation(data), mode: 'supabase' }, { status: 201 });
}
