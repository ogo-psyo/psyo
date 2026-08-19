'use client';

import { Check, WarningCircle } from '@phosphor-icons/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Button, type ButtonProps } from './Button';

type StatusButtonState = 'idle' | 'loading' | 'success' | 'error';

export type StatusButtonProps = Omit<ButtonProps, 'children' | 'loading' | 'onClick'> & {
  idleLabel: ReactNode;
  loadingLabel?: ReactNode;
  successLabel?: ReactNode;
  errorLabel?: ReactNode;
  loadingAnnouncement?: string;
  successAnnouncement?: string;
  errorAnnouncement?: string;
  minimumLoadingMs?: number;
  successDurationMs?: number;
  errorDurationMs?: number;
  onAction: () => boolean | void | Promise<boolean | void>;
};

export function StatusButton({
  idleLabel,
  loadingLabel = 'Отмечаю…',
  successLabel = 'Готово',
  errorLabel = 'Попробовать ещё раз',
  loadingAnnouncement = 'Действие выполняется',
  successAnnouncement = 'Действие выполнено',
  errorAnnouncement = 'Не получилось выполнить действие',
  minimumLoadingMs = 420,
  successDurationMs = 1300,
  errorDurationMs = 2200,
  onAction,
  disabled,
  ...props
}: StatusButtonProps) {
  const [state, setState] = useState<StatusButtonState>('idle');
  const mountedRef = useRef(true);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearResetTimer();
    };
  }, [clearResetTimer]);

  const runAction = useCallback(async () => {
    if (state === 'loading') return;
    clearResetTimer();
    setState('loading');
    const startedAt = performance.now();

    try {
      const result = await onAction();
      const remaining = Math.max(0, minimumLoadingMs - (performance.now() - startedAt));
      if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
      if (!mountedRef.current) return;

      const nextState: StatusButtonState = result === false ? 'error' : 'success';
      setState(nextState);
      resetTimerRef.current = setTimeout(
        () => mountedRef.current && setState('idle'),
        nextState === 'success' ? successDurationMs : errorDurationMs,
      );
    } catch {
      if (!mountedRef.current) return;
      setState('error');
      resetTimerRef.current = setTimeout(
        () => mountedRef.current && setState('idle'),
        errorDurationMs,
      );
    }
  }, [clearResetTimer, errorDurationMs, minimumLoadingMs, onAction, state, successDurationMs]);

  const labels: Record<StatusButtonState, ReactNode> = {
    idle: idleLabel,
    loading: loadingLabel,
    success: <><Check weight="bold" aria-hidden="true" />{successLabel}</>,
    error: <><WarningCircle weight="bold" aria-hidden="true" />{errorLabel}</>,
  };

  const announcement = state === 'loading'
    ? loadingAnnouncement
    : state === 'success'
      ? successAnnouncement
      : state === 'error'
        ? errorAnnouncement
        : '';

  return (
    <>
      <Button
        {...props}
        data-state={state}
        disabled={disabled || state === 'loading'}
        loading={state === 'loading'}
        onClick={() => void runAction()}
      >
        <span className="ui-status-button-label" key={state}>{labels[state]}</span>
      </Button>
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </>
  );
}
