import { NextResponse } from 'next/server';
import { socialRequestContext, socialStorageError } from '@/lib/server/socialHttp';
import { listCandidates } from '@/lib/server/socialService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const context = await socialRequestContext(request);
  if ('response' in context) return context.response;
  const petId = new URL(request.url).searchParams.get('petId');
  if (!petId) return NextResponse.json({ error: 'PET_ID_REQUIRED' }, { status: 400 });
  try {
    const result = await listCandidates(context.supabase, context.ownerId, petId);
    if ('code' in result) {
      return NextResponse.json(
        { error: result.code, nearby: [], city: [] },
        { status: result.code === 'PET_NOT_FOUND' ? 404 : 409 },
      );
    }
    return NextResponse.json({
      ...result.groups,
      contactVisibility: 'hidden_until_mutual_consent',
    });
  } catch (error) {
    return socialStorageError(error);
  }
}
