import { NextResponse } from 'next/server';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { getRequestAuth } from '@/lib/server/auth';
import { getSupabaseAdmin } from '@/lib/server/supabase';
import { listPetDocuments, mapPetDocument, ownedPet, PET_DOCUMENT_MAX_BYTES, PET_DOCUMENT_MIME_TYPES } from '@/lib/server/petDocumentService';

import { uploadDocumentOnce } from '@/lib/server/documentLifecycle';
import { readCareIdempotencyKey } from '@/lib/server/careHttp';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function context(request: Request) {
  const auth = await getRequestAuth(request);
  const session = getAppSessionFromRequest(request);
  return { ownerId: auth.user?.id ?? session?.ownerId, supabase: getSupabaseAdmin() };
}

export async function GET(request: Request) {
  const { ownerId, supabase } = await context(request);
  const petId = new URL(request.url).searchParams.get('petId')?.trim() ?? '';
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  if (!petId) return NextResponse.json({ error: 'PET_REQUIRED' }, { status: 400 });
  try {
    const documents = await listPetDocuments(supabase, ownerId, petId);
    if (!documents) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ documents });
  } catch {
    return NextResponse.json({ error: 'DOCUMENTS_UNAVAILABLE' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { ownerId, supabase } = await context(request);
  if (!ownerId) return NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (!supabase) return NextResponse.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const petId = String(form?.get('petId') || '').trim();
  const title = String(form?.get('title') || '').trim();
  const clinic = String(form?.get('clinic') || '').trim();
  const documentDate = String(form?.get('documentDate') || '').trim();
  const kind = String(form?.get('kind') || 'analysis');
  const allowedKinds = new Set(['analysis', 'prescription', 'vaccination', 'other']);

  if (!petId || !title) return NextResponse.json({ error: 'PET_AND_TITLE_REQUIRED' }, { status: 400 });
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: 'FILE_REQUIRED' }, { status: 400 });
  if (!PET_DOCUMENT_MIME_TYPES.has(file.type)) return NextResponse.json({ error: 'FILE_TYPE_NOT_ALLOWED' }, { status: 415 });
  if (file.size > PET_DOCUMENT_MAX_BYTES) return NextResponse.json({ error: 'FILE_TOO_LARGE' }, { status: 413 });
  if (!(await ownedPet(supabase, ownerId, petId))) return NextResponse.json({ error: 'PET_NOT_FOUND' }, { status: 404 });

  const key = readCareIdempotencyKey(request);
  if (!key) return NextResponse.json({ error: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
  try {
    const document = await uploadDocumentOnce({ supabase, ownerId, petId, key,
      bytes: Buffer.from(await file.arrayBuffer()), metadata: {
        kind: allowedKinds.has(kind) ? kind : 'analysis', title, clinic: clinic || null,
        document_date: /^\d{4}-\d{2}-\d{2}$/.test(documentDate) ? documentDate : null,
        original_name: file.name, mime_type: file.type, size_bytes: file.size,
      },
    });
    return NextResponse.json({ document: mapPetDocument(document) }, { status: 201 });
  } catch (error) {
    const code = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    if (code.includes('IDEMPOTENCY_KEY_REUSED')) return NextResponse.json({ error: 'IDEMPOTENCY_KEY_REUSED' }, { status: 409 });
    if (code.includes('DOCUMENT_REMOVED')) return NextResponse.json({ error: 'DOCUMENT_REMOVED' }, { status: 409 });
    return NextResponse.json({ error: 'DOCUMENT_SAVE_PENDING' }, { status: 503 });
  }
}
