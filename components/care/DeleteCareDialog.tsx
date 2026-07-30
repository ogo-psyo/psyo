'use client';

import { useEffect, useRef } from 'react';

export type PendingCareDeletion = {
  id: string;
  title: string;
} | null;

export function DeleteCareDialog({
  reminder,
  busy,
  onCancel,
  onConfirm,
}: {
  reminder: PendingCareDeletion;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (id: string) => Promise<void>;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (reminder) cancelRef.current?.focus();
  }, [reminder]);

  if (!reminder) return null;

  return (
    <div
      className="care-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) onCancel();
      }}
    >
      <section
        className="care-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="care-delete-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) onCancel();
        }}
      >
        <p className="eyebrow">план ухода</p>
        <h2 id="care-delete-title">Удалить дело?</h2>
        <p>«{reminder.title}» исчезнет из плана и истории. Это действие нельзя отменить.</p>
        <div>
          <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>Отмена</button>
          <button
            className="danger-action"
            type="button"
            onClick={() => onConfirm(reminder.id)}
            disabled={busy}
          >
            {busy ? 'Удаляю…' : 'Удалить дело'}
          </button>
        </div>
      </section>
    </div>
  );
}
