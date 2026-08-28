'use client';

import { ArrowLeft, Heartbeat } from '@phosphor-icons/react';
import { ObservationEditor, type ObservationEditorDraft } from '@/components/care/ObservationEditor';
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

const choices = {
  mood: ['спокойное', 'радостное', 'тревожное', 'вялое'],
  appetite: ['обычный', 'ниже обычного', 'выше обычного', 'не ела'],
  stool: ['обычный', 'мягкий', 'твёрдый', 'не было'],
  energy: ['обычная', 'ниже обычного', 'выше обычного', 'нет сил'],
};

function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <fieldset className="health-choice"><legend>{label}</legend><div>{options.map((option) => <button key={option} type="button" className={value === option ? 'active' : ''} aria-pressed={value === option} onClick={() => onChange(value === option ? '' : option)}>{option}</button>)}</div></fieldset>;
}

function entrySummary(entry: HealthEntryView) {
  return [entry.mood, entry.appetite && `аппетит ${entry.appetite}`, entry.stool && `стул ${entry.stool}`, entry.energy && `энергия ${entry.energy}`].filter(Boolean);
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
  return (
    <section className="module-screen health-screen" aria-labelledby="health-screen-title">
      <button className="secondary-flow-back" type="button" onClick={onBack}><ArrowLeft weight="bold" aria-hidden="true" /> Назад во Всё</button>
      <header className="module-screen-heading">
        <span className="module-screen-icon"><Heartbeat weight="duotone" aria-hidden="true" /></span>
        <div><h2 id="health-screen-title">Здоровье {dogName}</h2><p>{entries.length ? `${entries.length} записей владельца` : 'Наблюдений пока нет'}</p></div>
      </header>

      {error && <div className="module-error" role="alert"><b>История не загрузилась</b><p>{error}</p><button type="button" onClick={() => void onRetry()}>Повторить</button></div>}

      <form className="health-capture" onSubmit={async (event) => { event.preventDefault(); await onSave(); }}>
        <h3>Что заметили?</h3>
        <p>Выбери только то, что действительно заметил. Остальное Псё не будет додумывать.</p>
        <Choice label="Настроение" value={draft.mood} options={choices.mood} onChange={(value) => onDraftChange({ mood: value })} />
        <Choice label="Аппетит" value={draft.appetite} options={choices.appetite} onChange={(value) => onDraftChange({ appetite: value })} />
        <Choice label="Стул" value={draft.stool} options={choices.stool} onChange={(value) => onDraftChange({ stool: value })} />
        <Choice label="Энергия" value={draft.energy} options={choices.energy} onChange={(value) => onDraftChange({ energy: value })} />
        <label>Заметка <span>необязательно</span><textarea value={draft.note || ''} onChange={(event) => onDraftChange({ note: event.target.value })} placeholder="Что изменилось?" /></label>
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
        <h3>История</h3>
        {!error && entries.length ? entries.map((entry) => <article key={entry.id}>
          {editingId === entry.id ? <ObservationEditor draft={editDraft} busy={mutationBusy} onChange={onEditDraftChange} onCancel={onCancelEdit} onSave={() => onSaveEdit(entry.id)} /> : <>
            <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</time>
            <div><b>{entrySummary(entry)[0] || 'Заметка владельца'}</b>{entrySummary(entry).slice(1).length > 0 && <p>{entrySummary(entry).slice(1).join(' · ')}</p>}{entry.note && <small>{entry.note}</small>}<div className="care-row-actions"><button type="button" disabled={mutationBusy} onClick={() => onStartEdit(entry)}>Изменить</button><button type="button" className="danger-action" disabled={mutationBusy} onClick={() => void onDelete(entry.id)}>Убрать</button></div></div>
          </>}
        </article>) : !error ? <div className="module-empty"><b>История начнётся с первой записи</b><p>Это факты владельца, а не диагноз или автоматическая рекомендация.</p></div> : null}
      </section>
    </section>
  );
}
