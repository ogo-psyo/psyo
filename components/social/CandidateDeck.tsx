'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { CaretLeft, CaretRight, ChatCircle, PawPrint } from '@phosphor-icons/react';
import type { SocialCandidate, SocialScenario } from '@/lib/socialCore';

const scenarioLabels: Record<SocialScenario,string> = {meet:'Знакомство',walk:'Компания для прогулок',socialize:'Социализация',mating:'Случка'};
const traitLabels: Record<string,string> = {puppy:'Щенок',adult:'Взрослая',senior:'Старшая',calm:'Спокойный ритм',balanced:'Обычный ритм',active:'Активный ритм',friendly:'Дружелюбна к собакам',selective:'Выбирает компанию',cautious:'Нужно мягкое знакомство'};
const label=(value:string|null)=>value?(traitLabels[value]||value.replaceAll('_',' ')):null;

function PhotoImage({src,name}:{src:string|null;name:string}) {
  const [state,setState]=useState<'loading'|'ready'|'error'>(src?'loading':'error');
  return <div className="gav-photo" data-photo-state={src?state:'missing'}>
    {src&&state!=='error'&&<img src={src} alt={`Фото ${name}`} draggable={false} decoding="async" onLoad={()=>setState('ready')} onError={()=>setState('error')}/>}
    {(!src||state==='error')&&<div className="gav-photo-fallback"><PawPrint aria-hidden="true"/><span>{src?'Фото не загрузилось':'Фото пока нет'}</span>{src&&<button type="button" onClick={()=>setState('loading')}>Повторить</button>}</div>}
    {state==='loading'&&<span className="gav-photo-loading" role="status">Загружаю фото…</span>}
  </div>;
}

export function CandidatePhoto({src,name}:{src:string|null;name:string}) {
  return <PhotoImage key={src||'missing'} src={src} name={name}/>;
}

export function CandidateDeck({candidates,selectedId,onSelect,busyId,onRequest,preferredScenario}: {
  candidates:SocialCandidate[]; selectedId:string|null; onSelect:(id:string)=>void;
  busyId:string|null; preferredScenario:SocialScenario|'all';
  onRequest:(id:string,scenario:SocialScenario)=>void|Promise<boolean|void>;
}) {
  const [announcement,setAnnouncement]=useState('');
  const [requestError,setRequestError]=useState('');
  const drag=useRef<{x:number;y:number;id:number}|null>(null);
  const requesting=useRef(false);
  const activeIndex=Math.max(0,candidates.findIndex(c=>c.petId===selectedId));
  const candidate=candidates[activeIndex];
  if(!candidate)return null;
  const busy=busyId===candidate.petId;
  const change=(step:number)=>{
    if(busy||requesting.current)return;
    const next=candidates[activeIndex+step];
    if(!next)return;
    onSelect(next.petId);setRequestError('');setAnnouncement(`${activeIndex+step+1} из ${candidates.length}: ${next.name}`);
  };
  const finish=(event:PointerEvent<HTMLElement>)=>{
    const start=drag.current;drag.current=null;event.currentTarget.style.transform='';
    if(!start||event.type!=='pointerup')return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    if(Math.abs(dx)>=65&&Math.abs(dx)>Math.abs(dy)*1.5)change(dx<0?1:-1);
  };
  const traits=[label(candidate.lifeStage),candidate.weightKg?`${candidate.weightKg} кг`:null,label(candidate.energyLevel)].filter(Boolean);
  const scenario=preferredScenario!=='all'&&candidate.sharedScenarios.includes(preferredScenario)?preferredScenario:candidate.sharedScenarios[0]||'meet';
  return <section className="gav-deck" aria-label="Анкеты собак">
    <article className="gav-deck-card" key={candidate.petId} onPointerDown={event=>{
      if(busy||!(event.target instanceof HTMLElement)||event.target.closest('button,a,summary,input,select'))return;
      drag.current={x:event.clientX,y:event.clientY,id:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event=>{
      if(!drag.current)return;
      const dx=event.clientX-drag.current.x,dy=event.clientY-drag.current.y;
      if(Math.abs(dy)>Math.abs(dx)){event.currentTarget.style.transform='';return;}
      if(window.matchMedia('(prefers-reduced-motion: no-preference)').matches)event.currentTarget.style.transform=`translateX(${Math.max(-35,Math.min(35,dx*.22))}px)`;
    }} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={event=>{drag.current=null;event.currentTarget.style.transform='';}}>
      <div className="gav-card-meta"><span>{scenarioLabels[scenario]}</span><span>{activeIndex+1} / {candidates.length}</span></div>
      <CandidatePhoto src={candidate.avatarUrl} name={candidate.name}/>
      <div className="gav-card-copy">
        <div className="gav-card-heading"><h2>{candidate.name}</h2>{candidate.distance&&<span>{candidate.distance}</span>}</div>
        {candidate.district&&<p className="gav-card-district">{candidate.district}</p>}
        {traits.length>0&&<div className="gav-card-traits">{traits.map(t=><span key={t}>{t}</span>)}</div>}
        {candidate.reasons.length>0&&<p className="gav-card-reason">{candidate.reasons.slice(0,2).join(' · ')}</p>}
        <details className="gav-card-details"><summary>О собаке подробнее</summary>
          <dl>{[['Характер',label(candidate.temperament)],['С другими собаками',label(candidate.dogFriendly)],['Игра',label(candidate.playStyle)]].filter(([,v])=>v).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <p>Цели: {candidate.scenarios.map(s=>scenarioLabels[s]).join(' · ')}</p>
          {candidate.reasons.length>2&&<ul>{candidate.reasons.slice(2).map(r=><li key={r}>{r}</li>)}</ul>}
          <p>Контакт откроется после взаимного согласия.</p>
        </details>
      </div>
    </article>
    <div className="gav-deck-actions">
      <button type="button" aria-label="Предыдущая анкета" disabled={activeIndex===0||busy} onClick={()=>change(-1)}><CaretLeft aria-hidden="true"/></button>
      <button type="button" className="gav-respond" disabled={busy} onClick={async()=>{
        if(requesting.current)return;requesting.current=true;setRequestError('');
        try{await onRequest(candidate.petId,scenario);}catch{setRequestError('Не удалось отправить отклик. Повторите попытку.');}finally{requesting.current=false;}
      }}><ChatCircle aria-hidden="true"/>{busy?'Отправляю…':'Откликнуться'}</button>
      <button type="button" aria-label="Следующая анкета" disabled={activeIndex===candidates.length-1||busy} onClick={()=>change(1)}><CaretRight aria-hidden="true"/></button>
    </div>
    {requestError&&<p role="alert">{requestError}</p>}
    <p className="gav-swipe-hint">{candidates.length>1?'Листайте в стороны · отклик по кнопке':'Новые анкеты появятся здесь'}</p>
    <span className="sr-only" role="status">{announcement}</span>
  </section>;
}
