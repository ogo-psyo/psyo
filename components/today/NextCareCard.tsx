'use client';

import type { TodayCareView } from '@/lib/today';

export function NextCareCard({
  care,
  dogName,
  onPrimaryAction,
  onOpenPlan,
}: {
  care: TodayCareView;
  dogName: string;
  onPrimaryAction: () => void;
  onOpenPlan: () => void;
}) {
  return (
    <section
      className={`next-care-card state-${care.state}`}
      data-testid="today-first-viewport"
    >
      <div className="next-care-heading">
        <h2>{`Сегодня с ${dogName || 'питомцем'}`}</h2>
        <span>{care.state === 'overdue' ? 'срок прошёл' : care.state === 'complete' ? 'всё сделано' : 'ближайшее дело'}</span>
      </div>
      <h3>{care.title}</h3>
      <p>{care.detail}</p>
      <div className="next-care-actions">
        <button className="primary" type="button" onClick={onPrimaryAction}>
          {care.actionLabel}
        </button>
        {care.reminderId && (
          <button className="text-action" type="button" onClick={onOpenPlan}>
            Открыть план
          </button>
        )}
      </div>
    </section>
  );
}
