import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type BadgeTone = 'mint' | 'care' | 'emerald' | 'danger' | 'neutral';

export function Badge({
  className,
  tone = 'neutral',
  dot = false,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx('ui-badge', `ui-badge-${tone}`, className)} {...props}>
      {dot && <span className="ui-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
