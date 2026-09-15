import {nextReminderDueAt} from '@/lib/reminderRecurrence';
export {nextReminderDueAt} from '@/lib/reminderRecurrence';
export type CareRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type CareReminderState = {
  id: string;
  petId: string;
  title: string;
  dueAt: string;
  recurrence: CareRecurrence;
  status: 'active' | 'done' | 'snoozed';
  completedAt?: string | null;
  snoozedUntil?: string | null;
  nextDueAt?: string | null;
};

export type ReminderHistoryOccurrence = {
  reminderId: string;
  dueAt: string;
  completedAt: string;
};

export type ReminderCompletion = {
  reminder: CareReminderState;
  historyOccurrence: ReminderHistoryOccurrence;
  nextOccurrence: { dueAt: string } | null;
};

export type CareObservationState = {
  id: string;
  petId: string;
  type: string;
  value: string;
  deletedAt?: string | null;
};

export type CareMutationDescriptor = {
  ownerId: string;
  key: string;
  operation: string;
  fingerprint: string;
};

type CareMutationEntry = CareMutationDescriptor & { value: unknown };
export type CareMutationLedger = Map<string, CareMutationEntry>;

function parseIso(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error('INVALID_DATE');
  return date;
}

export function completeReminder(reminder: CareReminderState, completedAt: string): ReminderCompletion {
  const completed = parseIso(completedAt).toISOString();
  const dueAt = parseIso(reminder.dueAt).toISOString();
  const nextDueAt = nextReminderDueAt(dueAt, reminder.recurrence);
  const historyOccurrence = { reminderId: reminder.id, dueAt, completedAt: completed };
  if (!nextDueAt) {
    return {
      reminder: { ...reminder, status: 'done', completedAt: completed, snoozedUntil: null, nextDueAt: null },
      historyOccurrence,
      nextOccurrence: null,
    };
  }
  return {
    reminder: {
      ...reminder,
      status: 'active',
      dueAt: nextDueAt,
      completedAt: null,
      snoozedUntil: null,
      nextDueAt,
    },
    historyOccurrence,
    nextOccurrence: { dueAt: nextDueAt },
  };
}

export function snoozeReminder(reminder: CareReminderState, snoozedUntil: string): CareReminderState {
  return {
    ...reminder,
    status: 'snoozed',
    snoozedUntil: parseIso(snoozedUntil).toISOString(),
  };
}

export function softDeleteObservation(observation: CareObservationState, deletedAt: string): CareObservationState {
  return { ...observation, deletedAt: parseIso(deletedAt).toISOString() };
}

export function restoreObservation(observation: CareObservationState): CareObservationState {
  return { ...observation, deletedAt: null };
}

export function applyIdempotentCareMutation<T>(
  ledger: CareMutationLedger,
  descriptor: CareMutationDescriptor,
  mutate: () => T,
) {
  const ledgerKey = `${descriptor.ownerId}:${descriptor.key}`;
  const existing = ledger.get(ledgerKey);
  if (existing) {
    if (existing.operation !== descriptor.operation || existing.fingerprint !== descriptor.fingerprint) {
      throw new Error('IDEMPOTENCY_KEY_REUSED');
    }
    return { replayed: true as const, value: existing.value as T };
  }
  const value = mutate();
  ledger.set(ledgerKey, { ...descriptor, value });
  return { replayed: false as const, value };
}
