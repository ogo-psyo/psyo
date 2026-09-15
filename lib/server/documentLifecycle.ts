import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { careRequestFingerprint } from './careHttp';
import { PET_DOCUMENT_BUCKET } from './petDocumentService';

type DocumentRow = {
  id: string; pet_id: string; storage_path: string; storage_bucket: string;
  lifecycle: 'pending' | 'ready' | 'deleting' | 'deleted';
  content_sha256: string | null; lifecycle_updated_at: string;
  [key: string]: unknown;
};
export const documentContentHash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export async function uploadDocumentOnce(input: {
  supabase: SupabaseClient; ownerId: string; petId: string; key: string;
  bytes: Uint8Array; metadata: { kind: string; title: string; clinic: string | null; document_date: string | null; original_name: string; mime_type: string; size_bytes: number };
}) {
  const { supabase, ownerId, petId, key, bytes, metadata } = input;
  const hash = documentContentHash(bytes);
  const reserved = await supabase.rpc('reserve_pet_document_upload', {
    p_owner_id: ownerId, p_pet_id: petId, p_key: key,
    p_fingerprint: careRequestFingerprint({ petId, metadata, hash }), p_content_sha256: hash, p_metadata: metadata,
  });
  if (reserved.error) throw reserved.error;
  const row = reserved.data as DocumentRow;
  if (row.lifecycle === 'ready') return row;
  const bucket = supabase.storage.from(PET_DOCUMENT_BUCKET);
  const uploaded = await bucket.upload(row.storage_path, bytes, { contentType: metadata.mime_type, upsert: false });
  if (uploaded.error) {
    // A lost upload response or simultaneous retry may mean the file exists.
    // Never treat an arbitrary storage error or different bytes as success.
    const existing = await bucket.download(row.storage_path);
    if (existing.error || !existing.data || documentContentHash(new Uint8Array(await existing.data.arrayBuffer())) !== hash) {
      throw new Error('DOCUMENT_UPLOAD_FAILED');
    }
  }
  const finished = await supabase.from('pet_documents').update({ lifecycle: 'ready', lifecycle_updated_at: new Date().toISOString() })
    .eq('id', row.id).eq('lifecycle', 'pending').select('*').maybeSingle();
  if (finished.error) throw new Error('DOCUMENT_METADATA_FAILED');
  if (finished.data) return finished.data as DocumentRow;
  const current = await supabase.from('pet_documents').select('*').eq('id', row.id).maybeSingle();
  if (current.error) throw new Error('DOCUMENT_METADATA_FAILED');
  if (current.data?.lifecycle === 'ready') return current.data as DocumentRow;
  // A concurrent removal won. A tombstone retains the path for retry/cleanup
  // if this best-effort cleanup itself fails or the HTTP process is terminated.
  await bucket.remove([row.storage_path]);
  throw new Error('DOCUMENT_REMOVED');
}

export async function removeDocumentOnce(supabase: SupabaseClient, row: DocumentRow, expectedUpdatedAt?: string) {
  if (row.lifecycle === 'deleted') return;
  let pendingQuery = supabase.from('pet_documents').update({ lifecycle: 'deleting', lifecycle_updated_at: new Date().toISOString() })
    .eq('id', row.id).neq('lifecycle', 'deleted');
  if (expectedUpdatedAt) pendingQuery = pendingQuery.eq('lifecycle_updated_at', expectedUpdatedAt).eq('lifecycle', row.lifecycle);
  const pending = await pendingQuery.select('id').maybeSingle();
  if (pending.error) throw new Error('DOCUMENT_DELETE_FAILED');
  if (!pending.data) return;
  const removed = await supabase.storage.from(row.storage_bucket || PET_DOCUMENT_BUCKET).remove([row.storage_path]);
  if (removed.error) throw new Error('DOCUMENT_DELETE_PENDING');
  const finished = await supabase.from('pet_documents').update({ lifecycle: 'deleted', lifecycle_updated_at: new Date().toISOString(),
    title: '', clinic: null, original_name: '', document_date: null })
    .eq('id', row.id).eq('lifecycle', 'deleting');
  if (finished.error) throw new Error('DOCUMENT_DELETE_PENDING');
}

// Bounded reconciliation: a stopped HTTP request always leaves a known path.
// Wait longer than the 60s route lifetime before checking uncertain operations.
export async function reconcileDocuments(supabase: SupabaseClient, now = Date.now()) {
  const rows = await supabase.from('pet_documents').select('*').neq('lifecycle', 'ready')
    .lt('next_reconcile_at', new Date(now).toISOString()).order('next_reconcile_at').limit(20);
  if (rows.error) throw rows.error;
  let recovered = 0; let removed = 0; let failed = 0;
  for (const row of (rows.data ?? []) as DocumentRow[]) {
    try {
      if (row.lifecycle === 'pending') {
        const file = await supabase.storage.from(row.storage_bucket).download(row.storage_path);
        if (!file.error && file.data && documentContentHash(new Uint8Array(await file.data.arrayBuffer())) === row.content_sha256) {
          const ready = await supabase.from('pet_documents').update({ lifecycle: 'ready', lifecycle_updated_at: new Date(now).toISOString() })
            .eq('id', row.id).eq('lifecycle', 'pending').select('id').maybeSingle();
          if (ready.error) throw ready.error;
          if (ready.data) recovered += 1;
          continue;
        }
        const missing = file.error && 'statusCode' in file.error && String(file.error.statusCode) === '404';
        if (!missing) { failed += 1; continue; }
        // Retain an incomplete upload for retry for at least one day.
        if (now - Date.parse(row.lifecycle_updated_at) < 24 * 60 * 60_000) { failed += 1; continue; }
        await removeDocumentOnce(supabase, row, row.lifecycle_updated_at); removed += 1;
      } else {
        // Recheck tombstones too: covers a late upload racing a deletion.
        const result = await supabase.storage.from(row.storage_bucket).remove([row.storage_path]);
        if (result.error) throw result.error;
        if (row.lifecycle === 'deleting') await removeDocumentOnce(supabase, row);
        removed += 1;
      }
    } catch { failed += 1; } finally {
      // Keep the scrubbed tombstone to reject old upload keys indefinitely.
      // After a week, all bounded HTTP uploads are long finished; stop rescanning.
      const nextCheck = row.lifecycle === 'deleted' && now - Date.parse(row.lifecycle_updated_at) > 7 * 24 * 60 * 60_000
        ? 'infinity' : new Date(now + 24 * 60 * 60_000).toISOString();
      const scheduled = await supabase.from('pet_documents').update({ next_reconcile_at: nextCheck }).eq('id', row.id).neq('lifecycle', 'ready');
      if (scheduled.error) failed += 1;
    }
  }
  return { scanned: rows.data?.length ?? 0, recovered, removed, failed };
}
