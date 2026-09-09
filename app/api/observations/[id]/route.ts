import { NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { careError, careMutationError, careRequestFingerprint, readCareIdempotencyKey } from '@/lib/server/careHttp';

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

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== 'object' || Array.isArray(body)) return careError('INVALID_BODY', 'Не удалось прочитать изменение записи.', 400);
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно сохранить запись.', 400);
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

  const hasAllMetrics = quickMetricTypes.every(key => Object.hasOwn(body, key));
  const metricPatch: Record<string, string> = {};
  for (const key of quickMetricTypes) {
    if (!Object.hasOwn(body, key)) continue;
    if (typeof body[key] !== 'string') return careError('INVALID_METRIC', 'Показатель должен быть текстом.', 400);
    const value = body[key].trim();
    // Clearing needs a complete reviewed snapshot to derive a consistent primary value.
    if (!value && !hasAllMetrics) return careError('INCOMPLETE_METRIC_CLEAR', 'Для изменения загрузите всю запись.', 400);
    metricPatch[key] = value;
  }
  if (Object.keys(metricPatch).length > 0) {
    patch.metadata = { ...(patch.metadata as Record<string, unknown> | undefined), ...metricPatch };
    if (body.type === undefined && body.value === undefined) {
      const primary = Object.entries(metricPatch).find(([, value]) => value);
      if (primary) { patch.type = primary[0]; patch.value = primary[1]; }
      else if (typeof body.note === 'string' && body.note.trim()) { patch.type = 'note'; patch.value = body.note.trim(); }
      else return careError('EMPTY_OBSERVATION', 'Оставьте текст или хотя бы один показатель.', 400);
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'NO_VALID_FIELDS' }, { status: 400 });

  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = getSupabaseAdmin();
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

  if (!ownerId) return careError('AUTH_REQUIRED', 'Откройте Псё из Telegram и попробуйте снова.', 401);

  const fingerprint = careRequestFingerprint({ id, patch });
  try {
    const { data, error } = await supabase.rpc('care_observation_atomic', {
      p_owner_id: ownerId, p_idempotency_key: idempotencyKey,
      p_request_fingerprint: fingerprint, p_action: 'update', p_target_id: id, p_patch: patch,
    });
    if (error) throw error;
    return NextResponse.json({ ...data, observation: data.observation?.pet_id ? mapObservation(data.observation) : data.observation });
  } catch (error) {
    return careMutationError(error);
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  if (!body || typeof body !== 'object' || Array.isArray(body)) return careError('INVALID_BODY', 'Не удалось прочитать изменение записи.', 400);
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) return careError('IDEMPOTENCY_KEY_REQUIRED', 'Не удалось безопасно убрать запись.', 400);
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;

  if (!supabase) return NextResponse.json({ ok: true, ...demoModeResponse('Connect Supabase to persist observations.') });
  if (!ownerId) return careError('AUTH_REQUIRED', 'Откройте Псё из Telegram и попробуйте снова.', 401);

  const fingerprint = careRequestFingerprint({ id });
  try {
    const { data, error } = await supabase.rpc('care_observation_atomic', {
      p_owner_id: ownerId, p_idempotency_key: idempotencyKey,
      p_request_fingerprint: fingerprint, p_action: 'delete', p_target_id: id, p_patch: {},
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return careMutationError(error);
  }
}
