import { getSupabaseAdmin } from './supabase';
import { decryptTelegramChatId, encryptTelegramChatId, telegramReminderCallback } from './telegramReminderCrypto';
import { sendTelegramReminder } from './telegramBot';
import type { SupabaseClient } from '@supabase/supabase-js';
import { telegramReminderReadiness } from './telegramReminderReadiness';

type ReminderRow = {
  id:string; pet_id:string; title:string; due_at:string; snoozed_until?:string|null;
  status:string; metadata?:Record<string,unknown>|null;
};

function validTimeZone(value:unknown) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate || candidate.length > 64) return 'Europe/Moscow';
  try { new Intl.DateTimeFormat('ru-RU',{timeZone:candidate}).format(); return candidate; }
  catch { return 'Europe/Moscow'; }
}

export function reminderNotificationSchedule(reminder: ReminderRow) {
  const preference = reminder.metadata?.reminderPreference;
  if (preference !== 'day' && preference !== 'before') return null;
  if (reminder.status !== 'active' && reminder.status !== 'snoozed') return null;
  const occurrenceDueAt = reminder.snoozed_until || reminder.due_at;
  const occurrenceMs = Date.parse(occurrenceDueAt);
  if (!Number.isFinite(occurrenceMs)) return null;
  const scheduledMs = preference === 'before' ? occurrenceMs - 86_400_000 : occurrenceMs;
  return { occurrenceDueAt:new Date(occurrenceMs).toISOString(), scheduledFor:new Date(Math.max(Date.now(),scheduledMs)).toISOString() };
}

export async function bindTelegramDeliveryTarget(input:{ownerId:string;chatId:number|string;timeZone?:unknown;supabase?:SupabaseClient}) {
  const supabase = input.supabase ?? getSupabaseAdmin();
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  const saved = await supabase.from('telegram_delivery_targets').upsert({
    owner_id:input.ownerId,
    chat_id_ciphertext:encryptTelegramChatId(input.chatId),
    time_zone:validTimeZone(input.timeZone),
    enabled:true,
    verified_at:new Date().toISOString(),
  },{onConflict:'owner_id'});
  if (saved.error) throw new Error('TELEGRAM_DELIVERY_TARGET_SAVE_FAILED');
}

function appUrl(reminderId:string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/,'');
  if (!base) throw new Error('NEXT_PUBLIC_APP_URL_REQUIRED');
  const url = new URL(base);
  url.searchParams.set('careReminder',reminderId);
  return url.toString();
}

function reminderText(title:string,petName:string,occurrenceDueAt:string,timeZone:string) {
  const due = new Date(occurrenceDueAt);
  const day = new Intl.DateTimeFormat('ru-RU',{timeZone,day:'numeric',month:'long'}).format(due);
  const time = new Intl.DateTimeFormat('ru-RU',{timeZone,hour:'2-digit',minute:'2-digit'}).format(due);
  return `${title} · ${petName}\n${day}, ${time}`;
}

export async function deliverTelegramReminder(input:{reminderId:string;occurrenceDueAt:string;supabase?:SupabaseClient;fetcher?:typeof fetch}) {
  const readiness=telegramReminderReadiness();
  if (!readiness.enabled) return {state:'disabled' as const};
  if (!readiness.ready) return {state:'unavailable' as const};
  const supabase = input.supabase ?? getSupabaseAdmin();
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  const claimed = await supabase.rpc('claim_telegram_reminder_delivery',{
    p_reminder_id:input.reminderId,
    p_occurrence_due_at:input.occurrenceDueAt,
    p_now:new Date().toISOString(),
  });
  if (claimed.error) throw new Error('REMINDER_DELIVERY_CLAIM_FAILED');
  const deliveryId = typeof claimed.data === 'string' ? claimed.data : null;
  if (!deliveryId) return {state:'skipped' as const};

  try {
    const [deliveryResult,reminderResult] = await Promise.all([
      supabase.from('reminder_deliveries').select('id,owner_id,occurrence_due_at').eq('id',deliveryId).single(),
      supabase.from('reminders').select('id,pet_id,title,due_at,snoozed_until,status,metadata').eq('id',input.reminderId).single(),
    ]);
    if (deliveryResult.error || reminderResult.error) throw new Error('REMINDER_DELIVERY_READ_FAILED');
    const delivery = deliveryResult.data;
    const reminder = reminderResult.data as ReminderRow;
    const [targetResult,petResult] = await Promise.all([
      supabase.from('telegram_delivery_targets').select('chat_id_ciphertext,time_zone,enabled').eq('owner_id',delivery.owner_id).single(),
      supabase.from('pets').select('name,owner_id').eq('id',reminder.pet_id).eq('owner_id',delivery.owner_id).single(),
    ]);
    if (targetResult.error || petResult.error || !targetResult.data.enabled) throw new Error('REMINDER_DELIVERY_TARGET_UNAVAILABLE');
    const chatId = decryptTelegramChatId(targetResult.data.chat_id_ciphertext);
    const occurrenceDueAt = new Date(delivery.occurrence_due_at).toISOString();
    const done = telegramReminderCallback('done',reminder.id,occurrenceDueAt);
    const later = telegramReminderCallback('later',reminder.id,occurrenceDueAt);
    const message = await sendTelegramReminder({
      chatId,
      text:reminderText(reminder.title,petResult.data.name,occurrenceDueAt,validTimeZone(targetResult.data.time_zone)),
      keyboard:[
        [{text:'Сделано',callback_data:done},{text:'Перенести',callback_data:later}],
        [{text:'Открыть',web_app:{url:appUrl(reminder.id)}}],
      ],
      fetcher:input.fetcher,
    });
    const finished = await supabase.rpc('finish_telegram_reminder_delivery',{
      p_delivery_id:deliveryId,p_telegram_message_id:String(message.message_id),
    });
    if (finished.error || finished.data !== true) throw new Error('REMINDER_DELIVERY_FINISH_FAILED');
    return {state:'sent' as const,deliveryId,messageId:message.message_id};
  } catch (error) {
    const code = error instanceof Error ? error.message : 'REMINDER_DELIVERY_FAILED';
    try { await supabase.rpc('fail_telegram_reminder_delivery',{p_delivery_id:deliveryId,p_error_code:code}); }
    catch { /* The delivery lease expires and can be reconciled by the workflow retry. */ }
    throw error;
  }
}
