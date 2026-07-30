'use client';

export type CareFeedback =
  | { kind: 'completed'; reminderId: string; title: string }
  | { kind: 'created'; reminderId: string; title: string }
  | { kind: 'rescheduled'; reminderId: string; title: string }
  | null;

export function CareActionNotice({
  feedback,
  onUndo,
  onDismiss,
}: {
  feedback: CareFeedback;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  if (!feedback) return null;

  const label = feedback.kind === 'completed'
    ? `Готово: ${feedback.title}`
    : feedback.kind === 'created'
      ? `Добавлено: ${feedback.title}`
      : `Перенесено: ${feedback.title}`;

  return (
    <div className="care-action-notice" role="status" aria-live="polite">
      <span>{label}</span>
      {feedback.kind === 'completed' && (
        <button type="button" onClick={onUndo}>Отменить</button>
      )}
      <button type="button" aria-label="Закрыть сообщение" onClick={onDismiss}>×</button>
    </div>
  );
}
