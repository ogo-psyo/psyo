import type {ReminderRecurrence} from './reminder';
function parseIso(value:string){const date=new Date(value);if(!value||!Number.isFinite(date.getTime()))throw new Error('INVALID_DATE');return date;}
function calendarShift(source: Date, months: number) {
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const targetMonthStart = new Date(Date.UTC(
    year,
    month + months,
    1,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ));
  const lastDay = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  targetMonthStart.setUTCDate(Math.min(day, lastDay));
  return targetMonthStart;
}

export function nextReminderDueAt(dueAt: string, recurrence: ReminderRecurrence) {
  const due = parseIso(dueAt);
  if (recurrence === 'none') return null;
  if (recurrence === 'daily') return new Date(due.getTime() + 86_400_000).toISOString();
  if (recurrence === 'weekly') return new Date(due.getTime() + 7 * 86_400_000).toISOString();
  if (recurrence === 'monthly') return calendarShift(due, 1).toISOString();
  if (recurrence === 'quarterly') return calendarShift(due, 3).toISOString();
  return calendarShift(due, 12).toISOString();
}
