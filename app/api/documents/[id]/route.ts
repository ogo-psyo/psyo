import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { PET_DOCUMENT_BUCKET } from '@/lib/server/petDocumentService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ownedDocument(request: Request, id: string) {
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  const ownerId = auth.user?.id ?? session?.ownerId;
  const supabase = getSupabaseAdmin();
  if (!ownerId || !supabase) return { ownerId, supabase, document: null };
  const result = await supabase
    .from('pet_documents')
    .select('*, pets!inner(owner_id)')
    .eq('id', id)
    .eq('pets.owner_id', ownerId)
    .maybeSingle();
  return { ownerId, supabase, document: result.data };
}

export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const { id } = await routeContext.params;
  const { ownerId, supabase, document } = await ownedDocument(request, id);
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  if (!document) return NextResponse.json({ error: 'DOCUMENT_NOT_FOUND' }, { status: 404 });
  const signed = await supabase.storage.from(document.storage_bucket || PET_DOCUMENT_BUCKET).createSignedUrl(document.storage_path, 60);
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: 'DOCUMENT_OPEN_FAILED' }, { status: 500 });
  return NextResponse.redirect(signed.data.signedUrl, 302);
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const { id } = await routeContext.params;
  const { ownerId, supabase, document } = await ownedDocument(request, id);
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  if (!document) return NextResponse.json({ error: 'DOCUMENT_NOT_FOUND' }, { status: 404 });
  const removed = await supabase.storage.from(document.storage_bucket || PET_DOCUMENT_BUCKET).remove([document.storage_path]);
  if (removed.error) return NextResponse.json({ error: 'DOCUMENT_DELETE_FAILED' }, { status: 500 });
  const deleted = await supabase.from('pet_documents').delete().eq('id', id);
  if (deleted.error) return NextResponse.json({ error: 'DOCUMENT_DELETE_FAILED' }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
