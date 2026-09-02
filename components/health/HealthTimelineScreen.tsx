'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, CaretLeft, CaretRight, Heartbeat } from '@phosphor-icons/react';
import { ObservationEditor, type ObservationEditorDraft } from '@/components/care/ObservationEditor';
import { ObservationMetricFields, observationMetricCount, observationMetricDefinitions } from '@/components/health/ObservationMetricFields';
import { parasiteOptions, vaccineOptions } from '@/lib/data';

export type HealthEntryView = {
  id: string;
  mood?: string;
  appetite?: string;
  stool?: string;
  energy?: string;
  note?: string;
  createdAt: string;
};

function observationDate(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
    time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
  };
}

function dayKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function dateFromDayKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function monthLabel(value: Date) {
  return value.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
}

function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function observationCountLabel(count: number) {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} отметок`;
  if (count % 10 === 1) return `${count} отметка`;
  if (count % 10 >= 2 && count % 10 <= 4) return `${count} отметки`;
  return `${count} отметок`;
}

const calendarWeekdays = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

export function HealthTimelineScreen({
  dogName,
  entries,
  draft,
  saving,
  error,
  onBack,
  onDraftChange,
  onSave,
  onRetry,
  editingId,
  editDraft,
  mutationBusy,
  onStartEdit,
  onEditDraftChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  facts,
  onFactChange,
  onSaveFacts,
}: {
  dogName: string;
  entries: HealthEntryView[];
  draft: ObservationEditorDraft;
  saving: boolean;
  error?: string;
  onBack: () => void;
  onDraftChange: (patch: Partial<ObservationEditorDraft>) => void;
  onSave: () => Promise<void>;
  onRetry: () => Promise<void>;
  editingId: string | null;
  editDraft: ObservationEditorDraft;
  mutationBusy: boolean;
  onStartEdit: (entry: HealthEntryView) => void;
  onEditDraftChange: (patch: Partial<ObservationEditorDraft>) => void;
  onSaveEdit: (id: string) => Promise<void>;
  onCancelEdit: () => void;
  onDelete: (id: string) => Promise<void>;
  facts: { allergies: string; medication: string; vaccineStatus: string; parasiteStatus: string; healthNotes: string };
  onFactChange: (patch: Partial<typeof facts>) => void;
  onSaveFacts: () => Promise<void>;
}) {
  const selectedMetricCount = observationMetricCount(draft);
  const [today] = useState(() => new Date());
  const latestDay = useMemo(() => entries.reduce<string | null>((latest, entry) => {
    const key = dayKey(entry.createdAt);
    return !latest || key > latest ? key : latest;
  }, null), [entries]);
  const [selectedDayOverride, setSelectedDayOverride] = useState<string | null>(null);
  const [visibleMonthOverride, setVisibleMonthOverride] = useState<Date | null>(null);
  const selectedDay = selectedDayOverride || latestDay || dayKey(today);
  const selectedDate = dateFromDayKey(selectedDay);
  const visibleMonth = visibleMonthOverride || new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const observationCounts = useMemo(() => entries.reduce<Map<string, number>>((counts, entry) => {
    const key = dayKey(entry.createdAt);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map()), [entries]);
  const selectedDayEntries = useMemo(() => entries
    .filter((entry) => dayKey(entry.createdAt) === selectedDay)
    .slice()
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt)), [entries, selectedDay]);
  const firstWeekday = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();

  const selectDay = (date: Date) => {
    setSelectedDayOverride(dayKey(date));
    setVisibleMonthOverride(new Date(date.getFullYear(), date.getMonth(), 1));
    onCancelEdit();
  };

  const moveMonth = (offset: number) => {
    const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    const observedDay = entries
      .filter((entry) => {
        const date = new Date(entry.createdAt);
        return date.getFullYear() === nextMonth.getFullYear() && date.getMonth() === nextMonth.getMonth();
      })
      .map((entry) => dayKey(entry.createdAt))
      .sort()
      .at(-1);
    setVisibleMonthOverride(nextMonth);
    setSelectedDayOverride(observedDay || dayKey(nextMonth));
    onCancelEdit();
  };

  return (
    <section className="module-screen health-screen" aria-labelledby="health-screen-title">
      <button className="secondary-flow-back" type="button" onClick={onBack}><ArrowLeft weight="bold" aria-hidden="true" /> Назад во Всё</button>
      <header className="module-screen-heading">
        <span className="module-screen-icon"><Heartbeat weight="duotone" aria-hidden="true" /></span>
        <div><h2 id="health-screen-title">Здоровье {dogName}</h2><p>{entries.length ? `${observationCountLabel(entries.length)} владельца` : 'Наблюдений пока нет'}</p></div>
      </header>

      {error && <div className="module-error" role="alert"><b>История не загрузилась</b><p>{error}</p><button type="button" onClick={() => void onRetry()}>Повторить</button></div>}

      <form className="health-capture" onSubmit={async (event) => {
        event.preventDefault();
        await onSave();
        const now = new Date();
        setSelectedDayOverride(dayKey(now));
        setVisibleMonthOverride(new Date(now.getFullYear(), now.getMonth(), 1));
      }}>
        <header className="health-capture-heading"><div><h3>Новая отметка</h3><p>Отметь только факты. Незаполненные показатели останутся пустыми.</p></div><span className="health-capture-progress" aria-label={`${selectedMetricCount} из 4 показателей отмечено`}>{selectedMetricCount}/4</span></header>
        <ObservationMetricFields values={draft} onChange={onDraftChange} />
        <details className="health-capture-context">
          <summary><span>Добавить контекст</span><small>необязательно</small></summary>
          <label><span className="sr-only">Контекст наблюдения</span><textarea value={draft.note || ''} onChange={(event) => onDraftChange({ note: event.target.value })} placeholder="Например, после долгой прогулки или смены корма" /></label>
        </details>
        <button className="primary" type="submit" disabled={saving || !draft.mood && !draft.appetite && !draft.stool && !draft.energy && !draft.note?.trim()}>{saving ? 'Сохраняю…' : 'Записать наблюдение'}</button>
      </form>

      <details className="health-facts">
        <summary>Постоянные данные здоровья</summary>
        <div className="module-form">
          <label>Аллергии<input value={facts.allergies} onChange={(event) => onFactChange({ allergies: event.target.value })} placeholder="Если есть" /></label>
          <label>Лекарства<input value={facts.medication} onChange={(event) => onFactChange({ medication: event.target.value })} placeholder="Только как заметка владельца" /></label>
          <label>Прививки<select value={facts.vaccineStatus} onChange={(event) => onFactChange({ vaccineStatus: event.target.value })}><option value="">Не указано</option>{vaccineOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Обработки<select value={facts.parasiteStatus} onChange={(event) => onFactChange({ parasiteStatus: event.target.value })}><option value="">Не указано</option>{parasiteOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Заметки<textarea value={facts.healthNotes} onChange={(event) => onFactChange({ healthNotes: event.target.value })} placeholder="Факты владельца, без самодиагноза" /></label>
          <button className="primary" type="button" disabled={saving} onClick={() => void onSaveFacts()}>Сохранить постоянные данные</button>
        </div>
      </details>

      <section className="health-timeline health-calendar" aria-label="История наблюдений" data-observation-calendar>
        <header className="health-timeline-heading"><div><h3>Календарь наблюдений</h3><p>{entries.length ? 'Выбери день — ниже будут только его отметки.' : 'Первая отметка появится в календаре.'}</p></div>{entries.length > 0 && <span>{entries.length}</span>}</header>
        <div className="health-calendar-panel">
          <header className="health-calendar-toolbar">
            <button type="button" aria-label="Предыдущий месяц" onClick={() => moveMonth(-1)}><CaretLeft weight="bold" aria-hidden="true" /></button>
            <b aria-live="polite">{monthLabel(visibleMonth)}</b>
            <button type="button" aria-label="Следующий месяц" onClick={() => moveMonth(1)}><CaretRight weight="bold" aria-hidden="true" /></button>
          </header>
          <div className="health-calendar-weekdays" aria-hidden="true">{calendarWeekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
          <div className="health-calendar-grid">
            {Array.from({ length: firstWeekday }, (_, index) => <span className="health-calendar-blank" key={`blank-${index}`} aria-hidden="true" />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1);
              const key = dayKey(date);
              const count = observationCounts.get(key) || 0;
              const isSelected = key === selectedDay;
              const isToday = key === dayKey(today);
              return <button
                type="button"
                key={key}
                className={`${isSelected ? 'is-selected' : ''}${count ? ' has-observations' : ''}`}
                aria-label={`${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}${count ? `, наблюдений: ${count}` : ', наблюдений нет'}`}
                aria-pressed={isSelected}
                data-today={isToday || undefined}
                onClick={() => selectDay(date)}
              ><span>{index + 1}</span>{count > 0 && <small>{count}</small>}</button>;
            })}
          </div>
        </div>

        <header className="health-selected-day-heading">
          <div><h4>{capitalizeFirst(selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }))}</h4><p>{selectedDayEntries.length ? observationCountLabel(selectedDayEntries.length) : 'Без отметок'}</p></div>
        </header>
        {!error && selectedDayEntries.length ? selectedDayEntries.map((entry) => {
          const recorded = observationMetricCount(entry);
          const when = observationDate(entry.createdAt);
          return <article key={entry.id}>
          {editingId === entry.id ? <ObservationEditor draft={editDraft} busy={mutationBusy} onChange={onEditDraftChange} onCancel={onCancelEdit} onSave={() => onSaveEdit(entry.id)} /> : <>
            <header className="health-observation-heading"><time dateTime={entry.createdAt}><b>{when.time}</b></time><span>{recorded ? `${recorded} из 4` : 'без показателей'}</span></header>
            <dl className="health-observation-grid" data-observation-metrics>
              {observationMetricDefinitions.map(({ key, label }) => <div key={key} data-state={entry[key] ? 'recorded' : 'empty'}><dt>{label}</dt><dd>{entry[key] || 'не отмечено'}</dd></div>)}
            </dl>
            {entry.note && <details className="health-observation-context"><summary>Контекст владельца <span>открыть</span></summary><p>{entry.note}</p></details>}
            <div className="care-row-actions health-observation-actions"><button type="button" disabled={mutationBusy} onClick={() => onStartEdit(entry)}>Изменить</button><button type="button" className="danger-action" disabled={mutationBusy} onClick={() => void onDelete(entry.id)}>Убрать</button></div>
          </>}
        </article>;
        }) : !error ? <div className="module-empty"><b>В этот день отметок нет</b><p>Можно выбрать другой день или добавить новую отметку выше.</p></div> : null}
      </section>
    </section>
  );
}
