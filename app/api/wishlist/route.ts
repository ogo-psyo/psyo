import { NextResponse } from 'next/server';
import { demoModeResponse, getSupabaseAdmin } from '@/lib/server/supabase';
import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { linkRecommendationOutcome } from '@/lib/server/recommendations/domainOutcomeLink';
import { careMutationError, careRequestFingerprint, readCareIdempotencyKey } from '@/lib/server/careHttp';

export const runtime = 'nodejs';

const allowedCategories = new Set(['food', 'treats', 'toy', 'gear', 'health', 'grooming', 'course', 'service', 'other']);
const allowedPriorities = new Set(['low', 'medium', 'high']);

function mapWishlist(row: any) {
  return {
    id: row.id,
    petId: row.pet_id,
    title: row.title,
    category: row.category,
    reason: row.reason ?? undefined,
    url: row.url ?? undefined,
    priority: row.priority,
    status: row.status,
    plannedFor: row.planned_for ?? undefined,
    reminderId: row.reminder_id ?? undefined,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const petId = new URL(request.url).searchParams.get('petId');

  if (!supabase) {
    return NextResponse.json({ wishlist: [], ...demoModeResponse('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.') });
  }

  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });

  let query = supabase.from('wishlist_items').select('*, pets!inner(owner_id)').eq('pets.owner_id', ownerId).is('deleted_at', null).order('created_at', { ascending: false });
  if (petId) query = query.eq('pet_id', petId);
  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ wishlist: (data ?? []).map(mapWishlist), mode: 'supabase' });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? '').trim();
  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  const category = allowedCategories.has(body?.category) ? body.category : 'other';
  const priority = allowedPriorities.has(body?.priority) ? body.priority : 'medium';
  const plannedFor = typeof body?.plannedFor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.plannedFor)
    ? body.plannedFor
    : null;
  const dueAt = plannedFor && typeof body?.dueAt === 'string' && Number.isFinite(new Date(body.dueAt).getTime())
    ? body.dueAt
    : null;
  if (plannedFor && !dueAt) {
    return NextResponse.json({ error: 'dueAt is required for a planned wishlist item' }, { status: 400 });
  }
  const idempotencyKey = readCareIdempotencyKey(request, body);
  if (!idempotencyKey) {
    return NextResponse.json({ error: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Не удалось безопасно сохранить покупку. Повтори попытку.' }, { status: 400 });
  }
  if (!supabase) {
    const reminderId = plannedFor ? crypto.randomUUID() : undefined;
    return NextResponse.json({
      item: { id: crypto.randomUUID(), petId: body?.petId, title, category, reason: body?.reason || undefined, priority, status: 'wanted', plannedFor: plannedFor || undefined, reminderId },
      reminder: reminderId ? { id: reminderId, petId: body?.petId, type: category === 'food' ? 'food' : 'custom', title, dueAt, recurrence: 'none', status: 'active' } : null,
      ...demoModeResponse('Connect Supabase to persist wishlist items.'),
    }, { status: 201 });
  }

  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!body.petId) return NextResponse.json({ error: 'petId is required when Supabase is enabled' }, { status: 400 });

  const { data: pet, error: petError } = await supabase.from('pets').select('id').eq('id', body.petId).eq('owner_id', ownerId).single();
  if (petError || !pet) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

  const fingerprint = careRequestFingerprint({
    petId: body.petId,
    title,
    category,
    reason: String(body.reason ?? '').trim() || null,
    priority,
    plannedFor,
    dueAt,
  });
  let data: any;
  try {
    const result = await supabase.rpc('wishlist_create_plan_atomic', {
      p_owner_id: ownerId,
      p_idempotency_key: idempotencyKey,
      p_request_fingerprint: fingerprint,
      p_pet_id: body.petId,
      p_title: title,
      p_category: category,
      p_reason: String(body.reason ?? '').trim() || null,
      p_priority: priority,
      p_planned_for: plannedFor,
      p_due_at: dueAt,
      p_source: body.source === 'assistant' ? 'assistant' : 'manual_things',
    });
    if (result.error) throw result.error;
    data = result.data;
  } catch (error) {
    return careMutationError(error);
  }
  const recommendationId = typeof body.recommendationId === 'string' ? body.recommendationId.trim() : '';
  const recommendationOutcome = recommendationId && process.env.RECOMMENDATIONS_FOUNDATION_ENABLED === 'true'
    ? await linkRecommendationOutcome({
      supabase, ownerId, recommendationId, domainType: 'wishlist', domainId: data.item.id, result: 'completed',
      idempotencyKey,
      occurredAt: data.item.createdAt,
    })
    : undefined;
  return NextResponse.json({ ...data, ...(recommendationOutcome ? { recommendationOutcome } : {}) }, { status: 201 });
}
