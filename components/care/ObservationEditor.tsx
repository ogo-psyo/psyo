'use client';

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
  return (
    <form className="observation-form" onSubmit={async (event) => {
      event.preventDefault();
      await onSave();
    }}>
      <label>Настроение<input value={draft.mood} onChange={(event) => onChange({ mood: event.target.value })} /></label>
      <label>Аппетит<input value={draft.appetite} onChange={(event) => onChange({ appetite: event.target.value })} /></label>
      <label>Стул<input value={draft.stool} onChange={(event) => onChange({ stool: event.target.value })} /></label>
      <label>Энергия<input value={draft.energy} onChange={(event) => onChange({ energy: event.target.value })} /></label>
      <label>Заметка<textarea value={draft.note || ''} onChange={(event) => onChange({ note: event.target.value })} placeholder="Что изменилось?" /></label>
      <div className="care-row-actions">
        <button type="submit" disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить запись'}</button>
        <button type="button" onClick={onCancel} disabled={busy}>Отмена</button>
      </div>
    </form>
  );
}
