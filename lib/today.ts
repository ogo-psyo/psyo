export type CareReminderInput = {
  id: string;
  title: string;
  dueAt: string;
  status: string;
  snoozedUntil?: string;
  completedAt?: string;
};

export type TodayCareState = 'empty' | 'overdue' | 'today' | 'upcoming' | 'complete';

export type TodayCareView = {
  state: TodayCareState;
  reminderId?: string;
  title: string;
  detail: string;
  actionLabel: 'Добавить дело' | 'Готово' | 'Открыть историю';
  target: 'calendar' | 'history';
};

export function buildTodayCareView(
  reminders: CareReminderInput[],
  now = new Date(),
): TodayCareView {
  const active = reminders
    .filter((item) => item.status !== 'done')
    .sort((a, b) => reminderDueAt(a) - reminderDueAt(b));
  const completed = reminders.filter((item) => item.status === 'done');

  if (!active.length) {
    return completed.length
      ? {
          state: 'complete',
          title: 'На сегодня всё',
          detail: 'Последнее дело сохранено в истории ухода.',
          actionLabel: 'Открыть историю',
          target: 'history',
        }
      : {
          state: 'empty',
          title: 'Добавь первое дело',
          detail: 'Например, обработку, вакцинацию или груминг.',
          actionLabel: 'Добавить дело',
          target: 'calendar',
        };
  }

  const next = active[0];
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const due = reminderDueAt(next);
  const state: TodayCareState = due < start.getTime()
    ? 'overdue'
    : due < end.getTime()
      ? 'today'
      : 'upcoming';

  return {
    state,
    reminderId: next.id,
    title: next.title,
    detail: state === 'overdue'
      ? 'Срок прошёл. Закрой дело или перенеси его в Плане.'
      : state === 'today'
        ? 'Запланировано на сегодня.'
        : `Следующее дело: ${new Date(due).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}.`,
    actionLabel: 'Готово',
    target: 'calendar',
  };
}

function reminderDueAt(reminder: CareReminderInput) {
  const timestamp = new Date(reminder.snoozedUntil || reminder.dueAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}
