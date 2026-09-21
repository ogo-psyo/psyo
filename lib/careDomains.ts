import type {CareDomain, ReminderRecord, ReminderRecurrence, CareDetails} from './reminder';
export const careDomains: Record<CareDomain,{title:string;types:string[];examples:string[]}> = {
 health:{title:'Здоровье',types:['vaccine','parasite','medication','vet'],examples:['Обработка','Прививка','Приём у ветеринара']},
 activity:{title:'Активность',types:['walk','activity'],examples:['Прогулка','Игры','Поход']},
 food:{title:'Питание',types:['food'],examples:['Купить корм','Смена рациона']},
 care:{title:'Уход',types:['grooming'],examples:['Груминг','Когти','Расчёсывание']},
 behavior:{title:'Воспитание',types:['training'],examples:['Занятие с кинологом','Новая команда']},
};
export function domainOf(r:ReminderRecord):CareDomain|null {
 if(r.careDomain!==undefined)return r.careDomain;
 return (Object.keys(careDomains) as CareDomain[]).find(d=>careDomains[d].types.includes(r.type))??null;
}
export function localDay(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function eventDay(r:ReminderRecord){return localDay(new Date(r.status==='done'?(r.completedAt||r.dueAt):(r.snoozedUntil||r.dueAt)));}
export type CareDraft=Required<CareDetails> & {title:string;date:string;time:string;hasTime:boolean;precision:'exact'|'approximate';recurrence:ReminderRecurrence;mode:'plan'|'done';type:string};
export function newCareDraft(domain:CareDomain|null=null,date=localDay(new Date()),mode:'plan'|'done'='plan'):CareDraft{return {title:'',date,time:'09:00',hasTime:false,precision:'exact',recurrence:'none',mode,type:'custom',careDomain:domain,note:'',recurrenceBasis:'planned',reminderPreference:'off'};}
export function editCareDraft(r:ReminderRecord):CareDraft{const d=new Date(r.snoozedUntil||r.dueAt);return {...newCareDraft(domainOf(r),localDay(d)),title:r.title,type:r.type,note:r.note||'',time:d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}),hasTime:r.timeMode==='exact'||r.timeMode==='approximate',precision:r.timeMode==='approximate'?'approximate':'exact',recurrence:r.recurrence||'none',recurrenceBasis:r.recurrenceBasis||'planned',reminderPreference:r.reminderPreference||'off'};}
export function careDraftPayload(d:CareDraft){return {title:d.title.trim(),type:d.type,careDomain:d.careDomain,note:d.note.trim(),dueAt:new Date(`${d.date}T${d.hasTime?d.time:'12:00'}:00`).toISOString(),timeMode:d.hasTime?d.precision:'flexible' as const,recurrence:d.mode==='done'?'none' as const:d.recurrence,recurrenceBasis:d.recurrenceBasis,reminderPreference:d.mode==='done'?'off' as const:d.reminderPreference,...(d.mode==='done'?{completedAt:new Date(`${d.date}T${d.hasTime?d.time:'00:00'}:00`).toISOString()}:{} )};}
