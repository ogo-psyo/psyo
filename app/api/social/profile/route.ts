import { NextResponse } from 'next/server';
import { socialRequestContext, socialStorageError } from '@/lib/server/socialHttp';
import {
  mapSocialProfile,
  normalizeSocialProfileInput,
  requireOwnedPet,
  socialProfilePayload,
} from '@/lib/server/socialService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const petId = new URL(request.url).searchParams.get('petId');
  if (!petId) return NextResponse.json({ error: 'PET_ID_REQUIRED' }, { status: 400 });
  try {
    if (!await requireOwnedPet(context.supabase, context.ownerId, petId)) {
      return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });
    }
    const { data, error } = await context.supabase
      .from('social_discovery_profiles').select('*').eq('pet_id', petId).maybeSingle();
    if (error) return socialStorageError();
    return NextResponse.json({ profile: data ? mapSocialProfile(data) : null });
  } catch (error) {
    return socialStorageError(error);
  }
}

export async function PUT(request: Request) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => null);
  const petId = typeof body?.petId === 'string' ? body.petId : '';
  if (!petId) return NextResponse.json({ error: 'PET_ID_REQUIRED' }, { status: 400 });
  const normalized = normalizeSocialProfileInput(body);
  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.code, field: normalized.field }, { status: 400 });
  }
  try {
    if (!await requireOwnedPet(context.supabase, context.ownerId, petId)) {
      return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });
    }
    const { data, error } = await context.supabase
      .from('social_discovery_profiles')
      .upsert({ pet_id: petId, ...socialProfilePayload(normalized.value) })
      .select('*').single();
    if (error) return socialStorageError();
    return NextResponse.json({ profile: mapSocialProfile(data) });
  } catch (error) {
    return socialStorageError(error);
  }
}

export async function DELETE(request: Request) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const petId = new URL(request.url).searchParams.get('petId');
  if (!petId) return NextResponse.json({ error: 'PET_ID_REQUIRED' }, { status: 400 });
  try {
    if (!await requireOwnedPet(context.supabase, context.ownerId, petId)) {
      return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });
    }
    const { error } = await context.supabase
      .from('social_discovery_profiles')
      .update({ discoverable: false })
      .eq('pet_id', petId);
    if (error) return socialStorageError();
    return NextResponse.json({ petId, discoverable: false });
  } catch (error) {
    return socialStorageError(error);
  }
}
