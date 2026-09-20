'use client';

import { useEffect } from 'react';

/** Fit the composer to the keyboard viewport without following iOS scroll offsets. */
export function useComposerViewport() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let restingHeight = window.innerHeight;
    let frame = 0;
    let revealFrame = 0;
    let composerEngaged = false;
    let formEngaged = false;

    const revealFormInput = (input: HTMLElement, height: number) => {
      // iOS may focus before the keyboard finishes resizing. Wait for the
      // resized shell, then move only its inner scroller — never the window.
      revealFrame = requestAnimationFrame(() => {
        if (document.activeElement !== input || root.dataset.psoFormKeyboard !== 'open') return;
        const scroller = input.closest<HTMLElement>('#pso-exact-content');
        if (!scroller) return;
        const area = scroller.getBoundingClientRect();
        const field = input.getBoundingClientRect();
        const top = area.top + 12;
        const bottom = Math.min(area.bottom, height) - 12;
        if (bottom <= top) return;
        const delta = field.height > bottom - top || field.top < top
          ? field.top - top
          : field.bottom > bottom ? field.bottom - bottom : 0;
        if (Math.abs(delta) > 1) scroller.scrollTop += delta;
      });
    };

    const update = () => {
      cancelAnimationFrame(revealFrame);
      const input = document.activeElement;
      const textControl = input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement && ['text', 'search', 'email', 'tel', 'url', 'password', 'number'].includes(input.type);
      const editing = textControl && Boolean(input.closest('#pso-exact-interface .composer'));
      const formEditing = textControl && Boolean(input.closest('#pso-exact-interface')) && !editing;
      const height = Math.min(window.innerHeight, viewport?.height ?? window.innerHeight);
      // Pinch zoom is not a software keyboard.
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
      if (editing) { composerEngaged = true; formEngaged = false; }
      if (formEditing) { formEngaged = true; composerEngaged = false; }
      const formKeyboardOpen = formEngaged && restingHeight - height > 100;
      if (formKeyboardOpen) {
        root.dataset.psoFormKeyboard = 'open';
        root.style.setProperty('--pso-form-viewport', `${height}px`);
        if (formEditing && input instanceof HTMLElement) revealFormInput(input, height);
      } else {
        delete root.dataset.psoFormKeyboard;
        root.style.removeProperty('--pso-form-viewport');
      }
      const keyboardOpen = composerEngaged && restingHeight - height > 100;
      if (keyboardOpen) {
        root.dataset.psoComposerKeyboard = 'open';
        root.style.setProperty('--pso-composer-viewport', `${height}px`);
      } else {
        delete root.dataset.psoComposerKeyboard;
        root.style.removeProperty('--pso-composer-viewport');
        if (!editing && !formEditing && !formKeyboardOpen) { restingHeight = window.innerHeight; composerEngaged = false; formEngaged = false; }
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
      cancelAnimationFrame(revealFrame);
      document.removeEventListener('focusin', schedule);
      document.removeEventListener('focusout', schedule);
      window.removeEventListener('resize', schedule);
      viewport?.removeEventListener('resize', schedule);
      delete root.dataset.psoComposerKeyboard;
      root.style.removeProperty('--pso-composer-viewport');
      delete root.dataset.psoFormKeyboard;
      root.style.removeProperty('--pso-form-viewport');
    };
  }, []);
}
