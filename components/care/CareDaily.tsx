'use client';

import { inflectPetName } from '@/lib/copy';
import { careDomains } from '@/lib/careDomains';
import type { CareDomain } from '@/lib/reminder';
import type { HealthEntryView } from '@/components/health/HealthTimelineScreen';
import { completedInCurrentPeriod, type HabitView } from '@/components/habits/HabitScreen';
import { ExactIcon } from '@/components/exact/ExactShell';

export function CareObservations(p: {
  dogName: string; entries: HealthEntryView[]; loading: boolean; error?: string;
  onRetry: () => void; onCreate: () => void; onHistory: () => void; onOpen: (id: string) => void;
}) {
  const latest = p.entries[0];
  const summary = latest && (latest.note || latest.value || [latest.mood, latest.appetite, latest.energy, latest.stool].filter(Boolean).join(' · '));
  return <section className="cw-daily" aria-label="Наблюдения в заботе">
    <h2>Как дела у {inflectPetName(p.dogName, 'gent')}?</h2>
    {p.loading ? <p role="status">Загружаю наблюдения…</p> : p.error ? <p role="alert">{p.error} <button type="button" onClick={p.onRetry}>Повторить</button></p> : latest ?
      <button type="button" className="cw-observation" onClick={() => p.onOpen(latest.id)}><span>{summary}</span><small>{new Date(latest.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</small></button> :
      <p className="cw-meta">Самочувствие, настроение или то, что заметил сегодня.</p>}
    <div className="cw-daily-actions"><button type="button" className="secondary" onClick={p.onCreate}>Добавить наблюдение</button><button type="button" className="text-button" onClick={p.onHistory}>История наблюдений</button></div>
  </section>;
}

const habitDomains: Record<string, CareDomain> = { walk: 'activity', feeding: 'food', medication: 'health', grooming: 'care', training: 'behavior' };

export function CareHabits(p: {
  habits: HabitView[]; loading: boolean; error?: string; mutationError?: string;
  busyId: string | null; canPersist: boolean; domain?: CareDomain;
  onRetry: () => void; onManage: () => void; onCheckIn: (id: string) => Promise<void>;
}) {
  const habits = p.habits.filter(h => h.status === 'active' && (!p.domain || habitDomains[h.kind] === p.domain));
  return <section className="cw-daily" aria-label="Регулярные дела в заботе">
    <h2>Регулярно</h2>
    {p.loading ? <p role="status">Загружаю регулярные дела…</p> : p.error ? <p role="alert">{p.error} <button type="button" onClick={p.onRetry}>Повторить</button></p> : habits.length ?
      <div className="cw-habits">{habits.slice(0, 3).map(h => {
        const count = completedInCurrentPeriod(h), done = count >= h.targetPerPeriod;
        return <article className="cw-habit" key={h.id}>
          <button type="button" className="cw-event-open" onClick={p.onManage}><strong>{h.title}</strong><small>{h.cadence === 'daily' ? 'Сегодня' : 'На этой неделе'} · {count} из {h.targetPerPeriod}{!p.domain && habitDomains[h.kind] ? ` · ${careDomains[habitDomains[h.kind]].title}` : ''}</small></button>
          <button type="button" className="cw-check" aria-label={`${done ? 'Выполнено' : 'Отметить'}: ${h.title}`} disabled={!p.canPersist || Boolean(p.busyId) || done} onClick={() => void p.onCheckIn(h.id)}>{p.busyId === h.id ? <span aria-label="Сохраняю">…</span> : <ExactIcon name="check" />}</button>
        </article>;
      })}</div> : <p className="cw-meta">{p.domain ? 'Здесь будут регулярные дела этой области.' : 'Прогулки, кормление, занятия — в вашем ритме.'}</p>}
    {p.mutationError && <p role="alert" className="cw-error">{p.mutationError}</p>}
    <button type="button" className="text-button" onClick={p.onManage}>{habits.length ? 'Все регулярные дела' : 'Настроить регулярные дела'}</button>
  </section>;
}
