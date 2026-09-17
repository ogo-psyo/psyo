'use client';

import { useEffect } from 'react';

/** Fit the composer to the keyboard viewport without following iOS scroll offsets. */
export function useComposerViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let restingHeight = window.innerHeight;
    let frame = 0;
    let composerEngaged = false;

    const update = () => {
      const input = document.activeElement;
      const editing = input instanceof HTMLTextAreaElement && Boolean(input.closest('#pso-exact-interface .composer'));
      const height = Math.min(window.innerHeight, viewport?.height ?? window.innerHeight);
      // Pinch zoom is not a software keyboard.
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
      if (editing) composerEngaged = true;
      const keyboardOpen = composerEngaged && restingHeight - height > 100;
      if (keyboardOpen) {
        root.dataset.psoComposerKeyboard = 'open';
        root.style.setProperty('--pso-composer-viewport', `${height}px`);
      } else {
        delete root.dataset.psoComposerKeyboard;
        root.style.removeProperty('--pso-composer-viewport');
        if (!editing) { restingHeight = window.innerHeight; composerEngaged = false; }
        else restingHeight = Math.max(restingHeight, window.innerHeight);
      }
      // Keep the layout stable through textarea blur → send-button click. The
      // keyboard's resize, not blur, restores the resting layout.
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    document.addEventListener('focusin', schedule);
    document.addEventListener('focusout', schedule);
    window.addEventListener('resize', schedule);
    viewport?.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule);
      delete root.dataset.psoComposerKeyboard;
      root.style.removeProperty('--pso-composer-viewport');
    };
  }, []);
}
