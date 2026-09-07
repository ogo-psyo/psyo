'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Native top layer keeps map controls below the form and makes the whole app inert. */
export function GavDialog({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const dialog = ref.current;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); if (origin?.isConnected) origin.focus({ preventScroll: true }); };
  }, []);
  return createPortal(<dialog ref={ref} className="gav-dialog" aria-label={label} onCancel={event => { event.preventDefault(); closeRef.current(); }}>{children}</dialog>, document.body);
}
