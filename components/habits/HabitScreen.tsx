'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ListChecks, Plus } from '@phosphor-icons/react';

export type HabitView = {
  id: string;
  petId: string;
  kind: string;
  title: string;
  cadence: 'daily' | 'weekly';
  targetPerPeriod: number;
  status: string;
  checkins: Array<{ id: string; completedAt: string }>;
};

export type HabitDraft = {
  title: string;
  kind: string;
  cadence: 'daily' | 'weekly';
  targetPerPeriod: number;
};

export function completedInCurrentPeriod(habit: HabitView, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (habit.cadence === 'weekly') {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  }
  return habit.checkins.filter((checkin) => {
    const date = new Date(checkin.completedAt);
    return Number.isFinite(date.getTime()) && date >= start && date <= now;
  }).length;
}

export function HabitScreen({
  dogName,
  habits,
  loading,
  error,
  busyId,
  canPersist,
  onBack,
  onCreate,
  onCheckIn,
  onRetry,
}: {
  dogName: string;
  habits: HabitView[];
  loading: boolean;
  error?: string;
  busyId: string | null;
  canPersist: boolean;
  onBack: () => void;
  onCreate: (draft: HabitDraft) => Promise<boolean>;
  onCheckIn: (habitId: string) => Promise<void>;
  onRetry: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<HabitDraft>({ title: '', kind: 'walk', cadence: 'daily', targetPerPeriod: 1 });
  const completed = useMemo(() => habits.reduce((total, habit) => total + completedInCurrentPeriod(habit), 0), [habits]);

  return (
    <section className="module-screen habit-screen" aria-labelledby="habit-screen-title">
      <button className="secondary-flow-back" type="button" onClick={onBack}><ArrowLeft weight="bold" aria-hidden="true" /> Назад во Всё</button>
      <header className="module-screen-heading">
        <span className="module-screen-icon"><ListChecks weight="duotone" aria-hidden="true" /></span>
        <div><h2 id="habit-screen-title">Привычки {dogName}</h2><p>{habits.length ? `${completed} отмечено сегодня` : 'Регулярные дела появятся здесь'}</p></div>
      </header>

      {loading ? <div className="module-skeleton" aria-label="Загружаю привычки" /> : error ? (
        <div className="module-error" role="alert"><b>Привычки не загрузились</b><p>{error}</p><button type="button" onClick={() => void onRetry()}>Повторить</button></div>
      ) : habits.length ? (
        <div className="habit-list">
          {habits.map((habit) => {
            const done = completedInCurrentPeriod(habit);
            const targetReached = done >= habit.targetPerPeriod;
            return (
              <article key={habit.id}>
                <div><b>{habit.title}</b><small>{habit.cadence === 'daily' ? `каждый день · ${done}/${habit.targetPerPeriod}` : `каждую неделю · ${done}/${habit.targetPerPeriod} на этой неделе`}</small></div>
                <button type="button" disabled={busyId === habit.id || targetReached} onClick={() => onCheckIn(habit.id)}>
                  <Check weight="bold" aria-hidden="true" />
                  {busyId === habit.id ? 'Отмечаю…' : targetReached ? 'Готово' : 'Отметить'}
                </button>
              </article>
            );
          })}
        </div>
      ) : <div className="module-empty"><b>Пока без привычек</b><p>Добавь только то, что действительно повторяется: прогулку, кормление, лекарство или уход.</p></div>}

      {!adding ? (
        <button className="primary module-primary-action" type="button" disabled={!canPersist} onClick={() => setAdding(true)}><Plus weight="bold" aria-hidden="true" /> Добавить привычку</button>
      ) : (
        <form className="module-form" onSubmit={async (event) => {
          event.preventDefault();
          const saved = await onCreate({ ...draft, title: draft.title.trim() });
          if (saved) {
            setDraft({ title: '', kind: 'walk', cadence: 'daily', targetPerPeriod: 1 });
            setAdding(false);
          }
        }}>
          <label>Название<input autoFocus value={draft.title} maxLength={120} placeholder="Например, вечерняя прогулка" onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label>
          <div className="module-form-grid">
            <label>Тип<select value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value }))}><option value="walk">Прогулка</option><option value="feeding">Кормление</option><option value="medication">Лекарство</option><option value="grooming">Уход</option><option value="training">Занятие</option><option value="custom">Другое</option></select></label>
            <label>Ритм<select value={draft.cadence} onChange={(event) => setDraft((current) => ({ ...current, cadence: event.target.value as HabitDraft['cadence'] }))}><option value="daily">Каждый день</option><option value="weekly">Каждую неделю</option></select></label>
          </div>
          <label>Сколько раз<input type="number" min="1" max="12" value={draft.targetPerPeriod} onChange={(event) => setDraft((current) => ({ ...current, targetPerPeriod: Number(event.target.value) }))} /></label>
          <div className="module-form-actions"><button className="primary" type="submit" disabled={!draft.title.trim() || busyId === 'create'}>{busyId === 'create' ? 'Сохраняю…' : 'Сохранить'}</button><button className="secondary" type="button" disabled={busyId === 'create'} onClick={() => setAdding(false)}>Отмена</button></div>
        </form>
      )}
      {!canPersist && <p className="module-persistence-note">Привычки сохраняются для профиля, открытого через Telegram.</p>}
    </section>
  );
}
