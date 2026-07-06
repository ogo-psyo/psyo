import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { normalizePublicDogCardFields, slugifyPublicDogCard } from '@/lib/server/publicDogCard';
import { getSupabaseAdmin } from '@/lib/server/supabase';

export const runtime = 'nodejs';

const allowedVisibility = new Set(['unlisted', 'public']);

function randomSuffix() {
  return crypto.randomUUID().slice(0, 8);
}

async function resolveOwnerPet(request: Request, petId: string) {
  const auth = await getRequestAuth(request);
  const appSession = getAppSessionFromRequest(request);
  const supabase = auth.supabase ?? getSupabaseAdmin();
  const ownerId = auth.user?.id ?? appSession?.ownerId;
  if (!supabase) return { error: NextResponse.json({ error: 'SUPABASE_REQUIRED' }, { status: 503 }) };
  if (!ownerId) return { error: NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 }) };

  const { data: pet, error: petError } = await supabase
    .from('pets')
    .select('id, owner_id, public_slug')
    .eq('id', petId)
    .eq('owner_id', ownerId)
    .single();
  if (petError || !pet) return { error: NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 }) };
  return { auth, appSession, supabase, ownerId, pet };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const petId = typeof body?.petId === 'string' ? body.petId : '';
  if (!petId) return NextResponse.json({ error: 'petId is required' }, { status: 400 });

  const context = await resolveOwnerPet(request, petId);
  if (context.error) return context.error;
  const { auth, supabase, pet } = context;

  const fields = normalizePublicDogCardFields(body?.fields && typeof body.fields === 'object' ? body.fields : {});
  const visibility = allowedVisibility.has(body?.visibility) ? body.visibility : 'unlisted';
  const baseSlug = slugifyPublicDogCard(String(pet.public_slug || fields.name));
  const regenerate = body?.regenerate === true;

  const existing = await supabase
    .from('dog_cards')
    .select('id, public_slug')
    .eq('pet_id', petId)
    .is('revoked_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (regenerate && existing.data?.id) {
    const { error: revokeError } = await supabase
      .from('dog_cards')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', existing.data.id);
    if (revokeError) return NextResponse.json({ error: revokeError.message }, { status: 500 });
  }

  const payload = {
    pet_id: petId,
    title: fields.name,
    subtitle: fields.breed,
    traits: fields.character ? [fields.character] : [],
    visibility,
    public_slug: !regenerate && existing.data?.public_slug ? existing.data.public_slug : `${baseSlug}-${randomSuffix()}`,
    fields,
    revoked_at: null,
  };

  const query = existing.data?.id && !regenerate
    ? supabase.from('dog_cards').update(payload).eq('id', existing.data.id).select('id, public_slug, visibility, updated_at').single()
    : supabase.from('dog_cards').insert(payload).select('id, public_slug, visibility, updated_at').single();
  const { data: card, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ card, path: `/dog/${card.public_slug}`, mode: auth.user ? 'user' : 'telegram' }, { status: existing.data?.id && !regenerate ? 200 : 201 });
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const url = new URL(request.url);
  const petId = typeof body?.petId === 'string' ? body.petId : url.searchParams.get('petId') || '';
  if (!petId) return NextResponse.json({ error: 'petId is required' }, { status: 400 });

  const context = await resolveOwnerPet(request, petId);
  if (context.error) return context.error;
  const { supabase } = context;
  const { data, error } = await supabase
    .from('dog_cards')
    .update({ revoked_at: new Date().toISOString() })
    .eq('pet_id', petId)
    .is('revoked_at', null)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ revoked: Array.isArray(data) ? data.length : 0 });
}
