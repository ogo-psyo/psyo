import type { SupabaseClient } from '@supabase/supabase-js';

export const PET_DOCUMENT_BUCKET = 'pet-documents';
export const PET_DOCUMENT_MAX_BYTES = 4 * 1024 * 1024;
export const PET_DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

export function mapPetDocument(row: any) {
  return {
    id: String(row.id),
    petId: String(row.pet_id),
    kind: String(row.kind || 'analysis'),
    title: String(row.title || 'Документ'),
    clinic: row.clinic ? String(row.clinic) : null,
    documentDate: row.document_date ? String(row.document_date) : null,
    originalName: String(row.original_name || 'document'),
    mimeType: String(row.mime_type || 'application/octet-stream'),
    sizeBytes: Number(row.size_bytes || 0),
    createdAt: String(row.created_at),
  };
}

export async function ownedPet(supabase: SupabaseClient, ownerId: string, petId: string) {
  const result = await supabase.from('pets').select('id').eq('id', petId).eq('owner_id', ownerId).maybeSingle();
  if (result.error) throw result.error;
  return Boolean(result.data);
}

export async function listPetDocuments(supabase: SupabaseClient, ownerId: string, petId: string) {
  if (!(await ownedPet(supabase, ownerId, petId))) return null;
  const result = await supabase
    .from('pet_documents')
    .select('*')
    .eq('pet_id', petId)
    .order('created_at', { ascending: false });
  if (result.error) throw result.error;
  return (result.data ?? []).map(mapPetDocument);
}
