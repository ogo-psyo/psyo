'use client';

import { useEffect, useRef } from 'react';
import { ChoiceField } from '@/components/system/ChoiceField';

export function CoreOnboarding({
  open,
  dogName,
  lifeStage,
  sex,
  breedValue,
  sexOptions,
  busy,
  error,
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
  sexOptions: readonly string[];
  busy: boolean;
  error?: string;
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
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <h2 id="dog-creation-title">Профиль собаки</h2>
        <p className="lead">Нужно только имя. Остальное — по желанию.</p>
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
            <div className="dog-creation-field"><label htmlFor="dog-creation-age">Возраст</label>
              <input
                id="dog-creation-age"
                value={lifeStage}
                onChange={(event) => onLifeStageChange(event.target.value)}
                placeholder="2 года 4 месяца"
                autoComplete="off"
                maxLength={60}
                disabled={busy}
              />

            </div>
            <ChoiceField label="Пол" value={sex === 'не указано' ? '' : sex}
              options={[{value: '', label: 'Не указывать'}, ...sexOptions.filter(option => option.toLocaleLowerCase('ru') !== 'не указано').map(option => ({value: option, label: option === 'кобель' ? 'Кобель' : 'Сука'}))]}
              onChange={onSexChange} disabled={busy} />
          </div>
          <div className="dog-creation-field"><label htmlFor="dog-creation-breed">Порода</label>
            <input
              id="dog-creation-breed"
              value={breedValue}
              onChange={(event) => onBreedChange(event.target.value)}
              placeholder="Например, корги или метис"
              autoComplete="off"
              maxLength={80}
              disabled={busy}
            />

          </div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="onboarding-step-actions">
            <button type="button" onClick={onDismiss} disabled={busy}>Не сейчас</button>
            <button className="primary" type="submit" disabled={busy || !dogName.trim()}>
              {busy ? 'Создаю профиль…' : 'Добавить собаку'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
