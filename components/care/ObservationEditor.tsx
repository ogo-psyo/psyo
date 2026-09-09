'use client';

import { isPrimaryObservationFact, observationTypeLabel } from '@/lib/observationLabels';
import { ObservationMetricFields } from '@/components/health/ObservationMetricFields';

export type ObservationEditorDraft = {
  mood: string;
  appetite: string;
  stool: string;
  energy: string;
  note?: string;
  type?:string;value?:string;
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
  return (
    <form className="observation-form structured-observation-editor" onSubmit={async (event) => {
      event.preventDefault();
      await onSave();
    }}>
      <fieldset disabled={busy}>
      {isPrimaryObservationFact(draft.type)&&<label>{observationTypeLabel(draft.type)}<input required value={draft.value||''} onChange={event=>onChange({value:event.target.value})}/></label>}
      <label>Текст записи<textarea maxLength={8000} value={draft.note||''} onChange={event=>onChange({note:event.target.value})}/></label>
      <details className="observation-edit-context"><summary>Изменить показатели</summary><ObservationMetricFields values={draft} onChange={onChange} compact/></details>
      <div className="care-row-actions">
        <button type="submit" disabled={busy||!draft.value?.trim()&&!draft.note?.trim()&&!draft.mood&&!draft.appetite&&!draft.stool&&!draft.energy}>{busy ? 'Сохраняю…' : 'Сохранить запись'}</button>
        <button type="button" onClick={onCancel} disabled={busy}>Свернуть</button>
      </div>
      </fieldset>
    </form>
  );
}
