'use client';

import { forwardRef, useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

export type LongPressButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  holdDuration?: number;
  onHoldComplete: () => void;
};

export const LongPressButton = forwardRef<HTMLButtonElement, LongPressButtonProps>(function LongPressButton(
  { holdDuration = 1200, onHoldComplete, className, children, disabled, ...props },
  ref,
) {
  const frame = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const completed = useRef(false);
  const [progress, setProgress] = useState(0);

  const reset = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    startedAt.current = null;
    completed.current = false;
    setProgress(0);
  }, []);

  const begin = useCallback(() => {
    if (disabled || frame.current !== null) return;
    completed.current = false;
    const duration = Math.max(holdDuration, 1);
    frame.current = requestAnimationFrame(function tick(time) {
      if (startedAt.current === null) startedAt.current = time;
      const next = Math.min(1, (time - startedAt.current) / duration);
      setProgress(next);
      if (next >= 1) {
        frame.current = null;
        completed.current = true;
        onHoldComplete();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    });
  }, [disabled, holdDuration, onHoldComplete]);

  const cancel = useCallback(() => {
    if (!completed.current) reset();
  }, [reset]);

  useEffect(() => reset, [reset]);
  useEffect(() => {
    if (disabled) reset();
  }, [disabled, reset]);

  return (
    <button
      ref={ref}
      type="button"
      className={cx('ui-long-press', className)}
      data-state={progress > 0 ? 'holding' : 'idle'}
      disabled={disabled}
      onPointerDown={(event) => {
        if (event.button === 0) begin();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onBlur={cancel}
      onKeyDown={(event) => {
        if (!event.repeat && (event.key === ' ' || event.key === 'Enter')) {
          event.preventDefault();
          begin();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          cancel();
        }
      }}
      {...props}
    >
      <span className="ui-long-press-progress" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
      <span className="ui-long-press-content">{children}</span>
    </button>
  );
});
