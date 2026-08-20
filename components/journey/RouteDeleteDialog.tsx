'use client';

import { useEffect, useRef } from 'react';
import { Trash } from '@phosphor-icons/react';
import type { OwnerRouteView } from '@/lib/mapUi';

export function RouteDeleteDialog({
  route,
  busy,
  onCancel,
  onConfirm,
}: {
  route: OwnerRouteView | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (route: OwnerRouteView) => void | Promise<void>;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!route) return;
    cancelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onCancel();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel, route]);

  if (!route) return null;

  return <div
    className="care-dialog-backdrop route-delete-backdrop"
    role="presentation"
    onMouseDown={(event) => {
      if (event.currentTarget === event.target && !busy) onCancel();
    }}
  >
    <section className="care-delete-dialog route-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="route-delete-title" aria-describedby="route-delete-description">
      <span className="route-delete-icon" aria-hidden="true"><Trash weight="regular" /></span>
      <div className="route-delete-copy">
        <h2 id="route-delete-title">Убрать «{route.title}»?</h2>
        <p id="route-delete-description">Маршрут исчезнет с карты. Если вы делились ссылкой, она перестанет работать.</p>
      </div>
      <div className="route-delete-actions">
        <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy}>Оставить</button>
        <button type="button" className="danger-action" onClick={() => void onConfirm(route)} disabled={busy}>{busy ? 'Убираю…' : 'Убрать маршрут'}</button>
      </div>
    </section>
  </div>;
}
