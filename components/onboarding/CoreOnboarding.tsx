'use client';

import { useEffect, useRef } from 'react';

export function CoreOnboarding({
  open,
  dogName,
  lifeStage,
  sex,
  breedId,
  lifeStageOptions,
  sexOptions,
  breedOptions,
  busy,
  onNameChange,
  onLifeStageChange,
  onSexChange,
  onBreedChange,
  onDismiss,
  onSubmit,
}: {
  open: boolean;
  dogName: string;
  lifeStage: string;
  sex: string;
  breedId: string;
  lifeStageOptions: readonly string[];
  sexOptions: readonly string[];
  breedOptions: readonly { id: string; title: string }[];
  busy: boolean;
  onNameChange: (value: string) => void;
  onLifeStageChange: (value: string) => void;
  onSexChange: (value: string) => void;
  onBreedChange: (value: string) => void;
  onDismiss: () => void;
  onSubmit: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const page = document.querySelector<HTMLElement>('.phone-shell');
    page?.setAttribute('inert', '');
    inputRef.current?.focus();
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(frame);
      page?.removeAttribute('inert');
      const returnTarget = previousFocusRef.current?.isConnected
        ? previousFocusRef.current
        : document.querySelector<HTMLElement>('.first-run-activation button');
      returnTarget?.focus();
      window.requestAnimationFrame(() => returnTarget?.focus());
    };
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
        ref={dialogRef}
        className="care-delete-dialog dog-creation-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dog-creation-title"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !busy) onDismiss();
          if (event.key !== 'Tab') return;

          const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || []);
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 id="dog-creation-title">Профиль собаки</h2>
        <p>Соберём короткий каркас. Подробности появятся позже — внутри нужных функций.</p>
        <form onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
          <label htmlFor="dog-creation-name">Имя собаки</label>
          <input
            ref={inputRef}
            id="dog-creation-name"
            value={dogName}
            onChange={(event) => onNameChange(event.target.value)}
            autoFocus
            autoComplete="off"
            maxLength={80}
            disabled={busy}
          />
          <div className="dog-creation-core-fields">
            <label htmlFor="dog-creation-age">Возраст
              <select id="dog-creation-age" value={lifeStage} onChange={(event) => onLifeStageChange(event.target.value)} disabled={busy} required>
                <option value="">Выбрать</option>
                {lifeStageOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label htmlFor="dog-creation-sex">Пол
              <select id="dog-creation-sex" value={sex} onChange={(event) => onSexChange(event.target.value)} disabled={busy} required>
                <option value="">Выбрать</option>
                {sexOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <label htmlFor="dog-creation-breed">Порода
            <select id="dog-creation-breed" value={breedId} onChange={(event) => onBreedChange(event.target.value)} disabled={busy}>
              {breedOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
            </select>
          </label>
          <small className="dog-creation-note">«Метис / не знаю» — полноценный вариант. Псё не угадывает здоровье по породе.</small>
          <div className="onboarding-step-actions">
            <button type="button" onClick={onDismiss} disabled={busy}>Не сейчас</button>
            <button className="primary" type="submit" disabled={busy || !dogName.trim() || !lifeStage || !sex}>
              {busy ? 'Создаю профиль…' : 'Завести профиль'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
