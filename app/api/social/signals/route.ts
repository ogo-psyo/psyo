import { NextResponse } from 'next/server';
import { closeWalkSignal, listWalkSignals, normalizeWalkSignalInput, saveWalkSignal } from '@/lib/server/socialService';
import { socialRequestContext, socialStorageError } from '@/lib/server/socialHttp';
import { parseWalkSignalRadiusSearch, parseWalkSignalViewerSearch } from '@/lib/socialCore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function idempotencyKey(request: Request, body: any) {
  return request.headers.get('idempotency-key') || (typeof body?.idempotencyKey === 'string' ? body.idempotencyKey : '');
}

export async function GET(request: Request) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const url = new URL(request.url);
  const petId = url.searchParams.get('petId');
  const viewerLocation = parseWalkSignalViewerSearch(url.searchParams);
  const radiusKm = parseWalkSignalRadiusSearch(url.searchParams);
  if (!petId) return NextResponse.json({ error: 'PET_ID_REQUIRED' }, { status: 400 });
  try {
    const result = await listWalkSignals(context.supabase, context.ownerId, petId, viewerLocation, radiusKm);
    if ('code' in result) {
      const status = result.code === 'VIEWER_LOCATION_REQUIRED' || result.code === 'CITY_NOT_SUPPORTED' ? 409 : 404;
      return NextResponse.json({ error: result.code }, { status });
    }
    return NextResponse.json(result);
  } catch (error) {
    return socialStorageError(error);
  }
}

export async function PUT(request: Request) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => null);
  const key = idempotencyKey(request, body);
  if (key.length < 8 || key.length > 128) return NextResponse.json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
  const normalized = normalizeWalkSignalInput(body);
  if (!normalized.ok) return NextResponse.json({ error: normalized.code, field: normalized.field }, { status: 400 });
  try {
    const result = await saveWalkSignal({ supabase: context.supabase, ownerId: context.ownerId, value: normalized.value, idempotencyKey: key });
    if ('code' in result) return NextResponse.json({ error: result.code }, { status: result.code === 'PET_NOT_FOUND' ? 404 : 409 });
    return NextResponse.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return socialStorageError(error);
  }
}

export async function DELETE(request: Request) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => null);
  const petId = typeof body?.petId === 'string' ? body.petId : '';
  const status = body?.status === 'completed' ? 'completed' : body?.status === 'cancelled' ? 'cancelled' : null;
  if (!petId || !status) return NextResponse.json({ error: 'INVALID_SIGNAL_ACTION' }, { status: 400 });
  try {
    const result = await closeWalkSignal({ supabase: context.supabase, ownerId: context.ownerId, petId, status });
    if ('code' in result) return NextResponse.json({ error: result.code }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    return socialStorageError(error);
  }
}
