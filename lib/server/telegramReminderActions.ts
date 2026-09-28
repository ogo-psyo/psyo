import { careRequestFingerprint } from './careHttp';
import { getSupabaseAdmin } from './supabase';
import { decryptTelegramChatId, parseTelegramReminderCallback, telegramReminderCallback } from './telegramReminderCrypto';
import { answerTelegramCallback, editTelegramReminder } from './telegramBot';
import { safeScheduleReminderMutationResult } from './reminderScheduler';
import type { SupabaseClient } from '@supabase/supabase-js';
import { telegramReminderReadiness } from './telegramReminderReadiness';

function openKeyboard(reminderId:string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/,'');
  const url = new URL(base);
  url.searchParams.set('careReminder',reminderId);
  return [[{text:'Открыть в Псё',web_app:{url:url.toString()}}]];
}

export async function handleTelegramReminderCallback(input:{
  data:string; callbackQueryId:string; chatId:number|string; messageId:number; messageText?:string; supabase?:SupabaseClient; fetcher?:typeof fetch;
}) {
  const readiness=telegramReminderReadiness();
  if (!readiness.enabled) {
    await answerTelegramCallback(input.callbackQueryId,'Напоминания временно выключены.',input.fetcher);
    return {state:'disabled' as const};
  }
  if (!readiness.ready) {
    if(process.env.TELEGRAM_BOT_TOKEN)await answerTelegramCallback(input.callbackQueryId,'Напоминания временно недоступны.',input.fetcher);
    return {state:'unavailable' as const};
  }
  const parsed = parseTelegramReminderCallback(input.data);
  if (!parsed) {
    await answerTelegramCallback(input.callbackQueryId,'Кнопка больше не действует.',input.fetcher);
    return {state:'invalid' as const};
  }
  const supabase = input.supabase ?? getSupabaseAdmin();
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  const occurrenceStart = new Date(Date.parse(parsed.occurrenceDueAt)-1000).toISOString();
  const occurrenceEnd = new Date(Date.parse(parsed.occurrenceDueAt)+1000).toISOString();
  const deliveryResult = await supabase.from('reminder_deliveries')
    .select('id,owner_id,occurrence_due_at,status')
    .eq('reminder_id',parsed.reminderId).gte('occurrence_due_at',occurrenceStart).lte('occurrence_due_at',occurrenceEnd)
    .eq('status','sent').maybeSingle();
  if (deliveryResult.error || !deliveryResult.data) {
    await answerTelegramCallback(input.callbackQueryId,'Напоминание уже неактуально.',input.fetcher);
    return {state:'stale' as const};
  }
  const delivery = deliveryResult.data;
  const [targetResult,reminderResult] = await Promise.all([
    supabase.from('telegram_delivery_targets').select('chat_id_ciphertext,enabled').eq('owner_id',delivery.owner_id).single(),
    supabase.from('reminders').select('id,pet_id,title,due_at,snoozed_until,status,metadata').eq('id',parsed.reminderId).single(),
  ]);
  if (targetResult.error || reminderResult.error || !targetResult.data.enabled
      || decryptTelegramChatId(targetResult.data.chat_id_ciphertext) !== String(input.chatId)) {
    await answerTelegramCallback(input.callbackQueryId,'Не удалось подтвердить действие.',input.fetcher);
    return {state:'denied' as const};
  }
  const reminder = reminderResult.data;
  const petResult = await supabase.from('pets').select('owner_id').eq('id',reminder.pet_id).eq('owner_id',delivery.owner_id).single();
  const currentOccurrence = new Date(reminder.snoozed_until || reminder.due_at).toISOString();
  if (petResult.error || !['active','snoozed'].includes(reminder.status)
      || Math.abs(Date.parse(currentOccurrence)-Date.parse(parsed.occurrenceDueAt))>1000) {
    await answerTelegramCallback(input.callbackQueryId,'Дело уже изменилось в Псё.',input.fetcher);
    return {state:'stale' as const};
  }

  if (parsed.action === 'later') {
    await editTelegramReminder({
      chatId:String(input.chatId),messageId:input.messageId,fetcher:input.fetcher,
      keyboard:[
        [{text:'На день',callback_data:telegramReminderCallback('day',parsed.reminderId,parsed.occurrenceDueAt)},
         {text:'На неделю',callback_data:telegramReminderCallback('week',parsed.reminderId,parsed.occurrenceDueAt)}],
        ...openKeyboard(parsed.reminderId),
      ],
    });
    await answerTelegramCallback(input.callbackQueryId,'Выбери новый срок.',input.fetcher);
    return {state:'choose-date' as const};
  }

  const idempotencyKey = `telegram:${parsed.action}:${delivery.id}`;
  let result:unknown;
  let notificationWarning='';
  if (parsed.action === 'done') {
    const fingerprint = careRequestFingerprint({id:parsed.reminderId,completedAt:null});
    const mutation = await supabase.rpc('care_complete_reminder_atomic',{
      p_owner_id:delivery.owner_id,p_idempotency_key:idempotencyKey,p_request_fingerprint:fingerprint,
      p_reminder_id:parsed.reminderId,p_completed_at:null,
    });
    if (mutation.error) throw new Error('TELEGRAM_REMINDER_COMPLETE_FAILED');
    result = mutation.data;
    const notification=await safeScheduleReminderMutationResult(result,{ownerId:delivery.owner_id,supabase});
    const nextReminder=result&&typeof result==='object'&&'reminder' in result?(result as {reminder?:{status?:unknown}}).reminder:null;
    if(nextReminder?.status==='active'&&notification.state!=='scheduled')notificationWarning='\nСледующее сообщение пока не запланировалось — открой дело в Псё.';
  } else {
    const days = parsed.action === 'week' ? 7 : 1;
    const snoozedUntil = new Date(Date.parse(parsed.occurrenceDueAt)+days*86_400_000).toISOString();
    const fingerprint = careRequestFingerprint({id:parsed.reminderId,snoozedUntil});
    const mutation = await supabase.rpc('care_snooze_reminder_atomic',{
      p_owner_id:delivery.owner_id,p_idempotency_key:idempotencyKey,p_request_fingerprint:fingerprint,
      p_reminder_id:parsed.reminderId,p_snoozed_until:snoozedUntil,
    });
    if (mutation.error) throw new Error('TELEGRAM_REMINDER_SNOOZE_FAILED');
    result = mutation.data;
    const notification=await safeScheduleReminderMutationResult(result,{ownerId:delivery.owner_id,supabase});
    if(notification.state!=='scheduled')notificationWarning='\nНовое сообщение пока не запланировалось — открой дело в Псё.';
  }
  const label = parsed.action === 'done' ? 'Сделано ✓' : `Перенесено ${parsed.action === 'week' ? 'на неделю' : 'на день'} ✓`;
  await editTelegramReminder({
    chatId:String(input.chatId),messageId:input.messageId,fetcher:input.fetcher,
    text:`${label}\n${input.messageText || reminder.title}${notificationWarning}`,
    keyboard:openKeyboard(parsed.reminderId),
  });
  await answerTelegramCallback(input.callbackQueryId,label,input.fetcher);
  return {state:parsed.action === 'done' ? 'completed' as const : 'snoozed' as const,result};
}
