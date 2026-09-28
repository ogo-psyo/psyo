import { sleep } from 'workflow';

export async function telegramReminderWorkflow(reminderId:string,occurrenceDueAt:string,scheduledFor:string) {
  'use workflow';
  await sleep(new Date(scheduledFor));
  await deliver(reminderId,occurrenceDueAt);
}

async function deliver(reminderId:string,occurrenceDueAt:string) {
  'use step';
  const { deliverTelegramReminder } = await import('@/lib/server/reminderService');
  await deliverTelegramReminder({reminderId,occurrenceDueAt});
}
