'use client';

import { useEffect, useRef, useState } from 'react';

export type ProfileDeletionTarget =
  | { kind: 'dog'; petId: string; name: string }
  | { kind: 'account' }
  | { kind: 'local' };

export function ProfileDeletionDialog({ target, busy, error, onCancel, onConfirm }: {
  target: ProfileDeletionTarget;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (confirmation: string) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const sending = useRef(false);
  const [confirmation, setConfirmation] = useState('');
  const required = target.kind === 'account' ? 'УДАЛИТЬ АККАУНТ' : target.kind === 'local' ? 'ОЧИСТИТЬ ДАННЫЕ' : '';
  const title = target.kind === 'dog' ? `Удалить профиль «${target.name}»?` : target.kind === 'account' ? 'Удалить аккаунт?' : 'Очистить данные на этом устройстве?';
  const action = target.kind === 'dog' ? 'Удалить профиль' : target.kind === 'account' ? 'Удалить аккаунт' : 'Очистить данные';

  useEffect(() => {
    const dialog = dialogRef.current;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    cancelRef.current?.focus({ preventScroll: true });
    return () => { dialog?.close(); if (origin?.isConnected) origin.focus({ preventScroll: true }); };
  }, []);

  async function confirm() {
    if (busy || sending.current || (required && confirmation.trim() !== required)) return;
    sending.current = true;
    try { await onConfirm(confirmation); } finally { sending.current = false; }
  }

  return <dialog ref={dialogRef} className="exact-extension profile-deletion-dialog"
    tabIndex={-1} aria-labelledby="profile-deletion-title" aria-describedby="profile-deletion-description" aria-busy={busy}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); event.currentTarget.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onCancel={event => { event.preventDefault(); if (!busy && !sending.current) onCancel(); }}>
    <h2 id="profile-deletion-title">{title}</h2>
    <p id="profile-deletion-description">{target.kind === 'dog'
      ? 'Исчезнут сведения об этой собаке, её дела, записи, документы, вещи и места. Профили других собак останутся. Восстановить удалённое не получится.'
      : target.kind === 'account'
        ? 'Исчезнут аккаунт и данные всех твоих собак. Восстановить их не получится.'
        : 'Профили, дела, записи и черновики исчезнут из этого браузера. Данные аккаунта в Telegram и других сайтов не затронем.'}</p>
    {required && <label>Для подтверждения введи «{required}»
      <input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" disabled={busy} />
    </label>}
    {error && <p role="alert" className="profile-deletion-error">{error}</p>}
    <div className="profile-deletion-actions">
      <button ref={cancelRef} type="button" className="secondary" disabled={busy} onClick={onCancel}>Отмена</button>
      <button type="button" className="danger-action" disabled={busy || Boolean(required && confirmation.trim() !== required)} onClick={() => void confirm()}>{busy ? 'Удаляю…' : action}</button>
    </div>
  </dialog>;
}
