import { NextResponse } from 'next/server';
import { inviteAvailability } from '@/lib/socialCore';
import { readIdempotencyKey, socialRequestContext, socialStorageError } from '@/lib/server/socialHttp';
import { consumeFriendInvite, hashInviteToken, requireOwnedPet } from '@/lib/server/socialService';

export const runtime = 'nodejs';

async function findInvite(request: Request, token: string) {
  const context = await socialRequestContext(request);
  if ('response' in context) return { ok: false as const, response: context.response };
  const { data, error } = await context.supabase
    .from('social_friend_invites')
    .select('id, inviter_owner_id, inviter_pet_id, scenario, expires_at, used_at, pets!social_friend_invites_inviter_pet_id_fkey(name, avatar_url)')
    .eq('token_hash', hashInviteToken(token))
    .maybeSingle();
  if (error) return { ok: false as const, response: socialStorageError() };
  if (!data || !inviteAvailability({ expiresAt: data.expires_at, usedAt: data.used_at }).ok) {
    return { ok: false as const, response: NextResponse.json({ error: 'INVITE_GONE' }, { status: 410 }) };
  }
  return { ok: true as const, ...context, invite: data };
}

export async function GET(request: Request, routeContext: { params: Promise<{ token: string }> }) {
  const { token } = await routeContext.params;
  const context = await findInvite(request, token);
  if (!context.ok) return context.response;
  const pet = Array.isArray(context.invite.pets) ? context.invite.pets[0] : context.invite.pets;
  return NextResponse.json({
    invite: {
      scenario: context.invite.scenario,
      pet: { name: pet?.name ?? null, avatarUrl: pet?.avatar_url ?? null },
      expiresAt: context.invite.expires_at,
    },
    contactVisibility: 'hidden_until_mutual_consent',
  });
}

export async function POST(request: Request, routeContext: { params: Promise<{ token: string }> }) {
  const { token } = await routeContext.params;
  const context = await findInvite(request, token);
  if (!context.ok) return context.response;
  const body = await request.json().catch(() => null);
  const recipientPetId = typeof body?.recipientPetId === 'string' ? body.recipientPetId : '';
  const idempotencyKey = readIdempotencyKey(request, body);
  if (!recipientPetId || !idempotencyKey) {
    return NextResponse.json({ error: !recipientPetId ? 'RECIPIENT_PET_ID_REQUIRED' : 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
  }
  try {
    if (!await requireOwnedPet(context.supabase, context.ownerId, recipientPetId)) {
      return NextResponse.json({ error: 'RECIPIENT_PET_NOT_FOUND' }, { status: 404 });
    }
    const matchRequest = await consumeFriendInvite({
      supabase: context.supabase,
      token,
      recipientOwnerId: context.ownerId,
      recipientPetId,
      idempotencyKey,
      verifiedContact: context.verifiedTelegramContact,
    });
    return NextResponse.json({
      request: { id: matchRequest.id, scenario: matchRequest.scenario, status: matchRequest.status },
      contactVisibility: 'hidden_until_mutual_consent',
    }, { status: 201 });
  } catch (error) {
    return socialStorageError(error);
  }
}
