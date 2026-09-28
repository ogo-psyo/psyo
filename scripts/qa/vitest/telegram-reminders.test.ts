import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { decryptTelegramChatId, encryptTelegramChatId, parseTelegramReminderCallback, telegramReminderCallback } from '@/lib/server/telegramReminderCrypto';
import { reminderNotificationSchedule } from '@/lib/server/reminderService';
import { sendTelegramReminder } from '@/lib/server/telegramBot';

describe('Telegram reminder delivery contract',()=>{
  beforeEach(()=>{
    vi.stubEnv('TELEGRAM_DELIVERY_ENCRYPTION_KEY','test-delivery-key-that-is-longer-than-thirty-two-characters');
    vi.stubEnv('TELEGRAM_BOT_TOKEN','test-bot-token');
  });
  afterEach(()=>vi.unstubAllEnvs());

  test('chat id is encrypted at rest and can be recovered only by the server key',()=>{
    const encrypted=encryptTelegramChatId(123456789);
    expect(encrypted).not.toContain('123456789');
    expect(decryptTelegramChatId(encrypted)).toBe('123456789');
  });

  test('compact callback fits Telegram limit and rejects tampering',()=>{
    const callback=telegramReminderCallback('done','123e4567-e89b-12d3-a456-426614174000','2026-09-29T15:00:00.000Z');
    expect(Buffer.byteLength(callback)).toBeLessThanOrEqual(64);
    expect(parseTelegramReminderCallback(callback)).toMatchObject({action:'done',reminderId:'123e4567-e89b-12d3-a456-426614174000'});
    expect(parseTelegramReminderCallback(`${callback.slice(0,-1)}x`)).toBeNull();
  });

  test('day, eve and snoozed occurrences resolve to one exact schedule',()=>{
    const base={id:'r',pet_id:'p',title:'Груминг',due_at:'2026-09-30T15:00:00.000Z',status:'active'};
    expect(reminderNotificationSchedule({...base,metadata:{reminderPreference:'day'}})?.occurrenceDueAt).toBe(base.due_at);
    expect(reminderNotificationSchedule({...base,metadata:{reminderPreference:'before'}})?.scheduledFor).toBe('2026-09-29T15:00:00.000Z');
    expect(reminderNotificationSchedule({...base,status:'snoozed',snoozed_until:'2026-10-02T15:00:00.000Z',metadata:{reminderPreference:'day'}})?.occurrenceDueAt).toBe('2026-10-02T15:00:00.000Z');
    expect(reminderNotificationSchedule({...base,metadata:{reminderPreference:'off'}})).toBeNull();
  });

  test('Telegram send contains the three promised actions without leaking credentials',async()=>{
    const fetcher=vi.fn(async (_url:string|URL|Request,_init?:RequestInit)=>Response.json({ok:true,result:{message_id:42}}));
    const result=await sendTelegramReminder({chatId:'123',text:'Груминг',keyboard:[[{text:'Сделано',callback_data:'done'},{text:'Перенести',callback_data:'later'}],[{text:'Открыть',web_app:{url:'https://example.test'}}]],fetcher:fetcher as typeof fetch});
    expect(result.message_id).toBe(42);
    const request=JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    expect(request.reply_markup.inline_keyboard.flat().map((button:{text:string})=>button.text)).toEqual(['Сделано','Перенести','Открыть']);
    expect(JSON.stringify(request)).not.toContain('test-bot-token');
  });

  test('one occurrence is sent once when the delivery claim is replayed',async()=>{
    vi.stubEnv('TELEGRAM_NOTIFICATIONS_ENABLED','true');
    vi.stubEnv('NEXT_PUBLIC_APP_URL','https://pso.example');
    vi.resetModules();
    const {deliverTelegramReminder}=await import('@/lib/server/reminderService');
    const ciphertext=encryptTelegramChatId(123);
    let claims=0;
    const rows:Record<string,Record<string,unknown>>={
      reminder_deliveries:{id:'delivery-1',owner_id:'owner-1',occurrence_due_at:'2026-09-29T15:00:00.000Z'},
      reminders:{id:'123e4567-e89b-12d3-a456-426614174000',pet_id:'pet-1',title:'Груминг',due_at:'2026-09-29T15:00:00.000Z',snoozed_until:null,status:'active',metadata:{reminderPreference:'day'}},
      telegram_delivery_targets:{chat_id_ciphertext:ciphertext,time_zone:'Europe/Moscow',enabled:true},
      pets:{name:'Плутон',owner_id:'owner-1'},
    };
    const supabase={
      rpc:vi.fn(async(name:string)=>name==='claim_telegram_reminder_delivery'
        ? {data:claims++===0?'delivery-1':null,error:null}
        : {data:true,error:null}),
      from(table:string){
        const chain={select(){return chain;},eq(){return chain;},single:async()=>({data:rows[table],error:null})};
        return chain;
      },
    };
    const fetcher=vi.fn(async()=>Response.json({ok:true,result:{message_id:77}}));
    const input={reminderId:'123e4567-e89b-12d3-a456-426614174000',occurrenceDueAt:'2026-09-29T15:00:00.000Z',supabase:supabase as never,fetcher:fetcher as typeof fetch};
    await expect(deliverTelegramReminder(input)).resolves.toMatchObject({state:'sent',messageId:77});
    await expect(deliverTelegramReminder(input)).resolves.toEqual({state:'skipped'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test.each([
    {action:'done' as const,expectedRpc:'care_complete_reminder_atomic',expectedState:'completed'},
    {action:'day' as const,expectedRpc:'care_snooze_reminder_atomic',expectedState:'snoozed'},
  ])('a current $action button routes through the atomic reminder mutation',async({action,expectedRpc,expectedState})=>{
    vi.stubEnv('TELEGRAM_NOTIFICATIONS_ENABLED','true');
    vi.stubEnv('NEXT_PUBLIC_APP_URL','https://pso.example');
    vi.resetModules();
    const {handleTelegramReminderCallback}=await import('@/lib/server/telegramReminderActions');
    const occurrenceDueAt='2026-09-29T15:00:00.000Z';
    const reminderId='123e4567-e89b-12d3-a456-426614174000';
    const ciphertext=encryptTelegramChatId(123);
    const tableRows:Record<string,Record<string,unknown>>={
      reminder_deliveries:{id:'delivery-1',owner_id:'owner-1',occurrence_due_at:occurrenceDueAt,status:'sent'},
      telegram_delivery_targets:{chat_id_ciphertext:ciphertext,enabled:true},
      reminders:{id:reminderId,pet_id:'pet-1',title:'Груминг',due_at:occurrenceDueAt,snoozed_until:null,status:'active',metadata:{reminderPreference:'day'}},
      pets:{owner_id:'owner-1'},
    };
    const rpc=vi.fn(async(name:string)=>name===expectedRpc
      ? {data:{reminder:{id:reminderId,status:action==='done'?'done':'snoozed'}},error:null}
      : {data:null,error:new Error('unexpected rpc')});
    const supabase={
      rpc,
      from(table:string){
        const chain={
          select(){return chain;},eq(){return chain;},gte(){return chain;},lte(){return chain;},
          single:async()=>({data:tableRows[table],error:null}),
          maybeSingle:async()=>table==='reminder_deliveries'
            ? {data:tableRows[table],error:null}
            : {data:null,error:new Error('delivery scheduling intentionally unavailable in this test')},
        };
        return chain;
      },
    };
    const fetcher=vi.fn(async()=>Response.json({ok:true,result:true}));
    const result=await handleTelegramReminderCallback({
      data:telegramReminderCallback(action,reminderId,occurrenceDueAt),
      callbackQueryId:'callback-1',chatId:123,messageId:77,messageText:'Груминг · Плутон',
      supabase:supabase as never,fetcher:fetcher as typeof fetch,
    });
    expect(result.state).toBe(expectedState);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(expectedRpc,expect.objectContaining({
      p_reminder_id:reminderId,
      p_idempotency_key:`telegram:${action}:delivery-1`,
    }));
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('migration and workflow preserve privacy, idempotency and current-occurrence validation',()=>{
    const migration=readFileSync('supabase/migrations/20260928180000_telegram_reminder_delivery.sql','utf8');
    const workflow=readFileSync('workflows/reminder.ts','utf8');
    expect(migration).toMatch(/chat_id_ciphertext text not null/);
    expect(migration).toMatch(/unique \(reminder_id, occurrence_due_at\)/);
    expect(migration).toMatch(/abs\(extract\(epoch from \(v_effective_due - p_occurrence_due_at\)\)\) > 1/);
    expect(migration).toMatch(/v_delivery\.status in \('sent','cancelled'\)/);
    expect(workflow).toMatch(/await sleep\(new Date\(scheduledFor\)\)/);
  });
});
