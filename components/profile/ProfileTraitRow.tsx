'use client';
import { useId, useRef, useState } from 'react';
import type { DogProfile } from '@/lib/data';
import styles from './ProfileTraitRow.module.css';
type Field = 'temperament' | 'socialMode' | 'energyLevel' | 'trainability';
export function ProfileTraitRow({ label, field, options, profile, onSave }: {
  label: string; field: Field; options: readonly string[]; profile: DogProfile;
  onSave: (profile: DogProfile) => Promise<string | null>;
}) {
  const selectId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const base = useRef(profile);
  const trigger = useRef<HTMLButtonElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const value = draft ?? profile[field];
  const choices = value && !options.includes(value) ? [value, ...options] : options;
  function expand() {
    if (draft === null) { base.current = profile; setDraft(profile[field]); }
    setOpen(true);
    requestAnimationFrame(() => select.current?.focus());
  }
  function collapse() { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }
  return <div className={styles.row} data-profile-trait={field}>
    <button ref={trigger} type="button" className={styles.trigger} aria-expanded={open} onClick={() => open ? collapse() : expand()}>
      <span>{label}</span><strong>{profile[field]?.trim() || 'Пока не заполнено'}</strong>
    </button>
    <form hidden={!open} onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      select.current?.focus(); setBusy(true); setError('');
      try {
        const saved = await onSave({ ...base.current, [field]: value });
        if (saved) { setDraft(null); collapse(); }
        else setError('Изменение не сохранено. Ваш выбор остался здесь.');
      } catch {
        setError('Изменение не сохранено. Ваш выбор остался здесь.');
      } finally { setBusy(false); }
    }}>
      <label htmlFor={selectId}>{label}</label><select id={selectId} ref={select} disabled={busy} value={value} onChange={event => setDraft(event.target.value)}>
        <option value="">Не указано</option>
        {choices.map(option => <option key={option}>{option}</option>)}
      </select>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={collapse}>Свернуть</button>
        <button type="submit" disabled={busy}>{busy ? 'Сохраняю…' : 'Сохранить'}</button>
      </div>
    </form>
  </div>;
}
