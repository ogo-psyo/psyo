'use client';

import { CheckCircle, ClockCountdown, WarningCircle } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusButton } from '@/components/ui/StatusButton';
import { Surface } from '@/components/ui/Surface';
import type { TodayCareView } from '@/lib/today';

export function NextCareCard({
  care,
  onPrimaryAction,
  onOpenPlan,
}: {
  care: TodayCareView;
  onPrimaryAction: () => boolean | void | Promise<boolean | void>;
  onOpenPlan: () => void;
}) {
  const StatusIcon = care.state === 'overdue'
    ? WarningCircle
    : care.state === 'complete'
      ? CheckCircle
      : ClockCountdown;

  return (
    <Surface
      as="section"
      variant="fancy"
      className={`next-care-card state-${care.state}`}
      data-testid="today-first-viewport"
    >
      <Badge className="next-care-heading" tone={care.state === 'overdue' ? 'danger' : care.state === 'complete' ? 'emerald' : 'care'} dot>
        <span className="next-care-status-icon" aria-hidden="true"><StatusIcon weight="duotone" /></span>
        <span>{care.state === 'overdue' ? 'срок прошёл' : care.state === 'complete' ? 'всё сделано' : 'ближайшее дело'}</span>
      </Badge>
      <h3>{care.title}</h3>
      <p>{care.detail}</p>
      <div className="next-care-actions">
        <StatusButton
          className="primary"
          variant={care.state === 'overdue' ? 'danger' : 'primary'}
          size="lg"
          idleLabel={care.actionLabel}
          loadingLabel="Отмечаю…"
          successLabel="Отмечено"
          errorLabel="Повторить"
          successAnnouncement={`${care.title}: отмечено как выполненное`}
          errorAnnouncement={`${care.title}: не получилось отметить выполненным`}
          onAction={onPrimaryAction}
        />
        {care.reminderId && (
          <Button className="text-action" variant="ghost" size="sm" onClick={onOpenPlan}>
            Открыть план
          </Button>
        )}
      </div>
    </Surface>
  );
}
