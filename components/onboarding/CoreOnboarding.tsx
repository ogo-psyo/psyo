'use client';

import { useEffect, useRef } from 'react';

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
    const background = Array.from(document.querySelectorAll<HTMLElement>('#pso-exact-content, .exact-header, .nav-wrap'));
    const previousInert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus({ preventScroll: true }));

    const viewport = window.visualViewport;
    const syncVisibleViewport = () => {
      const backdrop = backdropRef.current;
      if (!backdrop) return;
      backdrop.style.setProperty('--dog-sheet-viewport-height', `${Math.max(0, viewport?.height || window.innerHeight)}px`);
    };
    syncVisibleViewport();
    viewport?.addEventListener('resize', syncVisibleViewport);
    window.addEventListener('resize', syncVisibleViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', syncVisibleViewport);
      window.removeEventListener('resize', syncVisibleViewport);
      background.forEach((element, index) => { element.inert = previousInert[index]; });
      document.body.style.overflow = previousOverflow;
      const returnTarget = previousFocusRef.current?.isConnected && previousFocusRef.current.matches('button, a[href], input, select, textarea, [role=button]')
        ? previousFocusRef.current
        : document.querySelector<HTMLElement>('.first-run-activation button');
      returnTarget?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;


  return (
    <div
      ref={backdropRef}
      className="care-dialog-backdrop dog-creation-backdrop exact-extension"
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
          <div className="dog-creation-field"><label htmlFor="dog-creation-name">Имя собаки</label>
          <input
            id="dog-creation-name"
            value={dogName}
            onChange={(event) => onNameChange(event.target.value)}
            autoComplete="off"
            placeholder="Например, Боня"
            maxLength={80}
            disabled={busy}
          />
          </div>
          <div className="dog-creation-core-fields">
            <div className="dog-creation-field"><label htmlFor="dog-creation-age">Возраст или дата рождения</label>
              <input
                id="dog-creation-age"
                list="dog-creation-age-options"
                value={lifeStage}
                onChange={(event) => onLifeStageChange(event.target.value)}
                placeholder="2 года 4 месяца"
                autoComplete="off"
                maxLength={60}
                disabled={busy}
              />
              <datalist id="dog-creation-age-options">
                {lifeStageOptions.map((option) => <option key={option} value={option} />)}
              </datalist>
            </div>
            <div className="dog-creation-field"><label htmlFor="dog-creation-sex">Пол</label>
              <select id="dog-creation-sex" value={sex === 'не указано' ? '' : sex} onChange={(event) => onSexChange(event.target.value)} disabled={busy}>
                <option value="">Не указывать</option>
                {sexOptions.filter(option => option.toLocaleLowerCase('ru') !== 'не указано').map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>
          <div className="dog-creation-field"><label htmlFor="dog-creation-breed">Порода</label>
            <input
              id="dog-creation-breed"
              list="dog-creation-breed-options"
              value={breedValue}
              onChange={(event) => onBreedChange(event.target.value)}
              placeholder="Например, корги или метис"
              autoComplete="off"
              maxLength={80}
              disabled={busy}
              aria-describedby="dog-creation-breed-note"
            />
            <datalist id="dog-creation-breed-options">
              {breedOptions.map((option) => <option key={option.id} value={option.title} />)}
            </datalist>
          </div>
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
