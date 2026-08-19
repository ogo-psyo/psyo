import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type SurfaceVariant = 'raised' | 'flat' | 'outline' | 'fancy';
type SurfaceElement = 'article' | 'section' | 'div';

export function Surface({
  as: Element = 'article',
  variant = 'raised',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: SurfaceElement;
  variant?: SurfaceVariant;
  children: ReactNode;
}) {
  return (
    <Element className={cx('ui-surface', `ui-surface-${variant}`, className)} {...props}>
      {children}
    </Element>
  );
}
