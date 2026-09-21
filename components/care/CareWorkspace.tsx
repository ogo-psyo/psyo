'use client';
import {useEffect,useRef,useState, type FormEvent} from 'react';
import {inflectPetName} from '@/lib/copy';
import {DayPicker} from 'react-day-picker';
import {ru} from 'react-day-picker/locale';
import {ExactIcon,ExactPage} from '../exact/ExactShell';
import {careDomains,domainOf,eventDay,localDay,newCareDraft,editCareDraft, type CareDraft} from '@/lib/careDomains';
import {reminderTiming,type ReminderRecord,type CareDomain} from '@/lib/reminder';
import {nextReminderDueAt} from '@/lib/reminderRecurrence';
import 'react-day-picker/style.css';
import './care-workspace.css';

const domains=Object.keys(careDomains) as CareDomain[];
const parse=(d:string)=>new Date(`${d}T12:00:00`);
const dateLabel=(d:string)=>parse(d).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
const repeatLabels={none:'Без повтора',daily:'Каждый день',weekly:'Каждую неделю',monthly:'Каждый месяц',quarterly:'Раз в три месяца',yearly:'Каждый год'};
export type CareWorkspaceProps={
 loading:boolean;loadError:boolean;onRetry:()=>void;
 items:ReminderRecord[];busy:boolean;issue?:{scope:string;message:string}|null;dogName:string;
 contexts:Partial<Record<CareDomain,string>>;onProfile:()=>void;onBack:()=>void;
 onCreate:(draft:CareDraft)=>Promise<boolean>;onUpdate:(id:string,draft:CareDraft)=>Promise<boolean>;
 onComplete:(id:string,at:string)=>Promise<unknown>;onUndo:(r:ReminderRecord)=>Promise<unknown>;
 onDelete:(r:ReminderRecord)=>void;onExport:(r:ReminderRecord)=>void;
 editingItem?:ReminderRecord;onCloseEdit:()=>void;
 historyErrors:Record<string,string>;onRetryHistory:(id:string)=>void;
};
export function CareWorkspace(p:CareWorkspaceProps){
 const [view,setView]=useState<'overview'|'calendar'|'domain'|'detail'|'form'|'complete'|'reschedule'>('overview');
 const [returnView,setReturnView]=useState<'overview'|'calendar'|'domain'>('overview');
 const [domain,setDomain]=useState<CareDomain|null>(null);
 const [selected,setSelected]=useState(localDay(new Date()));
 const [month,setMonth]=useState(new Date());
 const [filter,setFilter]=useState<CareDomain|'all'|'free'>('all');
 const [detail,setDetail]=useState<ReminderRecord|null>(null);
 const [draft,setDraft]=useState<CareDraft>(()=>newCareDraft());
 const draftCache=useRef<CareDraft|null>(null);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [actual,setActual]=useState(localDay(new Date()));
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);
 const lock=useRef(false);
 useEffect(()=>{if(detail&&!p.items.some(r=>r.id===detail.id)&&!busy){setDetail(null);setView(returnView);}},[p.items,detail,p.busy,returnView]);
 const effective=view==='form'?'form':p.editingItem?'external':view;
 const busy=p.busy||saving;
 const plans=p.items.filter(r=>r.status!=='done').sort((a,b)=>Date.parse(a.snoozedUntil||a.dueAt)-Date.parse(b.snoozedUntil||b.dueAt));
 const history=p.items.filter(r=>r.status==='done').sort((a,b)=>Date.parse(b.completedAt||b.dueAt)-Date.parse(a.completedAt||a.dueAt));
 const chosen=detail?(detail.status==='done'?p.items.find(r=>r.id===detail.id&&r.completedAt===detail.completedAt):p.items.find(r=>r.id===detail.id&&r.status!=='done'))||detail:null;
 const go=(next:typeof view)=>{setError('');setView(next);};
 const back=()=>{if(busy)return;if(p.editingItem)p.onCloseEdit();if(view==='form')draftCache.current=draft;go(view==='complete'||view==='reschedule'?'detail':view==='detail'||view==='form'?returnView:'overview');};
 async function run(action:()=>Promise<unknown>,done:()=>void){
  if(lock.current)return;lock.current=true;setSaving(true);setError('');
  try{if(await action())done();else setError('Не удалось сохранить. Ввод остался — попробуй ещё раз.');}
  catch{setError('Не удалось сохранить. Проверь соединение и попробуй ещё раз.');}
  finally{lock.current=false;setSaving(false);}
 }
 function start(mode:'plan'|'done',d:CareDomain|null=domain){setReturnView(view==='calendar'?'calendar':view==='domain'?'domain':'overview');setEditingId(null);setDraft(draftCache.current?.mode===mode&&draftCache.current.careDomain===d?draftCache.current:newCareDraft(d,view==='calendar'?selected:undefined,mode));go('form');}
 function open(r:ReminderRecord){setReturnView(view==='calendar'?'calendar':view==='domain'?'domain':'overview');setDetail(r);go('detail');}
 function row(r:ReminderRecord){return <article className="cw-event" key={`${r.id}:${r.completedAt||'plan'}`} data-reminder-id={r.id}>
  <button type="button" className="cw-event-open" onClick={()=>open(r)}><span className="cw-meta">{domainOf(r)?careDomains[domainOf(r)!].title:'Своё дело'}</span><strong>{r.title}</strong><small>{r.status==='done'?`Сделано ${dateLabel(eventDay(r))}`:reminderTiming(r)}</small></button>
  {r.status!=='done'&&<button type="button" className="cw-check" disabled={busy} aria-label={`Отметить выполненным: ${r.title}`} onClick={()=>{setDetail(r);setActual(localDay(new Date()));setReturnView(view==='calendar'?'calendar':view==='domain'?'domain':'overview');go('complete');}}><ExactIcon name="check"/></button>}
 </article>;}
 const issue=error||p.issue?.message;
 const alert=issue?<p role="alert" className="cw-error">{issue}</p>:null;
 const historyIssues=Object.entries(p.historyErrors).map(([id,msg])=><p role="alert" className="cw-error" key={id}>{msg} <button type="button" onClick={()=>p.onRetryHistory(id)}>Повторить</button></p>);
 const tabs=<div className="cw-tabs" aria-label="Вид заботы">{(['overview','calendar'] as const).map(v=><button type="button" key={v} aria-pressed={view===v} onClick={()=>go(v)}>{v==='overview'?'Обзор':'Календарь'}</button>)}</div>;
 const add=<div className="cw-add"><button type="button" className="primary" onClick={()=>start('plan',view==='domain'?domain:null)}>Запланировать</button><button type="button" className="text-button" onClick={()=>start('done',view==='domain'?domain:null)}>Уже сделали</button></div>;
 const title=view==='domain'&&domain?careDomains[domain].title:'Забота';
 if(p.loading||p.loadError)return <ExactPage viewKey="care" onBack={p.onBack}><div className="cw"><h1>Забота</h1>{p.loading?<p role="status">Загружаю дела…</p>:<><p role="alert">Не удалось загрузить дела. Сохранённые записи не потеряны.</p><button type="button" className="primary" onClick={p.onRetry}>Повторить</button></>}</div></ExactPage>;
 if(effective==='external')return <ExactPage viewKey="care-edit" onBack={()=>p.onCloseEdit()}><div className="cw"><h1>Изменить дело</h1><CareForm key={p.editingItem!.id} initial={editCareDraft(p.editingItem!)} busy={busy} error={issue} editing onSave={d=>run(()=>p.onUpdate(p.editingItem!.id,d),p.onCloseEdit)} onCancel={p.onCloseEdit}/></div></ExactPage>;
 return <ExactPage viewKey={`care:${view}`} onBack={view==='overview'||view==='calendar'?p.onBack:back}><div className="cw">
 {(view==='overview'||view==='calendar'||view==='domain')&&<><h1>{title}</h1>{view!=='domain'&&<p className="cw-lead">Для {p.dogName?inflectPetName(p.dogName,'gent'):'твоей собаки'} — сегодня и дальше.</p>}{view!=='domain'&&tabs}</>}
 {view==='overview'&&<>
  {plans[0]?<section className="cw-next" aria-label="Ближайшее дело"><span className="cw-meta">{reminderTiming(plans[0])}</span><h2>{plans[0].title}</h2><div className="cw-actions"><button type="button" onClick={()=>open(plans[0])}>Открыть</button><button type="button" onClick={()=>{setDetail(plans[0]);setActual(localDay(new Date()));go('complete');}}>Уже сделано</button></div></section>:<p className="cw-empty">Пока ничего не запланировано.</p>}
  <div className="cw-domains">{domains.map(d=>{const next=plans.find(r=>domainOf(r)===d),last=history.find(r=>domainOf(r)===d),context=p.contexts[d];return <button type="button" className="cw-domain" data-domain={d} key={d} onClick={()=>{setDomain(d);go('domain');}}>
   <span className="cw-art"><img src={`/illustrations/care-${d}.webp`} alt="" width="320" height="220"/></span><span className="cw-domain-content"><strong>{careDomains[d].title}<ExactIcon name="next"/></strong><span>{next?.title||context||last?.title||'Пока без записей'}</span><small>{next?dateLabel(eventDay(next)):context?'Из профиля':last?`Сделано ${dateLabel(eventDay(last))}`:'Добавить своё'}</small></span>
  </button>;})}</div>
  {p.items.some(r=>domainOf(r)===null)&&<section className="cw-section"><h2>Свои дела</h2>{plans.filter(r=>domainOf(r)===null).map(row)}{history.filter(r=>domainOf(r)===null).map(row)}</section>}
  {add}
 </>}
 {view==='domain'&&domain&&<>
  <div className="cw-hero"><img src={`/illustrations/care-${domain}.webp`} alt="" width="225" height="150"/></div>
  {p.contexts[domain]&&<section className="cw-context"><p>{p.contexts[domain]}</p><button type="button" onClick={p.onProfile}>Изменить в профиле</button></section>}
  <section className="cw-section"><h2>Ближайшее</h2>{plans.filter(r=>domainOf(r)===domain).map(row)}{!plans.some(r=>domainOf(r)===domain)&&<p className="cw-empty">Пока без планов.</p>}</section>
  {add}<section className="cw-section"><h2>История</h2>{historyIssues}{history.filter(r=>domainOf(r)===domain).map(row)}{!history.some(r=>domainOf(r)===domain)&&!historyIssues.length&&<p className="cw-empty">Здесь останется то, что вы сделали.</p>}</section>
 </>}
 {view==='calendar'&&<>
  <section className="cw-calendar" data-care-calendar aria-label="Календарь дел"><DayPicker locale={ru} mode="single" selected={parse(selected)} onSelect={d=>d&&setSelected(localDay(d))} month={month} onMonthChange={setMonth} showOutsideDays fixedWeeks weekStartsOn={1} modifiers={{planned:plans.map(r=>parse(eventDay(r))),done:history.map(r=>parse(eventDay(r)))}} modifiersClassNames={{planned:'has-plan',done:'has-done'}} labels={{labelPrevious:()=> 'Предыдущий месяц',labelNext:()=> 'Следующий месяц'}}/>
   <div className="cw-legend"><span>● План</span><span>○ Сделано</span></div>
  </section><div className="cw-filters" aria-label="Категория">{([{value:'all',label:'Все'},...domains.map(d=>({value:d,label:careDomains[d].title})),{value:'free',label:'Без категории'}] as const).map(f=><button type="button" key={f.value} aria-pressed={filter===f.value} onClick={()=>setFilter(f.value)}>{f.label}</button>)}</div>
  <div className="cw-actions"><h2>{dateLabel(selected)}</h2><button type="button" onClick={()=>{setSelected(localDay(new Date()));setMonth(new Date());}}>Сегодня</button></div>
  {historyIssues}{p.items.filter(r=>eventDay(r)===selected&&(filter==='all'||(filter==='free'?domainOf(r)===null:domainOf(r)===filter))).map(row)}
  {!p.items.some(r=>eventDay(r)===selected&&(filter==='all'||(filter==='free'?domainOf(r)===null:domainOf(r)===filter)))&&<p className="cw-empty">На эту дату записей нет.</p>}{add}
 </>}
 {view==='form'&&<><h1>{editingId?'Изменить дело':draft.mode==='done'?'Уже сделали':'Новое дело'}</h1><CareForm key={editingId||'new'} initial={draft} busy={busy} error={issue} editing={!!editingId} onChange={setDraft} onCancel={back} onSave={d=>{setDraft(d);return run(()=>editingId?p.onUpdate(editingId,d):p.onCreate(d),()=>{draftCache.current=null;setDetail(null);go(returnView);});}}/></>}
 {view==='detail'&&chosen&&<><span className="cw-meta">{domainOf(chosen)?careDomains[domainOf(chosen)!].title:'Своё дело'}</span><h1>{chosen.title}</h1><section className="cw-detail"><p>{chosen.status==='done'?`Сделано ${dateLabel(eventDay(chosen))}`:reminderTiming(chosen)}</p>{chosen.status==='done'&&<p className="cw-meta">Планировали: {dateLabel(localDay(new Date(chosen.dueAt)))}</p>}{chosen.note&&<p className="cw-note">{chosen.note}</p>}<p>{repeatLabels[chosen.recurrence||'none']}</p>{chosen.recurrence&&chosen.recurrence!=='none'&&<p className="cw-meta">{chosen.recurrenceBasis==='completed'?'После выполнения':'От плановой даты'}</p>}<p className="cw-meta">{chosen.reminderPreference&&chosen.reminderPreference!=='off'?'Напоминание сохранено, но сообщения бота пока недоступны.':'Без сообщения от бота'}</p></section>
  {alert}<div className="cw-detail-actions">{chosen.status==='done'?<button type="button" className="secondary" disabled={busy} onClick={()=>void run(()=>p.onUndo(chosen),()=>go(returnView))}>Отменить отметку выполнения</button>:<><button type="button" className="primary" disabled={busy} onClick={()=>{setActual(localDay(new Date()));go('complete');}}>Уже сделано</button><button type="button" className="secondary" onClick={()=>{setDraft(editCareDraft(chosen));go('reschedule');}}>Перенести</button><button type="button" className="secondary" onClick={()=>{setEditingId(chosen.id);setDraft(editCareDraft(chosen));go('form');}}>Изменить</button></>}
  <button type="button" className="text-button" onClick={()=>p.onExport(chosen)}>В календарь телефона</button><button type="button" className="text-button" disabled={busy} onClick={()=>p.onDelete(chosen)}>Удалить дело</button></div>
 </>}
 {view==='complete'&&chosen&&<><h1>Уже сделано</h1><p>{chosen.title}</p><form className="cw-form" onSubmit={e=>{e.preventDefault();void run(()=>p.onComplete(chosen.id,new Date(`${actual}T00:00:00`).toISOString()),()=>go(returnView));}}><fieldset disabled={busy}><label>Когда сделали<input type="date" required value={actual} max={localDay(new Date())} onChange={e=>setActual(e.target.value)}/></label>{chosen.recurrence&&chosen.recurrence!=='none'&&actual&&<p>Следующий раз: {dateLabel(localDay(new Date(nextReminderDueAt(chosen.recurrenceBasis==='completed'?parse(actual).toISOString():chosen.dueAt,chosen.recurrence)!)))}</p>}{alert}<button type="submit" className="primary">{busy?'Сохраняю…':'Записать выполнение'}</button><button type="button" className="text-button" onClick={back}>Отмена</button></fieldset></form></>}
 {view==='reschedule'&&chosen&&<><h1>Перенести</h1><p>{chosen.title}</p><form className="cw-form" onSubmit={e=>{e.preventDefault();void run(()=>p.onUpdate(chosen.id,draft),()=>{setDetail(null);go(returnView);});}}><fieldset disabled={busy}><label>Новая дата<input type="date" required value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>{draft.hasTime&&<label>Время<input type="time" required value={draft.time} onChange={e=>setDraft({...draft,time:e.target.value})}/></label>}{alert}<button type="submit" className="primary">{busy?'Сохраняю…':'Сохранить дату'}</button><button type="button" className="text-button" onClick={back}>Отмена</button></fieldset></form></>}
 {(view==='overview'||view==='calendar'||view==='domain')&&alert}
 </div></ExactPage>;
}
function CareForm({initial,busy,error,editing,onSave,onCancel,onChange}:{initial:CareDraft;busy:boolean;error?:string;editing?:boolean;onSave:(d:CareDraft)=>Promise<void>;onCancel:()=>void;onChange?:(d:CareDraft)=>void}){
 const [d,setD]=useState(initial);const [choosing,setChoosing]=useState(false);
 function change(patch:Partial<CareDraft>){const next={...d,...patch};setD(next);onChange?.(next);}
 function submit(e:FormEvent){e.preventDefault();if(!busy)void onSave(d);}
 return <form className="cw-form" aria-label={editing?'Изменить дело':'Новое дело'} onSubmit={submit}><fieldset disabled={busy}>
 {!editing&&<div className="cw-tabs">{(['plan','done'] as const).map(mode=><button type="button" key={mode} aria-pressed={d.mode===mode} onClick={()=>change({mode})}>{mode==='plan'?'Планирую':'Уже сделали'}</button>)}</div>}
 <button type="button" className="cw-category" aria-expanded={choosing} onClick={()=>setChoosing(!choosing)}>{d.careDomain?careDomains[d.careDomain].title:'Без категории'}<ExactIcon name="next"/></button>
 {choosing&&<div className="cw-filters">{[null,...domains].map(v=><button type="button" key={v||'free'} aria-pressed={d.careDomain===v} onClick={()=>{change({careDomain:v});setChoosing(false);}}>{v?careDomains[v].title:'Без категории'}</button>)}</div>}
 <label>Что за дело?<input required maxLength={200} value={d.title} onChange={e=>change({title:e.target.value})} placeholder="Напиши своё"/></label>
 {d.careDomain&&!editing&&<div className="cw-filters">{careDomains[d.careDomain].examples.map(title=><button type="button" key={title} onClick={()=>change({title})}>{title}</button>)}</div>}
 <label>{d.mode==='done'?'Когда сделали':'Дата'}<input type="date" required value={d.date} max={d.mode==='done'?localDay(new Date()):undefined} onChange={e=>change({date:e.target.value})}/></label>
 <label className="cw-checkbox"><input type="checkbox" checked={d.hasTime} onChange={e=>change({hasTime:e.target.checked})}/>Указать время</label>
 {d.hasTime&&<><label>Время<input type="time" required value={d.time} onChange={e=>change({time:e.target.value})}/></label><label>Точность<select aria-label="Точность" value={d.precision} onChange={e=>change({precision:e.target.value as CareDraft['precision']})}><option value="exact">Точное время</option><option value="approximate">Примерно</option></select></label></>}
 {d.mode==='plan'&&<><label>Повтор<select aria-label="Повтор" value={d.recurrence} onChange={e=>change({recurrence:e.target.value as CareDraft['recurrence']})}>{Object.entries(repeatLabels).map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>{d.recurrence!=='none'&&<fieldset className="cw-filters"><legend>Следующий раз</legend>{(['planned','completed'] as const).map(b=><button type="button" key={b} aria-pressed={d.recurrenceBasis===b} onClick={()=>change({recurrenceBasis:b})}>{b==='planned'?'От плановой даты':'После выполнения'}</button>)}</fieldset>}
 <label>Напомнить<select aria-label="Напомнить" value={d.reminderPreference} onChange={e=>change({reminderPreference:e.target.value as CareDraft['reminderPreference']})}><option value="off">Без напоминания</option><option value="day">В этот день</option><option value="before">Накануне</option></select></label>{d.reminderPreference!=='off'&&<p className="cw-meta" role="status">Сообщения бота пока недоступны. Дело останется в календаре.</p>}</>}
 <label>Заметка<textarea rows={2} maxLength={2000} value={d.note} onChange={e=>change({note:e.target.value})} placeholder="Если нужно что-то уточнить"/></label>
 {error&&<p className="cw-error" role="alert">{error}</p>}<button type="submit" className="primary" disabled={busy||!d.title.trim()}>{busy?'Сохраняю…':editing?'Сохранить изменения':d.mode==='done'?'Сохранить в историю':'Сохранить дело'}</button><button type="button" className="text-button" onClick={onCancel}>Назад</button>
 </fieldset></form>;
}
