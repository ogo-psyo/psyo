import { start } from 'workflow/api';
import { telegramReminderWorkflow } from '@/workflows/reminder';
import { reminderNotificationSchedule } from './reminderService';
import { getSupabaseAdmin } from './supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { telegramReminderReadiness } from './telegramReminderReadiness';

type ScheduleContext={ownerId?:string;supabase?:SupabaseClient};

function normalizedReminder(value:unknown) {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string,unknown>;
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string,unknown> : {
    reminderPreference:row.reminderPreference,
  };
  const id = row.id;
  const dueAt = row.due_at ?? row.dueAt;
  if (typeof id !== 'string' || typeof dueAt !== 'string') return null;
  return {
    id, pet_id:String(row.pet_id ?? row.petId ?? ''), title:String(row.title ?? ''),
    due_at:dueAt, snoozed_until:typeof (row.snoozed_until ?? row.snoozedUntil) === 'string' ? String(row.snoozed_until ?? row.snoozedUntil) : null,
    status:String(row.status ?? ''), metadata,
  };
}

export async function scheduleTelegramReminder(value:unknown,context:ScheduleContext={}) {
  const readiness=telegramReminderReadiness();
  if (!readiness.enabled) return {state:'disabled' as const};
  if (!readiness.ready) return {state:'unavailable' as const};
  const reminder = normalizedReminder(value);
  const schedule = reminder ? reminderNotificationSchedule(reminder) : null;
  if (!reminder || !schedule) return {state:'not-requested' as const};
  if(context.ownerId){
    const supabase=context.supabase??getSupabaseAdmin();
    if(!supabase)return {state:'unavailable' as const};
    const target=await supabase.from('telegram_delivery_targets').select('owner_id').eq('owner_id',context.ownerId).eq('enabled',true).maybeSingle();
    if(target.error||!target.data)return {state:'unavailable' as const};
  }
  const run = await start(telegramReminderWorkflow,[reminder.id,schedule.occurrenceDueAt,schedule.scheduledFor]);
  return {state:'scheduled' as const,runId:run.runId,scheduledFor:schedule.scheduledFor};
}

export async function scheduleReminderMutationResult(value:unknown,context:ScheduleContext={}) {
  const object = value && typeof value === 'object' ? value as Record<string,unknown> : {};
  return scheduleTelegramReminder(object.reminder ?? value,context);
}

export async function safeScheduleReminderMutationResult(value:unknown,context:ScheduleContext={}) {
  try { return await scheduleReminderMutationResult(value,context); }
  catch { return {state:'unavailable' as const}; }
}
