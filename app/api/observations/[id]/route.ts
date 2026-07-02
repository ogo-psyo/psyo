import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

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

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

async function ownedObservation(supabase: any, ownerId: string, id: string) {
  return supabase
    .from('pet_observations')
    .select('id, metadata, pets!inner(owner_id)')
    .eq('id', id)
    .eq('pets.owner_id', ownerId)
    .single();
}

function quickMetricValue(body: any, key: QuickMetricType) {
  return typeof body?.[key] === 'string' && body[key].trim() ? body[key].trim() : null;
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (body.type !== undefined) {
    if (!allowedTypes.has(body.type)) return NextResponse.json({ error: 'INVALID_OBSERVATION_TYPE' }, { status: 400 });
    patch.type = body.type;
  }
  if (body.value !== undefined) {
    if (typeof body.value !== 'string' || !body.value.trim()) return NextResponse.json({ error: 'value must not be empty' }, { status: 400 });
    patch.value = body.value.trim();
  }
  if (body.note !== undefined) {
    if (typeof body.note !== 'string') return NextResponse.json({ error: 'note must be a string' }, { status: 400 });
    patch.note = body.note.trim() || null;
  }
  if (body.observedAt !== undefined || body.createdAt !== undefined) {
    const observedAt = parseDate(body.observedAt ?? body.createdAt);
    if (!observedAt) return NextResponse.json({ error: 'INVALID_OBSERVED_AT' }, { status: 400 });
    patch.observed_at = observedAt;
  }
  if (body.source !== undefined) {
    if (!allowedSources.has(body.source)) return NextResponse.json({ error: 'INVALID_OBSERVATION_SOURCE' }, { status: 400 });
    patch.source = body.source;
  }
  if (body.metadata !== undefined) {
    if (!body.metadata || typeof body.metadata !== 'object' || Array.isArray(body.metadata)) return NextResponse.json({ error: 'metadata must be an object' }, { status: 400 });
    patch.metadata = body.metadata;
  }

  const metricPatch = quickMetricTypes.reduce<Record<string, string>>((acc, key) => {
    const value = quickMetricValue(body, key);
    if (value) acc[key] = value;
    return acc;
  }, {});
  if (Object.keys(metricPatch).length > 0) {
    patch.metadata = { ...(patch.metadata as Record<string, unknown> | undefined), ...metricPatch };
    if (body.type === undefined && body.value === undefined) {
      const [primaryType, primaryValue] = Object.entries(metricPatch)[0];
      patch.type = primaryType;
      patch.value = primaryValue;
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'NO_VALID_FIELDS' }, { status: 400 });

  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;

  if (!supabase) {
    return NextResponse.json({
      observation: {
        id,
        ...body,
        updatedAt: new Date().toISOString(),
      },
      ...demoModeResponse('Connect Supabase to persist observations.'),
    });
  }

  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const owned = await ownedObservation(supabase, ownerId, id);
  if (owned.error?.code === '42P01') return NextResponse.json({ error: 'OBSERVATIONS_SCHEMA_NOT_READY' }, { status: 503 });
  if (owned.error) return NextResponse.json({ error: 'OBSERVATION_NOT_FOUND' }, { status: 404 });
  if (patch.metadata) patch.metadata = { ...(owned.data.metadata ?? {}), ...(patch.metadata as Record<string, unknown>) };

  const { data, error } = await supabase.from('pet_observations').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ observation: mapObservation(data), mode: 'supabase' });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;

  if (!supabase) return NextResponse.json({ ok: true, ...demoModeResponse('Connect Supabase to persist observations.') });
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  const owned = await ownedObservation(supabase, ownerId, id);
  if (owned.error?.code === '42P01') return NextResponse.json({ error: 'OBSERVATIONS_SCHEMA_NOT_READY' }, { status: 503 });
  if (owned.error) return NextResponse.json({ error: 'OBSERVATION_NOT_FOUND' }, { status: 404 });

  const { error } = await supabase.from('pet_observations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
