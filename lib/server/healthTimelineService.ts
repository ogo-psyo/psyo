import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const cursorSchema = z.object({at:z.iso.datetime({offset:true}),id:z.uuid()});
export type HealthCursor = z.infer<typeof cursorSchema>;
export function parseHealthCursor(value: string | null): HealthCursor | undefined {
  if (!value) return undefined;
  try { return cursorSchema.parse(JSON.parse(value)); } catch { throw new Error('INVALID_HEALTH_CURSOR'); }
}

const windowSchema = z.object({from:z.iso.datetime({offset:true}),to:z.iso.datetime({offset:true})})
  .refine(w=>Date.parse(w.to)>Date.parse(w.from)&&Date.parse(w.to)-Date.parse(w.from)<=45*86400000);
export type HealthWindow = z.infer<typeof windowSchema>;
export function parseHealthWindow(from:string|null,to:string|null):HealthWindow|undefined {
  if(from===null&&to===null)return undefined;
  const parsed=windowSchema.safeParse({from,to});
  if(!parsed.success)throw new Error('INVALID_HEALTH_WINDOW');
  return parsed.data;
}

/** Same original data as the observation endpoint; no inferred/missing metrics. */
function mapHealthEntry(row: Record<string, unknown>) {
  const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
  const metric = (key:string) => typeof metadata[key] === 'string' ? metadata[key] : row.type === key && typeof row.value === 'string' ? row.value : undefined;
  return {id:row.id,petId:row.pet_id,type:row.type,value:row.value,note:row.note??null,observedAt:row.observed_at,source:row.source,
    mood:metric('mood'),appetite:metric('appetite'),stool:metric('stool'),energy:metric('energy'),createdAt:row.created_at,updatedAt:row.updated_at};
}

type Input = {supabase:SupabaseClient;ownerId:string;petId:string;limit?:number;before?:HealthCursor;window?:HealthWindow};
export async function healthTimelinePageForOwner(input: Input) {
  const {supabase,ownerId,petId} = input;
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? 30),1),100);
  const before = input.before ? cursorSchema.parse(input.before) : undefined;
  const window = input.window ? windowSchema.parse(input.window) : undefined;
  let query = supabase.from('pet_observations').select('*, pets!inner(owner_id)')
    .eq('pet_id',petId).eq('pets.owner_id', ownerId).is('deleted_at', null)
    .order('observed_at',{ascending:false}).order('id',{ascending:false});
  if(window)query=query.gte('observed_at',window.from).lt('observed_at',window.to);
  // Validated ISO timestamp and UUID only: external text is never interpolated into this filter.
  if (before) query = query.or(`observed_at.lt.${before.at},and(observed_at.eq.${before.at},id.lt.${before.id})`);
  const result = await query.limit(limit + 1);
  if (result.error) throw result.error;
  const rows = result.data ?? [], page = rows.slice(0,limit), last = page.at(-1);
  const hasMore = rows.length > limit;
  return {entries:page.map(mapHealthEntry),hasMore,nextCursor:hasMore&&last?JSON.stringify({at:last.observed_at,id:last.id}):null};
}

/** Existing summary callers keep their array contract. */
export async function listHealthTimelineForOwner(input: Input) {
  return (await healthTimelinePageForOwner(input)).entries;
}
