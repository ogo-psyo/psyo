'use client';

import { ObservationMetricFields, observationMetricCount } from '@/components/health/ObservationMetricFields';

export type ObservationEditorDraft = {
  mood: string;
  appetite: string;
  stool: string;
  energy: string;
  note?: string;
};

export function ObservationEditor({
  draft,
  busy,
  onChange,
  onCancel,
  onSave,
}: {
  draft: ObservationEditorDraft;
  busy: boolean;
  onChange: (patch: Partial<ObservationEditorDraft>) => void;
  onCancel: () => void;
  onSave: () => Promise<void>;
}) {
  const metricCount = observationMetricCount(draft);
  return (
    <form className="observation-form structured-observation-editor" onSubmit={async (event) => {
      event.preventDefault();
      await onSave();
    }}>
      <header><div><b>Изменить показатели</b><small>{metricCount ? `${metricCount} из 4 отмечено` : 'Показатели не отмечены'}</small></div></header>
      <ObservationMetricFields values={draft} onChange={onChange} compact />
      <details className="observation-edit-context">
        <summary>Изменить контекст <span>необязательно</span></summary>
        <label><span className="sr-only">Контекст наблюдения</span><textarea value={draft.note || ''} onChange={(event) => onChange({ note: event.target.value })} placeholder="Например, после долгой прогулки" /></label>
      </details>
      <div className="care-row-actions">
        <button type="submit" disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить запись'}</button>
        <button type="button" onClick={onCancel} disabled={busy}>Отмена</button>
      </div>
    </form>
  );
}
