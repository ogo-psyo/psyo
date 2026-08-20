import type { SupabaseClient } from '@supabase/supabase-js';

function mapHealthEntry(row: any) {
  return {
    id: row.id,
    petId: row.pet_id,
    type: row.type,
    value: row.value,
    note: row.note ?? null,
    observedAt: row.observed_at,
    source: row.source,
  };
}

export async function listHealthTimelineForOwner(input: {
  supabase: SupabaseClient;
  ownerId: string;
  petId: string;
  limit?: number;
}) {
  const { supabase, ownerId, petId } = input;
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 30), 1), 100);
  const result = await supabase
    .from('pet_observations')
    .select('*, pets!inner(owner_id)')
    .eq('pet_id', petId)
    .eq('pets.owner_id', ownerId)
    .is('deleted_at', null)
    .order('observed_at', { ascending: false })
    .limit(limit);
  if (result.error) throw result.error;
  return (result.data ?? []).map(mapHealthEntry);
}
