import { NextResponse } from 'next/server';
import { avatarErrorResponse, getAvatarOwnerContext, requireOwnedPet } from '@/lib/server/avatarIdentity';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ petId: string; assetId: string }> }) {
  try {
    const { petId, assetId } = await params;
    const context = await getAvatarOwnerContext(request);
    await requireOwnedPet(context, petId);
    const asset = await context.supabase
      .from('avatar_assets')
      .select('id,source_kind,status')
      .eq('id', assetId)
      .eq('pet_id', petId)
      .eq('owner_id', context.ownerId)
      .is('deleted_at', null)
      .maybeSingle();
    if (asset.error) return NextResponse.json({ error: 'AVATAR_ASSET_READ_FAILED' }, { status: 500 });
    if (!asset.data || !['uploaded', 'generated'].includes(asset.data.source_kind)) return NextResponse.json({ error: 'AVATAR_ASSET_NOT_FOUND' }, { status: 404 });

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
