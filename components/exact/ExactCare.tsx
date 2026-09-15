'use client';
import { useState, type ReactNode } from 'react';
import { reminderTiming, type ReminderRecord } from '@/lib/reminder';
import { ExactIcon, ExactPage } from './ExactShell';

type Props = {
 items: ReminderRecord[]; busy: boolean; issue?: {scope:string;message:string} | null;
 advanced?: ReactNode; editActions?: ReactNode;
 createForm: (onSaved: () => void) => ReactNode; editingForm?: ReactNode; editing: boolean; onCloseEdit: () => void;
 onEdit: (item: ReminderRecord) => void; onComplete: (id:string) => Promise<unknown>;
 onUndo: (item:ReminderRecord) => Promise<unknown>; onBack: () => void;
};
export function ExactCare(props:Props) {
 const [creating,setCreating]=useState(false);
 if (creating || props.editing) return <ExactPage viewKey={props.editing?'care-edit':'care-create'} onBack={()=>{setCreating(false);props.onCloseEdit();}}>
  <h1>{props.editing?'Изменить дело':'Новое дело'}</h1>{props.editing?<>{props.editingForm}{props.editActions}</>:props.createForm(()=>setCreating(false))}
  <button type="button" className="text-button" onClick={()=>{setCreating(false);props.onCloseEdit();}}>К делам</button>
 </ExactPage>;
 const today=new Date();today.setHours(0,0,0,0);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
 const items=[...props.items].sort((a,b)=>Date.parse(a.snoozedUntil||a.dueAt)-Date.parse(b.snoozedUntil||b.dueAt));
 const groups=[
  {name:'Сегодня',items:items.filter(item=>{const at=Date.parse(item.snoozedUntil||item.dueAt);return at>=today.getTime()&&at<tomorrow.getTime();})},
  {name:'Раньше',items:items.filter(item=>Date.parse(item.snoozedUntil||item.dueAt)<today.getTime())},
  {name:'Дальше',items:items.filter(item=>Date.parse(item.snoozedUntil||item.dueAt)>=tomorrow.getTime())},
 ];
 return <ExactPage viewKey="care" onBack={props.onBack}>
  <h1>Что важно</h1><p className="lead">Сегодня, без лишних обязательств.</p>
  {groups.filter(group=>group.items.length).map(group=><section key={group.name}><p className="eyebrow">{group.name}</p>{group.items.map(item=>{
   const done=item.status==='done';
   return <div key={`${item.id}:${item.completedAt || 'active'}`} data-reminder-id={item.id}><div className="task">
    <button type="button" className={`check-button${done?' done':''}`} disabled={props.busy||done&&!item.completedAt} aria-label={`${done?'Отменить выполнение':'Отметить выполненным'}: ${item.title}`} onClick={()=>void(done?props.onUndo(item):props.onComplete(item.id))}>{done&&<ExactIcon name="check"/>}</button>
    <span className="grow"><button type="button" className="exact-task-title" onClick={()=>props.onEdit(item)}><strong className={done?'done-text':undefined}>{item.title}</strong></button><small>{done?'Выполнено':reminderTiming(item)}</small></span>
   </div>{props.issue?.scope===item.id&&<p className="error" role="alert">{props.issue.message}</p>}</div>;
  })}</section>)}
  {!items.length&&<p className="empty">На сегодня дел нет.</p>}
  <button type="button" className="text-button" onClick={()=>setCreating(true)}><ExactIcon name="plus"/>Добавить дело</button>
  {props.advanced && <details><summary>Календарь и история</summary><div className="exact-extension">{props.advanced}</div></details>}
 </ExactPage>;
}
