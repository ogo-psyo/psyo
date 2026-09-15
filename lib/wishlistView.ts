export type WishlistView = {
  id: string; petId: string; title: string; category: string; reason?: string; url?: string;
  priority: string; status: string; plannedFor?: string; reminderId?: string; createdAt?: string; created_at?: string;
};
/** Mutation APIs return both camel-case RPC receipts and canonical Postgres rows. */
export function normalizeWishlistReceipt(value: unknown, petId: string, expectedId?: string): WishlistView | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const id = row.id, ownerPet = row.petId ?? row.pet_id;
  if (typeof id !== 'string' || !id || (expectedId && id !== expectedId) || ownerPet !== petId || typeof row.title !== 'string' || !row.title.trim()) return null;
  if (!['wanted', 'bought', 'not_suitable'].includes(String(row.status))) return null;
  const optional = (value: unknown) => typeof value === 'string' && value ? value : undefined;
  return {id,petId,title:row.title,category:typeof row.category==='string'?row.category:'other',priority:typeof row.priority==='string'?row.priority:'medium',status:String(row.status),
    reason:optional(row.reason),url:optional(row.url),plannedFor:optional(row.plannedFor??row.planned_for),reminderId:optional(row.reminderId??row.reminder_id),createdAt:optional(row.createdAt??row.created_at)};
}
