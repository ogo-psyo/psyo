import { NextResponse } from 'next/server';
import { socialScenarios, type SocialScenario } from '@/lib/socialCore';
import { socialRequestContext, socialStorageError } from '@/lib/server/socialHttp';
import { createFriendInvite } from '@/lib/server/socialService';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const body = await request.json().catch(() => null);
  const petId = typeof body?.petId === 'string' ? body.petId : '';
  const scenario = typeof body?.scenario === 'string' ? body.scenario : '';
  if (!petId || !socialScenarios.includes(scenario as SocialScenario)) {
    return NextResponse.json({ error: 'INVALID_INVITE' }, { status: 400 });
  }
  try {
    const result = await createFriendInvite({
      supabase: context.supabase,
      ownerId: context.ownerId,
      petId,
      scenario: scenario as SocialScenario,
      verifiedContact: context.verifiedTelegramContact,
      expiresInHours: Number(body?.expiresInHours) || undefined,
    });
    if ('code' in result) {
      return NextResponse.json({ error: result.code }, { status: result.code === 'PET_NOT_FOUND' ? 404 : 409 });
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    return NextResponse.json({
      invite: {
        id: result.inviteId,
        token: result.token,
        expiresAt: result.expiresAt,
        url: appUrl ? `${appUrl.replace(/\/$/, '')}/?socialInvite=${encodeURIComponent(result.token)}` : null,
      },
    }, { status: 201 });
  } catch (error) {
    return socialStorageError(error);
  }
}
