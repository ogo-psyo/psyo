'use client';
import {useRef,useState,type ReactNode} from 'react';
import {ChoiceField} from '@/components/system/ChoiceField';
import type {WalkSignal} from '@/lib/socialCore';
import type {Hazard,useMapCommunity} from './useMapCommunity';
type Community=ReturnType<typeof useMapCommunity>;
export function MapCommunityPanel({kind,point,dogName,avatar,guest,community,selected,onClose}:{kind:'presence'|'hazard';point:{lat:number;lng:number};dogName:string;avatar:ReactNode;guest:boolean;community:Community;selected?:WalkSignal|Hazard|null;onClose:()=>void}){
 const hazard=selected&&'radius'in selected?selected:null,signal=selected&&'name'in selected?selected:null;
 const [title,setTitle]=useState(hazard?.title||''),[minutes,setMinutes]=useState(45),[hours,setHours]=useState(3),[radius,setRadius]=useState(hazard?.radius||50);
 const [editing,setEditing]=useState(!selected),key=useRef(crypto.randomUUID()),id=useRef(hazard?.id||crypto.randomUUID());
 const fingerprint=useRef('');
 const mine=community.signals.find(s=>s.isMine&&s.petId===community.petId);
 const shown=signal||(!editing&&mine?mine:null);
 async function submit(event:React.FormEvent){event.preventDefault();const body=kind==='presence'?{kind,petId:signal?.petId||community.petId,...point,minutes}:{kind,id:id.current,...point,title,radius,hours};const next=JSON.stringify(body);if(next!==fingerprint.current){fingerprint.current=next;key.current=crypto.randomUUID();}if(await community.mutate('PUT',body,key.current))onClose();}
 return <section aria-label={kind==='presence'?'Гуляем сейчас':'Опасность'}>
  <h2>{signal?signal.name:hazard&&!editing?hazard.title:kind==='presence'?'Мы гуляем':'Отметить опасность'}</h2>
  {shown?<><div className="map-dog-card">{shown.avatarUrl&&<img src={shown.avatarUrl} alt={shown.name}/>}<p>{shown.temperament}{shown.dogFriendly?` · ${shown.dogFriendly}`:''}</p></div><p>Примерное место · до {new Date(shown.expiresAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</p></>:kind==='presence'?<div className="map-dog-card">{avatar}<strong>{dogName}</strong></div>:null}
  {selected&&!editing?<><p>{hazard?'Сообщение участника · ':''}До {new Date(selected.expiresAt).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</p>{selected.isMine&&<div className="row-actions"><button type="button" disabled={community.busy} onClick={()=>setEditing(true)}>Изменить</button><button type="button" disabled={community.busy} onClick={async()=>{if(await community.mutate('DELETE',{kind,id:selected.id}))onClose();}}>Убрать отметку</button></div>}</>:guest?<p>Войди в Псё, чтобы поставить отметку.</p>:<form onSubmit={submit}>
   {kind==='hazard'&&<p className="hint">Коснись карты, чтобы уточнить место.</p>}
   {kind==='presence'?<ChoiceField label="На сколько" value={minutes} options={[30,45,60].map(value=>({value,label:`${value} мин`}))} onChange={setMinutes} disabled={community.busy}/>:<><label>Что случилось<input required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label><ChoiceField label="Область" value={radius} options={[20,50,100,250,500].map(value=>({value,label:`${value} м`}))} onChange={setRadius} disabled={community.busy}/><ChoiceField label="Срок" value={hours} options={[1,3,24].map(value=>({value,label:`${value} ч`}))} onChange={setHours} disabled={community.busy}/></>}
   <button className="primary full" type="submit" disabled={community.busy}>{community.busy?'Сохраняю…':selected?'Сохранить':'Поставить отметку'}</button>
   {kind==='presence'&&mine&&<button type="button" disabled={community.busy} onClick={async()=>{if(await community.mutate('DELETE',{kind,id:mine.id}))onClose();}}>Закончить прогулку на карте</button>}
  </form>}
  {community.error&&<p role="alert">{community.error}</p>}
 </section>;
}
