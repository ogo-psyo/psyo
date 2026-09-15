export type ReminderTimeMode='exact'|'flexible'|'approximate';
export type ReminderRecurrence='none'|'daily'|'weekly'|'monthly'|'quarterly'|'yearly';
export type ReminderRecord={id:string;petId:string;type:string;title:string;dueAt:string;recurrence?:ReminderRecurrence;status:string;timeMode?:ReminderTimeMode;snoozedUntil?:string;completedAt?:string;nextDueAt?:string};
export function reminderMode(value:unknown):ReminderTimeMode|undefined{return value==='exact'||value==='flexible'||value==='approximate'?value:undefined;}
export function reminderTiming(item:Pick<ReminderRecord,'dueAt'|'snoozedUntil'|'timeMode'>){
 const date=new Date(item.snoozedUntil||item.dueAt);
 if(!Number.isFinite(date.getTime()))return 'Дата не указана';
 const time=date.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
 const precision=item.timeMode==='flexible'?'в течение дня':item.timeMode==='approximate'?`около ${time}`:item.timeMode==='exact'?`в ${time}`:'время не уточнено';
 return `${date.toLocaleDateString('ru-RU',{day:'numeric',month:'long',weekday:'short'})}, ${precision}`;
}
export function reminderReceipt(value:unknown,petId:string,expectedId?:string):ReminderRecord|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const row=value as Record<string,unknown>,due=row.dueAt??row.due_at;
 if(typeof row.id!=='string'||!row.id||(expectedId&&row.id!==expectedId)||(row.petId??row.pet_id)!==petId||typeof row.title!=='string'||!row.title.trim()||typeof row.type!=='string'||typeof due!=='string'||!Number.isFinite(Date.parse(due))||!['active','snoozed','done'].includes(String(row.status))||row.deleted_at)return null;
 const metadata=row.metadata&&typeof row.metadata==='object'?row.metadata as Record<string,unknown>:{};
 const mode=reminderMode(row.timeMode??metadata.timeMode);
 const recurrence=['none','daily','weekly','monthly','quarterly','yearly'].includes(String(row.recurrence))?row.recurrence as ReminderRecurrence:undefined;
 const optionalDate=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?value:undefined;
 return {id:row.id,petId,title:row.title,type:row.type,dueAt:due,status:String(row.status),timeMode:mode,recurrence,
  completedAt:optionalDate(row.completedAt??row.completed_at),snoozedUntil:optionalDate(row.snoozedUntil??row.snoozed_until),nextDueAt:optionalDate(row.nextDueAt??row.next_due_at)};
}

export function reminderCalendarText(item:ReminderRecord,petName:string,now=new Date()){
 const start=new Date(item.snoozedUntil||item.dueAt);if(!Number.isFinite(start.getTime()))throw new Error('INVALID_DATE');
 const stamp=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const day=(date:Date)=>`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}`;
 const esc=(text:string)=>text.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const dateOnly=!item.timeMode||item.timeMode==='flexible';
 const end=new Date(start);if(dateOnly)end.setDate(end.getDate()+1);else end.setHours(end.getHours()+1);
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Pso//Care Calendar//RU','BEGIN:VEVENT',`UID:${esc(item.id)}@pso-mvp`,`DTSTAMP:${stamp(now)}`,
  dateOnly?`DTSTART;VALUE=DATE:${day(start)}`:`DTSTART:${stamp(start)}`,dateOnly?`DTEND;VALUE=DATE:${day(end)}`:`DTEND:${stamp(end)}`,
  `SUMMARY:${esc(item.title)}`,`DESCRIPTION:${esc(`Псё: ${petName}. ${reminderTiming(item)}. Экспортировано одно дело; повтор ведётся в Псё.`)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
}
