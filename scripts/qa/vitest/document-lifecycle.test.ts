import { expect, test } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadDocumentOnce, removeDocumentOnce, reconcileDocuments } from '@/lib/server/documentLifecycle';
function fixture() {
  const rows = new Map<string, Record<string, unknown>>();
  const objects = new Map<string, Uint8Array>();
  const faults = { finish: false, remove: false, afterUpload: false };
  const client = {
    async rpc(_name: string, args: Record<string, unknown>) {
      const existing = rows.get(String(args.p_key));
      if (existing) {
        if (existing.upload_fingerprint !== args.p_fingerprint) return { error: { message: 'IDEMPOTENCY_KEY_REUSED' } };
        return { data: { ...existing }, error: null };
      }
      const row = { ...args.p_metadata as object, id: String(args.p_key), pet_id: args.p_pet_id, lifecycle: 'pending',
        content_sha256: args.p_content_sha256, upload_fingerprint: args.p_fingerprint,
        storage_path: `owner/pet/${args.p_key}`, storage_bucket: 'pet-documents', lifecycle_updated_at: new Date(0).toISOString(), next_reconcile_at: new Date(0).toISOString() };
      rows.set(row.id, row); return { data: { ...row }, error: null };
    },
    from() {
      let patch: Record<string, unknown> | undefined; let deleting = false; let single = false;
      const filters: ((row: Record<string, unknown>) => boolean)[] = [];
      const q = {
        select() { return q; }, update(value: Record<string, unknown>) { patch = value; return q; },
        delete() { deleting = true; return q; },
        eq(key: string, value: unknown) { filters.push(row => row[key] === value); return q; },
        neq(key: string, value: unknown) { filters.push(row => row[key] !== value); return q; },
        lt(key: string, value: string) { filters.push(row => String(row[key]) < value); return q; },
        order() { return q; }, limit() { return q; }, maybeSingle() { single = true; return q; },
        then(resolve: (value: unknown) => unknown) {
          if (faults.finish && patch?.lifecycle === 'ready') { faults.finish = false; return Promise.resolve(resolve({ data: null, error: { message: 'db timeout' } })); }
          const found = [...rows.values()].filter(row => filters.every(filter => filter(row)));
          for (const row of found) { if (patch) Object.assign(row, patch); if (deleting) rows.delete(String(row.id)); }
          return Promise.resolve(resolve({ data: single ? found[0] ? { ...found[0] } : null : found.map(row => ({ ...row })), error: null }));
        },
      }; return q;
    },
    storage: { from: () => ({
      async upload(path: string, bytes: Uint8Array) {
        if (objects.has(path)) return { error: { message: 'exists' } };
        objects.set(path, bytes);
        if (faults.afterUpload) { faults.afterUpload = false; throw new Error('connection lost'); }
        return { error: null };
      },
      async download(path: string) {
        const bytes = objects.get(path); return bytes ? { data: new Blob([new Uint8Array(bytes)]), error: null } : { data: null, error: { statusCode: '404' } };
      },
      async remove(paths: string[]) {
        if (faults.remove) return { error: { message: 'storage down' } };
        for (const path of paths) objects.delete(path); return { error: null };
      },
    }) },
  } as unknown as SupabaseClient;
  const input = { supabase: client, ownerId: 'owner', petId: 'pet', key: 'document-test', bytes: new TextEncoder().encode('%PDF test'),
    metadata: { kind: 'analysis', title: 'Test', clinic: null, document_date: null, original_name: 'test.pdf', mime_type: 'application/pdf', size_bytes: 9 } };
  return { client, rows, objects, faults, input };
}
test.each(['finish', 'afterUpload'] as const)('%s failure leaves a tracked operation; retry returns one document/file', async fault => {
  const f=fixture(); f.faults[fault]=true;
  await expect(uploadDocumentOnce(f.input)).rejects.toThrow();
  expect(f.rows.get(f.input.key)?.lifecycle).toBe('pending'); expect(f.objects.size).toBe(1);
  const result = await uploadDocumentOnce(f.input);
  expect(result.lifecycle).toBe('ready'); expect(f.objects.size).toBe(1); expect(f.rows.size).toBe(1);
  expect((await uploadDocumentOnce(f.input)).id).toBe(result.id);
});
test('failed removal hides document but retains path for a safe retry', async () => {
  const f=fixture(); const row=await uploadDocumentOnce(f.input); f.faults.remove=true;
  await expect(removeDocumentOnce(f.client,row)).rejects.toThrow('DOCUMENT_DELETE_PENDING');
  expect(f.rows.get(row.id)?.lifecycle).toBe('deleting'); expect(f.objects.size).toBe(1);
  f.faults.remove=false; await removeDocumentOnce(f.client,row);
  expect(f.objects.size).toBe(0); expect(f.rows.get(row.id)?.lifecycle).toBe('deleted');
  expect(f.rows.get(row.id)?.title).toBe('');
});
test('reconciliation recovers a file after HTTP process stopped before receipt', async () => {
  const f=fixture(); f.faults.afterUpload=true; await expect(uploadDocumentOnce(f.input)).rejects.toThrow();
  const result=await reconcileDocuments(f.client);
  expect(result.recovered).toBe(1); expect(f.rows.get(f.input.key)?.lifecycle).toBe('ready');
});
test('reconciliation removes a late object at a retained deletion tombstone', async () => {
  const f=fixture(); const row=await uploadDocumentOnce(f.input); await removeDocumentOnce(f.client,row);
  f.objects.set(row.storage_path, f.input.bytes);
  const now=Date.now(); const stored=f.rows.get(row.id)!;
  stored.lifecycle_updated_at=new Date(now-3600_000).toISOString(); stored.next_reconcile_at=new Date(0).toISOString();
  const result=await reconcileDocuments(f.client,now);
  expect(result.removed).toBe(1); expect(f.objects.size).toBe(0); expect(f.rows.has(row.id)).toBe(true);
});

test('old deletion receipt survives cleanup so the same upload cannot be resurrected', async () => {
  const f=fixture(); const row=await uploadDocumentOnce(f.input); await removeDocumentOnce(f.client,row);
  const stored=f.rows.get(row.id)!; stored.lifecycle_updated_at=new Date(0).toISOString(); stored.next_reconcile_at=new Date(0).toISOString();
  await reconcileDocuments(f.client);
  expect(f.rows.get(row.id)?.lifecycle).toBe('deleted'); expect(f.rows.get(row.id)?.next_reconcile_at).toBe('infinity');
});
