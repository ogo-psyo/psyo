'use client';

import { useEffect, useRef } from 'react';

export function CoreOnboarding({
  open,
  dogName,
  busy,
  onNameChange,
  onDismiss,
  onSubmit,
}: {
  open: boolean;
  dogName: string;
  busy: boolean;
  onNameChange: (value: string) => void;
  onDismiss: () => void;
  onSubmit: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="care-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !busy) onDismiss();
      }}
    >
      <section
        className="care-delete-dialog dog-creation-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dog-creation-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) onDismiss();
        }}
      >
        <p className="eyebrow">псё</p>
        <h2 id="dog-creation-title">Добавить собаку</h2>
        <p>Сейчас достаточно имени. Остальное можно добавить позже, когда понадобится.</p>
        <form onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
          <label htmlFor="dog-creation-name">Имя собаки</label>
          <input
            ref={inputRef}
            id="dog-creation-name"
            value={dogName}
            onChange={(event) => onNameChange(event.target.value)}
            autoComplete="off"
            maxLength={80}
            disabled={busy}
          />
          <div className="onboarding-step-actions">
            <button type="button" onClick={onDismiss} disabled={busy}>Не сейчас</button>
            <button className="primary" type="submit" disabled={busy || !dogName.trim()}>
              {busy ? 'Добавляю…' : 'Добавить собаку'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
