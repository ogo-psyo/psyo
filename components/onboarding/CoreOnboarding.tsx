'use client';

import { type FocusEvent, useEffect, useRef } from 'react';

export function CoreOnboarding({
  open,
  dogName,
  lifeStage,
  sex,
  breedValue,
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
  breedValue: string;
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
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const page = document.querySelector<HTMLElement>('.phone-shell');
    page?.setAttribute('inert', '');
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus({ preventScroll: true }));

    const viewport = window.visualViewport;
    const syncVisibleViewport = () => {
      const backdrop = backdropRef.current;
      if (!backdrop) return;
      backdrop.style.setProperty('--dog-sheet-viewport-top', `${Math.max(0, viewport?.offsetTop || 0)}px`);
      backdrop.style.setProperty('--dog-sheet-viewport-height', `${Math.max(0, viewport?.height || window.innerHeight)}px`);
    };
    syncVisibleViewport();
    viewport?.addEventListener('resize', syncVisibleViewport);
    viewport?.addEventListener('scroll', syncVisibleViewport);
    window.addEventListener('resize', syncVisibleViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', syncVisibleViewport);
      viewport?.removeEventListener('scroll', syncVisibleViewport);
      window.removeEventListener('resize', syncVisibleViewport);
      page?.removeAttribute('inert');
      const returnTarget = previousFocusRef.current?.isConnected
        ? previousFocusRef.current
        : document.querySelector<HTMLElement>('.first-run-activation button');
      returnTarget?.focus();
      window.requestAnimationFrame(() => returnTarget?.focus());
    };
  }, [open]);

  if (!open) return null;

  const keepFieldVisible = (event: FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const field = event.currentTarget;
    window.setTimeout(() => field.scrollIntoView({ block: 'center', behavior: 'auto' }), 120);
  };

  return (
    <div
      ref={backdropRef}
      className="care-dialog-backdrop dog-creation-backdrop"
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
        tabIndex={-1}
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
        <p>Начни с имени. Остальное можно написать своими словами или заполнить позже.</p>
        <form onSubmit={(event) => { event.preventDefault(); void onSubmit(); }}>
          <label htmlFor="dog-creation-name">Имя собаки</label>
          <input
            id="dog-creation-name"
            value={dogName}
            onChange={(event) => onNameChange(event.target.value)}
            onFocus={keepFieldVisible}
            autoComplete="off"
            placeholder="Например, Боня"
            maxLength={80}
            disabled={busy}
          />
          <div className="dog-creation-core-fields">
            <label htmlFor="dog-creation-age">Возраст или дата рождения
              <input
                id="dog-creation-age"
                list="dog-creation-age-options"
                value={lifeStage}
                onChange={(event) => onLifeStageChange(event.target.value)}
                onFocus={keepFieldVisible}
                placeholder="2 года 4 месяца"
                autoComplete="off"
                maxLength={60}
                disabled={busy}
              />
              <datalist id="dog-creation-age-options">
                {lifeStageOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </label>
            <label htmlFor="dog-creation-sex">Пол
              <select id="dog-creation-sex" value={sex} onChange={(event) => onSexChange(event.target.value)} onFocus={keepFieldVisible} disabled={busy}>
                <option value="">Не указывать</option>
                {sexOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
          <label htmlFor="dog-creation-breed">Порода
            <input
              id="dog-creation-breed"
              list="dog-creation-breed-options"
              value={breedValue}
              onChange={(event) => onBreedChange(event.target.value)}
              onFocus={keepFieldVisible}
              placeholder="Например, корги или метис"
              autoComplete="off"
              maxLength={80}
              disabled={busy}
              aria-describedby="dog-creation-breed-note"
            />
            <datalist id="dog-creation-breed-options">
              {breedOptions.map((option) => <option key={option.id} value={option.title} />)}
            </datalist>
          </label>
          <small id="dog-creation-breed-note" className="dog-creation-note">Можно указать любую породу, написать «метис» или оставить поле пустым.</small>
          <div className="onboarding-step-actions">
            <button type="button" onClick={onDismiss} disabled={busy}>Не сейчас</button>
            <button className="primary" type="submit" disabled={busy || !dogName.trim()}>
              {busy ? 'Создаю профиль…' : 'Завести профиль'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
