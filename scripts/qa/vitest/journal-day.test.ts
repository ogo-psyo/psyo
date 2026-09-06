import { describe, expect, it } from 'vitest';
import { journalDayEntries } from '../../../lib/journal';

describe('daily journal projection', () => {
  const day = new Date(2026, 8, 6, 12);
  const at = (date: number, hour: number) => new Date(2026, 8, date, hour).toISOString();
  it('uses local calendar boundaries and actual completion time, then orders mixed records', () => {
    const reminders = [
      { id: 'snoozed', title: 'Snoozed', status: 'active', dueAt: at(6, 8), snoozedUntil: at(7, 8) },
      { id: 'future', title: 'Future', status: 'active', dueAt: at(7, 8) },
      { id: 'done', title: 'Done', status: 'done', dueAt: at(5, 9), completedAt: at(6, 11) },
      { id: 'tonight', title: 'Evening', status: 'active', dueAt: at(6, 19) },
      { id: 'yesterday', title: 'Earlier', status: 'done', dueAt: at(6, 9), completedAt: at(5, 10) },
    ];
    const result = journalDayEntries(reminders, [{ id: 'note', createdAt: at(6, 9), note: 'Спокоен' }], day);
    expect(result.map((item) => item.id)).toEqual(['observation-note', 'care-done', 'care-tonight']);
    expect(result.map((item) => item.completed)).toEqual([true, true, false]);
    expect(reminders[2].dueAt).toBe(at(5, 9));
  });
  it('does not invent events for missing, cancelled or invalid records', () => {
    expect(journalDayEntries([
      { id: 'cancel', title: 'Cancelled', status: 'cancelled', dueAt: at(6, 10) },
      { id: 'bad', title: 'Invalid', status: 'active', dueAt: 'invalid' },
      { id: 'undated', title: 'Done', status: 'done', dueAt: at(6, 8) },
    ], [{ id: 'bad', createdAt: 'invalid' }], day)).toEqual([]);
    expect(journalDayEntries([], [], day)).toEqual([]);
  });
});
