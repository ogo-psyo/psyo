import type { SupabaseClient } from '@supabase/supabase-js';
import { careRequestFingerprint } from '@/lib/server/careHttp';

const habitKinds = new Set(['walk', 'feeding', 'medication', 'grooming', 'training', 'custom']);
const cadences = new Set(['daily', 'weekly']);

export type HabitInput = {
  petId: string;
  kind: string;
  title: string;
  cadence: string;
  targetPerPeriod: number;
};

export type HabitUpdateInput = Omit<HabitInput, 'petId'>;

export function normalizeHabitInput(value: unknown): HabitInput | null {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const petId = String(source.petId ?? '').trim();
  const kind = String(source.kind ?? '').trim();
  const title = String(source.title ?? '').trim().slice(0, 120);
  const cadence = String(source.cadence ?? 'daily').trim();
  const targetPerPeriod = Math.trunc(Number(source.targetPerPeriod ?? 1));
  if (!petId || !habitKinds.has(kind) || !title || !cadences.has(cadence)) return null;
  if (!Number.isFinite(targetPerPeriod) || targetPerPeriod < 1 || targetPerPeriod > 12) return null;
  return { petId, kind, title, cadence, targetPerPeriod };
}

export function normalizeHabitUpdate(value: unknown): HabitUpdateInput | null {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const normalized = normalizeHabitInput({ ...source, petId: 'owned-pet' });
  if (!normalized) return null;
  const { petId: _petId, ...update } = normalized;
  return update;
}

function mapHabit(row: any) {
  const checkins = Array.isArray(row.habit_checkins) ? row.habit_checkins : [];
  return {
    id: row.id,
    petId: row.pet_id,
    kind: row.kind,
    title: row.title,
    cadence: row.cadence,
    targetPerPeriod: row.target_per_period,
    status: row.status,
    checkins: checkins.map((item: any) => ({ id: item.id, completedAt: item.completed_at })),
  };
}

async function requireOwnedPet(supabase: SupabaseClient, ownerId: string, petId: string) {
  const result = await supabase.from('pets').select('id').eq('id', petId).eq('owner_id', ownerId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error('PET_NOT_FOUND');
}

export async function listHabitsForOwner(input: { supabase: SupabaseClient; ownerId: string; petId: string }) {
  await requireOwnedPet(input.supabase, input.ownerId, input.petId);
  const result = await input.supabase
    .from('pet_habits')
    .select('*, habit_checkins(id, completed_at)')
    .eq('pet_id', input.petId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });
  if (result.error) throw result.error;
  return (result.data ?? []).map(mapHabit);
}

export async function createHabitForOwner(input: { supabase: SupabaseClient; ownerId: string; habit: HabitInput }) {
  await requireOwnedPet(input.supabase, input.ownerId, input.habit.petId);
  const result = await input.supabase.from('pet_habits').insert({
    pet_id: input.habit.petId,
    kind: input.habit.kind,
    title: input.habit.title,
    cadence: input.habit.cadence,
    target_per_period: input.habit.targetPerPeriod,
  }).select('*').single();
  if (result.error) throw result.error;
  return mapHabit(result.data);
}

export async function updateHabitForOwner(input: { supabase: SupabaseClient; ownerId: string; habitId: string; update: HabitUpdateInput }) {
  const owned = await input.supabase
    .from('pet_habits')
    .select('id, pets!inner(owner_id)')
    .eq('id', input.habitId)
    .eq('pets.owner_id', input.ownerId)
    .eq('status', 'active')
    .maybeSingle();
  if (owned.error) throw owned.error;
  if (!owned.data) throw new Error('HABIT_NOT_FOUND');
  const result = await input.supabase.from('pet_habits').update({
    kind: input.update.kind,
    title: input.update.title,
    cadence: input.update.cadence,
    target_per_period: input.update.targetPerPeriod,
    updated_at: new Date().toISOString(),
  }).eq('id', input.habitId).eq('status', 'active').select('*, habit_checkins(id, completed_at)').single();
  if (result.error) throw result.error;
  return mapHabit(result.data);
}

export async function archiveHabitForOwner(input: { supabase: SupabaseClient; ownerId: string; habitId: string }) {
  const owned = await input.supabase
    .from('pet_habits')
    .select('id, pets!inner(owner_id)')
    .eq('id', input.habitId)
    .eq('pets.owner_id', input.ownerId)
    .eq('status', 'active')
    .maybeSingle();
  if (owned.error) throw owned.error;
  if (!owned.data) throw new Error('HABIT_NOT_FOUND');
  const result = await input.supabase.from('pet_habits').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', input.habitId).eq('status', 'active').select('id,status').single();
  if (result.error) throw result.error;
  return { id: result.data.id, status: result.data.status };
}

export async function checkInHabitForOwner(input: {
  supabase: SupabaseClient;
  ownerId: string;
  habitId: string;
  idempotencyKey: string;
  completedAt?: string;
  note?: string;
}) {
  const habit = await input.supabase
    .from('pet_habits')
    .select('id, pets!inner(owner_id)')
    .eq('id', input.habitId)
    .eq('pets.owner_id', input.ownerId)
    .eq('status', 'active')
    .maybeSingle();
  if (habit.error) throw habit.error;
  if (!habit.data) throw new Error('HABIT_NOT_FOUND');
  const requestFingerprint = careRequestFingerprint({
    habitId: input.habitId,
    completedAt: input.completedAt ?? null,
    note: input.note?.trim() || null,
    source: 'manual',
  });
  const payload = {
    habit_id: input.habitId,
    idempotency_key: input.idempotencyKey,
    request_fingerprint: requestFingerprint,
    completed_at: input.completedAt ?? new Date().toISOString(),
    note: input.note?.trim() || null,
  };
  const inserted = await input.supabase.from('habit_checkins').insert(payload).select('*').single();
  if (inserted.error?.code === '23505') {
    const replay = await input.supabase.from('habit_checkins').select('*').eq('habit_id', input.habitId).eq('idempotency_key', input.idempotencyKey).single();
    if (replay.error) throw replay.error;
    if (replay.data.request_fingerprint !== requestFingerprint) throw new Error('IDEMPOTENCY_KEY_REUSED');
    return { id: replay.data.id, completedAt: replay.data.completed_at, replayed: true };
  }
  if (inserted.error) throw inserted.error;
  return { id: inserted.data.id, completedAt: inserted.data.completed_at, replayed: false };
}
