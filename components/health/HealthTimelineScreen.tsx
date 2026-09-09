'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, CaretLeft, CaretRight } from '@phosphor-icons/react';
import { ObservationEditor, type ObservationEditorDraft } from '@/components/care/ObservationEditor';
import { ObservationMetricFields, observationMetricDefinitions } from '@/components/health/ObservationMetricFields';
import { isPrimaryObservationFact, observationTypeLabel } from '@/lib/observationLabels';
import styles from './HealthTimeline.module.css';
import { parasiteOptions, vaccineOptions } from '@/lib/data';

export type HealthEntryView = {
  id: string;
  type?:string;value?:string;
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
  loading,hasMore,onLoadMore,captureOpen,onCaptureOpen,issue,recentlyDeleted,onRestore,factsError,factsSaving,
}: {
  dogName: string;
  entries: HealthEntryView[];
  draft: ObservationEditorDraft;
  saving: boolean;
  error?: string;
  onBack: () => void;
  onDraftChange: (patch: Partial<ObservationEditorDraft>) => void;
  onSave: () => Promise<HealthEntryView|null>;
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
  loading:boolean;hasMore:boolean;onLoadMore:()=>Promise<void>;
  captureOpen:boolean;onCaptureOpen:(open:boolean)=>void;
  issue:{scope:string;message:string}|null;
  recentlyDeleted:boolean;onRestore:()=>Promise<void>;factsError:string;factsSaving:boolean;
}) {
  const captureTrigger=useRef<HTMLButtonElement>(null);
  const [calendarOpen,setCalendarOpen]=useState(false);
  const [savedMessage,setSavedMessage]=useState('');
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
    .filter((entry) => !calendarOpen || dayKey(entry.createdAt) === selectedDay)
    .slice()
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)), [entries, selectedDay, calendarOpen]);
  const firstWeekday = (new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();

  const selectDay = (date: Date) => {
    setSelectedDayOverride(dayKey(date));
    setVisibleMonthOverride(new Date(date.getFullYear(), date.getMonth(), 1));
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
  };

  return (
    <section className={`module-screen health-screen ${styles.screen}`} aria-labelledby="health-screen-title">
      <button className="journal-screen-back" type="button" onClick={onBack}><ArrowLeft weight="bold" aria-hidden="true" /> Назад</button>
      <header className="module-screen-heading">
        <div><p>{dogName}</p><h1 id="health-screen-title">Записи и здоровье</h1></div>
      </header>
      <button ref={captureTrigger} className="health-add" type="button" aria-expanded={captureOpen} aria-controls="health-capture" onClick={()=>{setSavedMessage('');onCaptureOpen(!captureOpen);}}>{captureOpen?'Свернуть запись':'Добавить запись'}</button>
      <p className="health-save-status" role="status">{savedMessage}</p>
      {captureOpen && <form id="health-capture" className="health-capture" onSubmit={async event=>{
        event.preventDefault();const saved=await onSave();
        if(!saved)return;
        selectDay(new Date(saved.createdAt));onCaptureOpen(false);setSavedMessage('Запись сохранена.');captureTrigger.current?.focus();
      }}>
        <fieldset disabled={saving||mutationBusy}>
          <label>Текст записи<textarea value={draft.note||''} maxLength={8000} onChange={event=>onDraftChange({note:event.target.value})} placeholder="Что хочется запомнить?" /></label>
          <details className="health-capture-context"><summary>Показатели · по желанию</summary><ObservationMetricFields values={draft} onChange={onDraftChange}/></details>
          {issue?.scope==='create'&&<p role="alert">{issue.message}</p>}
          <button className="primary" type="submit" disabled={!draft.mood&&!draft.appetite&&!draft.stool&&!draft.energy&&!draft.note?.trim()}>{saving?'Сохраняю…':'Записать наблюдение'}</button>
        </fieldset>
      </form>}
      {recentlyDeleted&&<div className="health-restore" role="status">Запись убрана. <button type="button" disabled={saving||mutationBusy} onClick={()=>void onRestore()}>Вернуть запись</button>{issue?.scope==='restore'&&<p role="alert">{issue.message}</p>}</div>}



      {editingId && !selectedDayEntries.some(entry => entry.id === editingId) && <aside role="status">
        <p>Черновик записи остался здесь.</p>
        <button type="button" onClick={() => { const entry = entries.find(item => item.id === editingId); if (entry) selectDay(new Date(entry.createdAt)); }}>Вернуться к редактированию</button>
      </aside>}
      <section className="health-timeline health-calendar" aria-label="История наблюдений" data-observation-calendar>
        <header className="health-timeline-heading"><h2>История</h2>{loading&&<span role="status">Загружаю…</span>}</header>
        {error&&<div className="module-error" role="alert"><p>{error}</p><button type="button" disabled={loading} onClick={()=>void onRetry()}>Повторить загрузку</button></div>}
        <details className="health-date-filter" onToggle={event=>setCalendarOpen(event.currentTarget.open)}><summary>Выбрать день</summary>
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
                aria-label={`${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}${count ? `, наблюдений: ${count}` : hasMore ? ', старые записи могут быть не загружены' : ', наблюдений нет'}`}
                aria-pressed={isSelected}
                data-today={isToday || undefined}
                onClick={() => selectDay(date)}
              ><span>{index + 1}</span>{count > 0 && <small>{count}</small>}</button>;
            })}
          </div>
        </div>

        </details>
        {calendarOpen&&<header className="health-selected-day-heading">
          <div><h4>{capitalizeFirst(selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }))}</h4><p>{selectedDayEntries.length ? observationCountLabel(selectedDayEntries.length) : hasMore?'Старые записи ещё могут быть не загружены':'Без записей'}</p></div>
        </header>}
        {selectedDayEntries.length ? selectedDayEntries.map((entry) => {
          const when = observationDate(entry.createdAt);
          return <article key={entry.id} data-observation-id={entry.id}>
          {editingId === entry.id ? <ObservationEditor draft={editDraft} busy={mutationBusy||saving} onChange={onEditDraftChange} onCancel={onCancelEdit} onSave={() => onSaveEdit(entry.id)} /> : <>
            <header className="health-observation-heading"><time dateTime={entry.createdAt}>{when.date} · {when.time}</time></header>
            {entry.note&&<p className="health-record-text">{entry.note}</p>}
            {isPrimaryObservationFact(entry.type)&&entry.value&&<p className="health-record-text"><span>{observationTypeLabel(entry.type)}: </span>{entry.value}</p>}
            {observationMetricDefinitions.some(({key})=>entry[key])&&<dl className="health-observation-grid" data-observation-metrics>
              {observationMetricDefinitions.filter(({key})=>entry[key]).map(({ key, label }) => <div key={key} data-state={entry[key] ? 'recorded' : 'empty'}><dt>{label}</dt><dd>{entry[key]}</dd></div>)}
            </dl>}

            <div className="care-row-actions health-observation-actions"><button type="button" disabled={mutationBusy||saving} onClick={() => onStartEdit(entry)}>Изменить</button><button type="button" className="danger-action" disabled={mutationBusy||saving} onClick={() => void onDelete(entry.id)}>Убрать</button></div>
          </>}
          {issue?.scope===entry.id&&<p role="alert">{issue.message}</p>}
        </article>;
        }) : !error&&!loading ? <div className="module-empty"><p>{hasMore?'В загруженных записях этого дня нет. Можно открыть более ранние.':calendarOpen?'В этот день записей нет.':'Записей пока нет. Сохраните то, что важно вам.'}</p></div> : null}
        {hasMore&&<button className="health-more" type="button" disabled={loading||saving||mutationBusy} onClick={()=>void onLoadMore()}>{loading?'Загружаю…':'Загрузить более ранние'}</button>}
      </section>
      <details className="health-facts">
        <summary>Постоянные данные здоровья</summary>
        <fieldset className="module-form" disabled={factsSaving}>
          <label>Аллергии<input value={facts.allergies} onChange={(event) => onFactChange({ allergies: event.target.value })} placeholder="Если есть" /></label>
          <label>Лекарства<input value={facts.medication} onChange={(event) => onFactChange({ medication: event.target.value })} placeholder="Только как заметка владельца" /></label>
          <label>Прививки<select value={facts.vaccineStatus} onChange={(event) => onFactChange({ vaccineStatus: event.target.value })}><option value="">Не указано</option>{vaccineOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Обработки<select value={facts.parasiteStatus} onChange={(event) => onFactChange({ parasiteStatus: event.target.value })}><option value="">Не указано</option>{parasiteOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>Заметки<textarea value={facts.healthNotes} onChange={(event) => onFactChange({ healthNotes: event.target.value })} placeholder="Факты владельца, без самодиагноза" /></label>
          <button className="primary" type="button" disabled={factsSaving} onClick={() => void onSaveFacts()}>Сохранить постоянные данные</button>
          {factsError&&<p role="alert">{factsError}</p>}
        </fieldset>
      </details>
    </section>
  );
}
