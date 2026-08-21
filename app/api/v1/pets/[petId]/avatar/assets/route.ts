import { NextResponse } from 'next/server';
import { rc1Config } from '@/lib/rc1';
import {
  avatarErrorResponse,
  getAvatarOwnerContext,
  requireOwnedPet,
  sanitizeAvatarImage,
  storePrivateAvatar,
} from '@/lib/server/avatarIdentity';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ petId: string }> }) {
  try {
    const { petId } = await params;
    const context = await getAvatarOwnerContext(request);
    const pet = await requireOwnedPet(context, petId);
    const result = await context.supabase
      .from('avatar_assets')
      .select('id,asset_type,source_kind,generation_mode,style_id,status,width,height,created_at,selected_at')
      .eq('owner_id', context.ownerId)
      .eq('pet_id', petId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (result.error) return NextResponse.json({ error: 'AVATAR_ASSET_READ_FAILED' }, { status: 500 });
    return NextResponse.json({
      petId,
      source: pet.avatar_source || 'none',
      activeAssetId: pet.active_avatar_asset_id || null,
      assets: (result.data || []).map((asset) => ({
        ...asset,
        renderUrl: `/api/v1/pets/${petId}/avatar/assets/${asset.id}/render`,
      })),
    });
  } catch (error) {
    const known = avatarErrorResponse(error);
    return NextResponse.json({ error: known.error }, { status: known.status });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ petId: string }> }) {
  try {
    if (!rc1Config.flags.uploads_enabled) return NextResponse.json({ error: 'UPLOADS_DISABLED' }, { status: 403 });
    const { petId } = await params;
    const context = await getAvatarOwnerContext(request);
    await requireOwnedPet(context, petId);
    const form = await request.formData().catch(() => null);
    const file = form?.get('photo');
    if (!(file instanceof File)) return NextResponse.json({ error: 'PHOTO_REQUIRED' }, { status: 400 });
    const image = await sanitizeAvatarImage(file);
    const claimed = await context.supabase.rpc('claim_avatar_upload_for_owner', {
      p_owner_id: context.ownerId,
      p_pet_id: petId,
      p_sha256: image.sha256,
      p_size_bytes: image.buffer.byteLength,
      p_hourly_limit: 12,
      p_daily_bytes_limit: 50 * 1024 * 1024,
      p_pet_draft_limit: 10,
    });
    if (claimed.error) {
      const message = claimed.error.message || '';
      if (message.includes('AVATAR_UPLOAD_RATE_LIMIT')) throw new Error('AVATAR_UPLOAD_RATE_LIMIT');
      if (message.includes('AVATAR_UPLOAD_STORAGE_LIMIT')) throw new Error('AVATAR_UPLOAD_STORAGE_LIMIT');
      if (message.includes('AVATAR_PET_DRAFT_LIMIT')) throw new Error('AVATAR_PET_DRAFT_LIMIT');
      throw new Error('AVATAR_UPLOAD_RESERVATION_FAILED');
    }
    if (claimed.data?.replayed && claimed.data?.assetId) {
      const existing = await context.supabase.from('avatar_assets')
        .select('id,status,width,height').eq('id', claimed.data.assetId)
        .eq('owner_id', context.ownerId).eq('pet_id', petId).is('deleted_at', null).maybeSingle();
      if (existing.data) return NextResponse.json({
        replayed: true,
        asset: { ...existing.data, source: 'uploaded', renderUrl: `/api/v1/pets/${petId}/avatar/assets/${existing.data.id}/render` },
      });
    }
    if (claimed.data?.inProgress) return NextResponse.json({ error: 'AVATAR_UPLOAD_IN_PROGRESS' }, { status: 409 });
    const reservationId = claimed.data?.reservationId;
    if (!reservationId) throw new Error('AVATAR_UPLOAD_RESERVATION_FAILED');
    const retentionUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const asset = await storePrivateAvatar({
      context,
      petId,
      ...image,
      kind: 'avatar_image',
      sourceKind: 'uploaded',
      retentionUntil,
    });
    const finalized = await context.supabase.rpc('finalize_avatar_upload_for_owner', {
      p_owner_id: context.ownerId,
      p_pet_id: petId,
      p_reservation_id: reservationId,
      p_asset_id: asset.id,
    });
    if (finalized.error) throw new Error('AVATAR_UPLOAD_FINALIZE_FAILED');
    return NextResponse.json({
      asset: {
        id: asset.id,
        source: 'uploaded',
        status: asset.status,
        width: asset.width,
        height: asset.height,
        renderUrl: `/api/v1/pets/${petId}/avatar/assets/${asset.id}/render`,
      },
    }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'AVATAR_UPLOAD_RATE_LIMIT') return NextResponse.json({ error: code }, { status: 429 });
    if (code === 'AVATAR_UPLOAD_STORAGE_LIMIT' || code === 'AVATAR_PET_DRAFT_LIMIT') return NextResponse.json({ error: code }, { status: 409 });
    const known = avatarErrorResponse(error);
    return NextResponse.json({ error: known.error }, { status: known.status });
  }
}
