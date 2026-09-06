/** A read-only daily projection; source records and lifecycle remain unchanged. */
export type JournalEntry = { id: string; at: string; title: string; detail: string; kind: 'observation' | 'care'; completed: boolean };
type Reminder = { id: string; title: string; dueAt: string; completedAt?: string; snoozedUntil?: string; status: string };
type Observation = { id: string; createdAt: string; note?: string; mood?: string };
export function journalDayEntries(reminders: Reminder[], observations: Observation[], day: Date): JournalEntry[] {
  const isToday = (value: string) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
  };
  const care = reminders.flatMap((item): JournalEntry[] => {
    if (item.status === 'cancelled' || item.status === 'canceled' || item.status === 'deleted') return [];
    const completed = item.status === 'completed' || item.status === 'done';
    const at = completed ? item.completedAt : item.snoozedUntil || item.dueAt;
    if (!at || !isToday(at)) return [];
    return [{ id: `care-${item.id}`, at, title: item.title, detail: completed ? 'Отмечено выполненным' : 'В вашем плане', kind: 'care', completed }];
  });
  const notes = observations.filter((item) => isToday(item.createdAt)).map((item): JournalEntry => ({ id: `observation-${item.id}`, at: item.createdAt, title: item.note || (item.mood ? `Самочувствие: ${item.mood}` : 'Наблюдение'), detail: 'Записано вами', kind: 'observation', completed: true }));
  return [...care, ...notes].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
