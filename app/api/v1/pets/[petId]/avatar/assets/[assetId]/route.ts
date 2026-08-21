import { NextResponse } from 'next/server';
import { avatarErrorResponse, getAvatarOwnerContext, requireOwnedPet } from '@/lib/server/avatarIdentity';

export const runtime = 'nodejs';

export async function DELETE(request: Request, { params }: { params: Promise<{ petId: string; assetId: string }> }) {
  try {
    const { petId, assetId } = await params;
    const context = await getAvatarOwnerContext(request);
    const pet = await requireOwnedPet(context, petId);
    if (pet.active_avatar_asset_id === assetId) return NextResponse.json({ error: 'ACTIVE_AVATAR_CANNOT_BE_DELETED' }, { status: 409 });
    const asset = await context.supabase
      .from('avatar_assets')
      .select('id,storage_bucket,storage_path')
      .eq('id', assetId).eq('pet_id', petId).eq('owner_id', context.ownerId).is('deleted_at', null).maybeSingle();
    if (asset.error) return NextResponse.json({ error: 'AVATAR_ASSET_READ_FAILED' }, { status: 500 });
    if (!asset.data) return NextResponse.json({ error: 'AVATAR_ASSET_NOT_FOUND' }, { status: 404 });
    if (asset.data.storage_bucket && asset.data.storage_path) {
      const removed = await context.supabase.storage.from(asset.data.storage_bucket).remove([asset.data.storage_path]);
      if (removed.error) return NextResponse.json({ error: 'AVATAR_STORAGE_DELETE_FAILED' }, { status: 500 });
    }
    const deleted = await context.supabase.from('avatar_assets')
      .update({ deleted_at: new Date().toISOString(), status: 'archived', storage_path: null })
      .eq('id', assetId).eq('pet_id', petId).eq('owner_id', context.ownerId);
    if (deleted.error) return NextResponse.json({ error: 'AVATAR_ASSET_DELETE_FAILED' }, { status: 500 });
    return NextResponse.json({ deletedAssetId: assetId });
  } catch (error) {
    const known = avatarErrorResponse(error);
    return NextResponse.json({ error: known.error }, { status: known.status });
  }
}
