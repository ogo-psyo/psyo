import type { ReactNode } from 'react';
import { cx } from './cx';

export function PageHeader({
  title,
  description,
  aside,
  className,
  headingLevel = 2,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <header className={cx('ui-page-header', className)}>
      <div>
        <Heading>{title}</Heading>
        {description && <p>{description}</p>}
      </div>
      {aside && <div className="ui-page-header-aside">{aside}</div>}
    </header>
  );
}
