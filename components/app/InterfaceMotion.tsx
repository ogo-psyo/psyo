'use client';

import { useEffect } from 'react';

/** Motion is presentation only: never delay an action, focus, or unmount. */
export function InterfaceMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => { root.dataset.psoInput = 'pointer'; };
    const keyboard = () => { root.dataset.psoInput = 'keyboard'; };
    window.addEventListener('pointerdown', pointer, { capture: true, passive: true });
    window.addEventListener('keydown', keyboard, true);
    return () => {
      window.removeEventListener('pointerdown', pointer, true);
      window.removeEventListener('keydown', keyboard, true);
      delete root.dataset.psoInput;
    };
  }, []);
  return null;
}
