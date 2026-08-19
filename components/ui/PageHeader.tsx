import type { ReactNode } from 'react';
import { cx } from './cx';

export function PageHeader({
  title,
  description,
  aside,
  className,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx('ui-page-header', className)}>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {aside && <div className="ui-page-header-aside">{aside}</div>}
    </header>
  );
}
