'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,ArrowUp} from '@phosphor-icons/react';
import styles from './ConnectedShell.module.css';
type Recent={id:string;question?:string;thread_id?:string;status?:string};
export function ConnectedHome(props:{dogName:string;petId?:string;guest:boolean;question:string;loading:boolean;recentQuestion?:string;headers:()=>Record<string,string>;onQuestion:(text:string)=>void;onAsk:()=>void;onContinue:(run?:Recent)=>void;onProfile:()=>void;onAll:()=>void}){
 const [recent,setRecent]=useState<Recent|null>(null),[readError,setReadError]=useState(false),[revision,setRevision]=useState(0);
 const headers=useRef(props.headers);useEffect(()=>{headers.current=props.headers;});
 useEffect(()=>{
  if(props.guest||!props.petId)return;
  const controller=new AbortController();
  fetch(`/api/agent/runs?petId=${encodeURIComponent(props.petId)}`,{headers:headers.current(),signal:controller.signal}).then(async response=>{
   if(!response.ok)throw new Error('READ_FAILED');const body=await response.json();if(controller.signal.aborted)return;
   setReadError(false);setRecent(body.enabled&&typeof body.latest?.id==='string'?body.latest:null);
  }).catch(()=>{if(!controller.signal.aborted)setReadError(true);});return()=>controller.abort();
 },[props.petId,props.guest,props.recentQuestion,revision]);
 const topic=props.recentQuestion||recent?.question;
 return <section className={styles.home} aria-label="Псё — разговор" data-connected-home>
  <header className={styles.masthead}><span className={styles.wordmark}>Псё</span><button type="button" onClick={props.onProfile} aria-label={`Открыть профиль ${props.dogName}`}>{props.dogName}<ArrowRight aria-hidden="true"/></button></header>
  <div className={styles.promptGroup}>
   <h1 data-assistant-heading>Что сегодня<br/><span>обсудим?</span></h1>
   <form className={styles.inputSurface} onSubmit={event=>{event.preventDefault();if(props.question.trim()&&!props.loading)props.onAsk();}}>
    <label className={styles.visuallyHidden} htmlFor="connected-question">Сообщение Псё</label>
    <textarea id="connected-question" value={props.question} onChange={event=>props.onQuestion(event.target.value)} placeholder="Начни с любой мысли…" rows={3} maxLength={8000} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(props.question.trim()&&!props.loading)props.onAsk();}}}/>
    <div className={styles.inputActions}><button type="button" className={styles.more} onClick={props.onAll}>Все действия</button><button className={styles.send} type="submit" disabled={!props.question.trim()||props.loading} aria-label={props.loading?'Псё отвечает':'Отправить сообщение'}><ArrowUp aria-hidden="true"/></button></div>
   </form>
   {(topic||recent)&&<button type="button" className={styles.recent} onClick={()=>props.onContinue(props.recentQuestion?undefined:recent??undefined)}><span><small>Продолжить разговор</small><span>{topic||'Последний разговор'}</span></span><ArrowRight aria-hidden="true"/></button>}
   {readError&&!topic&&<div className={styles.readError}><span>Недавний разговор не загрузился.</span><button type="button" onClick={()=>setRevision(v=>v+1)}>Повторить</button></div>}
  </div>
 </section>;
}
export type ToolDestination='diary'|'calendar'|'health'|'habits'|'things'|'passport'|'card';
export function ConnectedTools({onOpen}:{onOpen:(destination:ToolDestination)=>void}){
 const rows:Array<{id:ToolDestination;title:string;detail:string}>=[
  {id:'diary',title:'Дела и записи',detail:'Что происходит сегодня'},
  {id:'calendar',title:'План заботы',detail:'Сроки, повторения и выполнение'},
  {id:'health',title:'Записи и здоровье',detail:'Наблюдения и важные сведения'},
  {id:'habits',title:'Привычки',detail:'То, что помогает каждый день'},
  {id:'things',title:'Вещи и покупки',detail:'Нужное и то, что подошло'},
  {id:'passport',title:'Паспорт и документы',detail:'Сведения и сохранённые файлы'},
  {id:'card',title:'Публичная карточка',detail:'Выбранные сведения по ссылке'},
 ];
 return <section className={styles.toolsPage} data-connected-tools><h1 data-assistant-heading>Всё под рукой</h1><div className={styles.toolList}>{rows.map(row=><button type="button" key={row.id} data-tool-destination={row.id} onClick={event=>{event.currentTarget.focus();onOpen(row.id);}}><span><b>{row.title}</b><small>{row.detail}</small></span><ArrowRight aria-hidden="true"/></button>)}</div></section>;
}
