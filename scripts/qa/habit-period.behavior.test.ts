import assert from 'node:assert/strict';
import { completedInCurrentPeriod, type HabitView } from '../../components/habits/HabitScreen';

const habit = (cadence: HabitView['cadence'], dates: string[]): HabitView => ({
  id: 'habit-1',
  petId: 'pet-1',
  kind: 'walk',
  title: 'Прогулка',
  cadence,
  targetPerPeriod: 2,
  status: 'active',
  checkins: dates.map((completedAt, index) => ({ id: `check-${index}`, completedAt })),
});

const now = new Date('2026-08-20T12:00:00.000Z');
assert.equal(completedInCurrentPeriod(habit('daily', ['2026-08-20T08:00:00.000Z', '2026-08-19T08:00:00.000Z']), now), 1);
assert.equal(completedInCurrentPeriod(habit('weekly', ['2026-08-17T08:00:00.000Z', '2026-08-20T08:00:00.000Z', '2026-08-16T08:00:00.000Z']), now), 2);

console.log('habit period behavior ok');
