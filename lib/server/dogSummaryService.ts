import type { SupabaseClient } from '@supabase/supabase-js';

type SummaryInput = {
  now?: Date;
  pet: Record<string, unknown>;
  reminders: Array<Record<string, unknown>>;
  habits: Array<Record<string, unknown>>;
  observations: Array<Record<string, unknown>>;
  places: Array<Record<string, unknown>>;
  things: Array<Record<string, unknown>>;
};

export function buildDogSummary(input: SummaryInput) {
  // No medical inference: this projection only counts owner-authored facts and due dates.
  const now = input.now ?? new Date();
  const activeReminders = input.reminders.filter((item) => item.status === 'active' || item.status === 'snoozed');
  const overdue = activeReminders.filter((item) => {
    const dueAt = new Date(String(item.snoozed_until ?? item.due_at ?? ''));
    return Number.isFinite(dueAt.getTime()) && dueAt < now;
  });
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const activeHabits = input.habits.filter((item) => item.status === 'active');
  const completedToday = activeHabits.reduce((total, habit) => total + (Array.isArray(habit.habit_checkins)
    ? habit.habit_checkins.filter((item: any) => {
        const completedAt = new Date(String(item.completed_at ?? ''));
        return completedAt >= startOfDay && completedAt < endOfDay;
      }).length
    : 0), 0);
  const targetToday = activeHabits
    .filter((item) => item.cadence === 'daily')
    .reduce((total, item) => total + Number(item.target_per_period ?? 1), 0);
  const profileValues = [input.pet.name, input.pet.life_stage, input.pet.sex, input.pet.breed_id];
  const profileFacts = profileValues.filter((value) => value && value !== 'mixed').length;
  const hasActivity = activeReminders.length + activeHabits.length + input.observations.length + input.places.length + input.things.length > 0;

  return {
    status: overdue.length ? 'attention' as const : hasActivity ? 'active' as const : 'empty' as const,
    profile: { facts: profileFacts, total: profileValues.length },
    reminders: {
      active: activeReminders.length,
      overdue: overdue.length,
      nextDueAt: activeReminders.map((item) => String(item.snoozed_until ?? item.due_at ?? '')).filter(Boolean).sort()[0] ?? null,
    },
    habits: { active: activeHabits.length, completedToday, targetToday },
    health: { entries: input.observations.length, lastAt: String(input.observations[0]?.observed_at ?? '') || null },
    map: { places: input.places.length },
    things: { wanted: input.things.length },
  };
}

export async function getDogSummaryForOwner(input: { supabase: SupabaseClient; ownerId: string; petId: string; now?: Date }) {
  const { supabase, ownerId, petId } = input;
  const petResult = await supabase.from('pets').select('*').eq('id', petId).eq('owner_id', ownerId).maybeSingle();
  if (petResult.error) throw petResult.error;
  if (!petResult.data) throw new Error('PET_NOT_FOUND');

  const [reminders, habits, observations, places, things] = await Promise.all([
    supabase.from('reminders').select('status, due_at, snoozed_until').eq('pet_id', petId).neq('status', 'done'),
    supabase.from('pet_habits').select('status, cadence, target_per_period, habit_checkins(completed_at)').eq('pet_id', petId).eq('status', 'active'),
    supabase.from('pet_observations').select('observed_at').eq('pet_id', petId).is('deleted_at', null).order('observed_at', { ascending: false }).limit(50),
    supabase.from('map_zones').select('id').eq('pet_id', petId).is('deleted_at', null),
    supabase.from('wishlist_items').select('id').eq('pet_id', petId).eq('status', 'wanted').is('deleted_at', null),
  ]);
  for (const result of [reminders, habits, observations, places, things]) if (result.error) throw result.error;
  return buildDogSummary({
    now: input.now,
    pet: petResult.data,
    reminders: reminders.data ?? [],
    habits: habits.data ?? [],
    observations: observations.data ?? [],
    places: places.data ?? [],
    things: things.data ?? [],
  });
}
