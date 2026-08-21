import { NextResponse } from 'next/server';
import { avatarErrorResponse, getAvatarOwnerContext, requireOwnedPet } from '@/lib/server/avatarIdentity';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ petId: string; assetId: string }> }) {
  try {
    const { petId, assetId } = await params;
    const context = await getAvatarOwnerContext(request);
    await requireOwnedPet(context, petId);
    const result = await context.supabase
      .from('avatar_assets')
      .select('storage_bucket,storage_path,mime_type')
      .eq('id', assetId)
      .eq('pet_id', petId)
      .eq('owner_id', context.ownerId)
      .is('deleted_at', null)
      .maybeSingle();
    if (result.error) return NextResponse.json({ error: 'AVATAR_ASSET_READ_FAILED' }, { status: 500 });
    if (!result.data?.storage_bucket || !result.data.storage_path) return NextResponse.json({ error: 'AVATAR_ASSET_NOT_FOUND' }, { status: 404 });
    const downloaded = await context.supabase.storage.from(result.data.storage_bucket).download(result.data.storage_path);
    if (downloaded.error || !downloaded.data) return NextResponse.json({ error: 'AVATAR_ASSET_NOT_FOUND' }, { status: 404 });
    return new NextResponse(await downloaded.data.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': result.data.mime_type || 'image/jpeg',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const known = avatarErrorResponse(error);
    return NextResponse.json({ error: known.error }, { status: known.status });
  }
}
