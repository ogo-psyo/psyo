'use client';

import { ArrowLeft, Heartbeat } from '@phosphor-icons/react';
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
  return (
    <section className="module-screen health-screen" aria-labelledby="health-screen-title">
      <button className="secondary-flow-back" type="button" onClick={onBack}><ArrowLeft weight="bold" aria-hidden="true" /> Назад во Всё</button>
      <header className="module-screen-heading">
        <span className="module-screen-icon"><Heartbeat weight="duotone" aria-hidden="true" /></span>
        <div><h2 id="health-screen-title">Здоровье {dogName}</h2><p>{entries.length ? `${entries.length} записей владельца` : 'Наблюдений пока нет'}</p></div>
      </header>

      {error && <div className="module-error" role="alert"><b>История не загрузилась</b><p>{error}</p><button type="button" onClick={() => void onRetry()}>Повторить</button></div>}

      <form className="health-capture" onSubmit={async (event) => { event.preventDefault(); await onSave(); }}>
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

      <section className="health-timeline" aria-label="История наблюдений">
        <header className="health-timeline-heading"><div><h3>Наблюдения</h3><p>{entries.length ? 'Показатели собраны отдельно — их удобно сравнивать между записями.' : 'Первая отметка станет точкой отсчёта.'}</p></div>{entries.length > 0 && <span>{entries.length}</span>}</header>
        {!error && entries.length ? entries.map((entry) => {
          const recorded = observationMetricCount(entry);
          const when = observationDate(entry.createdAt);
          return <article key={entry.id}>
          {editingId === entry.id ? <ObservationEditor draft={editDraft} busy={mutationBusy} onChange={onEditDraftChange} onCancel={onCancelEdit} onSave={() => onSaveEdit(entry.id)} /> : <>
            <header className="health-observation-heading"><time dateTime={entry.createdAt}><b>{when.date}</b><small>{when.time}</small></time><span>{recorded ? `${recorded} из 4` : 'без показателей'}</span></header>
            <dl className="health-observation-grid" data-observation-metrics>
              {observationMetricDefinitions.map(({ key, label }) => <div key={key} data-state={entry[key] ? 'recorded' : 'empty'}><dt>{label}</dt><dd>{entry[key] || 'не отмечено'}</dd></div>)}
            </dl>
            {entry.note && <details className="health-observation-context"><summary>Контекст владельца <span>открыть</span></summary><p>{entry.note}</p></details>}
            <div className="care-row-actions health-observation-actions"><button type="button" disabled={mutationBusy} onClick={() => onStartEdit(entry)}>Изменить</button><button type="button" className="danger-action" disabled={mutationBusy} onClick={() => void onDelete(entry.id)}>Убрать</button></div>
          </>}
        </article>;
        }) : !error ? <div className="module-empty"><b>История начнётся с первой отметки</b><p>Выбери один или несколько показателей. Комментарий можно добавить только как контекст.</p></div> : null}
      </section>
    </section>
  );
}
