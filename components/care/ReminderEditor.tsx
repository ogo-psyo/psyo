'use client';
import {useState} from 'react';
import type {ReminderRecord,ReminderTimeMode,ReminderRecurrence} from '@/lib/reminder';
export type ReminderDraft={title:string;type:string;date:string;time:string;timeMode:ReminderTimeMode|'';recurrence:ReminderRecurrence};
export function draftForReminder(reminder:ReminderRecord):ReminderDraft{
 const date=new Date(reminder.snoozedUntil||reminder.dueAt);
 return {title:reminder.title,type:reminder.type,date:`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,time:date.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),timeMode:reminder.timeMode||'',recurrence:reminder.recurrence||'none'};
}
export function ReminderEditor({reminder,drafts,busy,error,onSave,onClose,types,recurrences}:{reminder:ReminderRecord;drafts:Map<string,ReminderDraft>;busy:boolean;error?:string;onSave:(draft:ReminderDraft)=>Promise<boolean>;onClose:()=>void;types:Array<{value:string;label:string}>;recurrences:Array<{value:ReminderRecurrence;label:string}>}){
 const [draft,setDraft]=useState(()=>drafts.get(reminder.id)||draftForReminder(reminder));
 const change=(patch:Partial<ReminderDraft>)=>setDraft(current=>{const next={...current,...patch};drafts.set(reminder.id,next);return next;});
 return <form className="reminder-edit-form" onSubmit={async event=>{event.preventDefault();if(busy)return;if(await onSave(draft)){drafts.delete(reminder.id);onClose();}}}><fieldset disabled={busy} className="care-compose-fields">
  <label>Название дела<input autoFocus required maxLength={200} value={draft.title} onChange={event=>change({title:event.target.value})}/></label>
  <label>Дата дела<input type="date" required value={draft.date} onChange={event=>change({date:event.target.value})}/></label>
  <div className="reminder-edit-row"><label>Точность времени<select value={draft.timeMode} onChange={event=>change({timeMode:event.target.value as ReminderDraft['timeMode']})}><option value="" disabled>Не уточнено</option><option value="flexible">В течение дня</option><option value="exact">Точное время</option><option value="approximate">Примерное время</option></select></label>
  {(draft.timeMode==='exact'||draft.timeMode==='approximate')&&<label>Время дела<input type="time" required value={draft.time} onChange={event=>change({time:event.target.value})}/></label>}</div>
  <details><summary>Повтор и тип</summary><label>Повтор дела<select value={draft.recurrence} onChange={event=>change({recurrence:event.target.value as ReminderRecurrence})}>{recurrences.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label>Тип дела<select value={draft.type} onChange={event=>change({type:event.target.value})}>{types.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label></details>
  {error&&<p role="alert">{error}</p>}
  <div className="care-row-actions"><button type="submit" disabled={busy||!draft.title.trim()}>{busy?'Сохраняю…':'Сохранить'}</button><button type="button" onClick={onClose} disabled={busy}>Свернуть</button><button type="button" disabled={busy} onClick={()=>{drafts.delete(reminder.id);setDraft(draftForReminder(reminder));}}>Сбросить изменения</button></div>
 </fieldset></form>;
}
