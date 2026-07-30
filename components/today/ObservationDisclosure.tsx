'use client';

import type { ReactNode } from 'react';

export function ObservationDisclosure({
  countLabel,
  hint,
  children,
  history,
}: {
  countLabel: string;
  hint: string;
  children: ReactNode;
  history?: ReactNode;
}) {
  return (
    <details className="observation-disclosure">
      <summary>
        <span>
          <b>Записать наблюдение</b>
          <small>{hint}</small>
        </span>
        <span>{countLabel}</span>
      </summary>
      <div className="observation-disclosure-body">
        {children}
        {history && (
          <details className="observation-history-disclosure">
            <summary>Последние записи</summary>
            <div>{history}</div>
          </details>
        )}
      </div>
    </details>
  );
}
