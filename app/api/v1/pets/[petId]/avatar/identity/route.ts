import { NextResponse } from 'next/server';
import { avatarErrorResponse, getAvatarOwnerContext, requireOwnedPet } from '@/lib/server/avatarIdentity';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ petId: string }> }) {
  try {
    const { petId } = await params;
    const context = await getAvatarOwnerContext(request);
    await requireOwnedPet(context, petId);
    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (!['none', 'rollback'].includes(action)) return NextResponse.json({ error: 'INVALID_IDENTITY_ACTION' }, { status: 400 });

    let assetId: string | null = null;
    if (action === 'rollback') {
      const history = await context.supabase
        .from('pet_avatar_selections')
        .select('asset_id,source,activated_at')
        .eq('owner_id', context.ownerId)
        .eq('pet_id', petId)
        .order('activated_at', { ascending: false })
        .limit(10);
      if (history.error) return NextResponse.json({ error: 'AVATAR_HISTORY_READ_FAILED' }, { status: 500 });
      const current = history.data?.[0]?.asset_id ?? null;
      const previous = history.data?.find((entry, index) => index > 0 && entry.asset_id !== current);
      if (!previous) return NextResponse.json({ error: 'AVATAR_ROLLBACK_UNAVAILABLE' }, { status: 409 });
      assetId = previous.asset_id;
    }

    const activated = await context.supabase.rpc('activate_pet_avatar_for_owner', {
      p_owner_id: context.ownerId,
      p_pet_id: petId,
      p_asset_id: assetId,
    });
    if (activated.error) return NextResponse.json({ error: 'AVATAR_ACTIVATION_FAILED' }, { status: 500 });
    return NextResponse.json(activated.data);
  } catch (error) {
    const known = avatarErrorResponse(error);
    return NextResponse.json({ error: known.error }, { status: known.status });
  }
}
