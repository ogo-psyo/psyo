'use client';
import { useEffect, useRef, useState } from 'react';
import type { DogProfile } from '@/lib/data';
import { profileFieldLabels, type ProfileMerge, type ProfileMergeField } from '@/lib/profileMerge';
import styles from './ProfileConflictDialog.module.css';

export function ProfileConflictDialog({ conflict, onResolve }: { conflict: ProfileMerge; onResolve: (profile: DogProfile | null) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [choices, setChoices] = useState<Partial<Record<ProfileMergeField, 'local' | 'remote'>>>({});
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    const parentDialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    element?.showModal();
    return () => {
      element?.close();
      // The initiating save button was disabled while the request was running.
      // Restore after the parent clears busy, falling back inside its dialog.
      requestAnimationFrame(() => {
        if (parentDialog?.open) {
          const target = previous && parentDialog.contains(previous) && !previous.matches(':disabled')
            ? previous : parentDialog.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button:not(:disabled)');
          target?.focus();
        } else if (previous?.isConnected && !previous.closest('dialog:not([open])')) previous.focus();
      });
    };
  }, []);
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const selected = { ...conflict.merged };
    for (const field of conflict.conflicts) {
      const choice = choices[field];
      if (!choice) return;
      Object.assign(selected, { [field]: conflict[choice][field] });
    }
    onResolve(selected);
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="profile-conflict-title" onCancel={event => { event.preventDefault(); onResolve(null); }}>
    <form onSubmit={submit}>
      <h2 id="profile-conflict-title">Профиль изменился</h2>
      <p>{conflict.conflicts.length ? 'Эти поля изменены и здесь, и на другом устройстве. Выберите, что сохранить. Остальные изменения объединены.' : 'На другом устройстве изменены другие поля. Ваш ввод сохранён, новые сведения добавлены. Сохранить объединённый профиль?'}</p>
      {conflict.conflicts.map(field => <fieldset key={field}>
        <legend>{profileFieldLabels[field]}</legend>
        {(['local', 'remote'] as const).map(side => <label key={side}>
          <input type="radio" name={field} value={side} required checked={choices[field] === side} onChange={() => setChoices(current => ({ ...current, [field]: side }))} />
          <span><strong>{side === 'local' ? 'Ваш ввод' : 'На другом устройстве'}</strong><br />{String(conflict[side][field] || 'Не заполнено')}</span>
        </label>)}
      </fieldset>)}
      <div className={styles.actions}>
        <button type="button" onClick={() => onResolve(null)}>Вернуться к форме</button>
        <button type="submit">Сохранить выбранное</button>
      </div>
    </form>
  </dialog>;
}
