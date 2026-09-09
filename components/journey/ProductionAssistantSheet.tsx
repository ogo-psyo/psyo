'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {PaperPlaneTilt,X} from '@phosphor-icons/react';
import styles from './AssistantSurface.module.css';

export function ProductionAssistantSheet({dogName,returnFocusTo,question,answer,messages,loading,error,suggestions,actions,diagnostic,onQuestionChange,onAsk,onClose}: {
 dogName:string;returnFocusTo?:HTMLElement|null;avatar:ReactNode;question:string;answer:string;messages?:Array<{role:'user'|'assistant';content:string}>;
 loading:boolean;error?: string;suggestions:string[];actions?:ReactNode;diagnostic?:{provider?:string;mode?:string};
 onQuestionChange:(value:string)=>void;onAsk:(question?:string)=>void;onClose:()=>void;
}) {
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),trigger=useRef<HTMLElement|null>(null);
 const conversation=Boolean(messages?.length||answer||loading||error);
 useEffect(()=>{
  trigger.current=returnFocusTo??document.activeElement as HTMLElement|null;
  dialog.current?.showModal();
  const frame=requestAnimationFrame(()=>input.current?.focus());
  return()=>{cancelAnimationFrame(frame);requestAnimationFrame(()=>trigger.current?.focus());};
 },[returnFocusTo]);
 function close(){dialog.current?.close();onClose();}
 return <dialog ref={dialog} className={styles.dialog} aria-label="Спросить Псё" data-assistant-provider={diagnostic?.provider||'pending'} data-assistant-mode={diagnostic?.mode||'pending'} onCancel={e=>{e.preventDefault();e.stopPropagation();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
  <section className={`${styles.sheet} ${conversation?styles.conversation:styles.entry}`}>
   <header className={styles.header}><div><h2 data-assistant-heading>Псё</h2><span>{dogName}</span></div><button type="button" aria-label="Закрыть" onClick={close}><X aria-hidden="true"/></button></header>
   <div className={styles.scroll} data-assistant-scroll>
    {messages?.length?<div className={styles.messages} aria-live="polite">{messages.map((message,index)=><article className={message.role==='user'?styles.user:styles.answer} key={`${message.role}-${index}`} aria-label={message.role==='user'?'Вы':'Псё'}><p>{message.content}</p></article>)}</div>:answer&&<p className={styles.answer} role="status">{answer}</p>}
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {actions}
    {suggestions.length>0&&<details className={styles.suggestions}><summary>{conversation?'Ещё по теме':'С чего начать'}</summary>{suggestions.slice(0,3).map(s=><button type="button" key={s} onClick={()=>onAsk(s)}>{s}</button>)}</details>}
   </div>
   {!conversation&&<div className={styles.welcome}><h3 data-assistant-heading>Что у вас<br/>сегодня?</h3></div>}
   <form className={styles.composer} data-assistant-composer onSubmit={e=>{e.preventDefault();onAsk();}}>
    <label className="sr-only" htmlFor="production-assistant-question">Вопрос ассистенту</label>
    <input id="production-assistant-question" ref={input} value={question} onChange={e=>onQuestionChange(e.target.value)} placeholder={conversation?'Напиши ещё…':'Напиши, что у вас…'}/>
    <button type="submit" disabled={loading||!question.trim()} aria-busy={loading} aria-label={loading?'Псё думает':'Отправить'}><PaperPlaneTilt aria-hidden="true"/></button>
   </form>
  </section>
 </dialog>;
}

export function AgentAuxiliaryDialog({title,onClose,children,returnFocusTo}:{title:string;onClose:()=>void;children:ReactNode;returnFocusTo?:HTMLElement|null}) {
 const dialog=useRef<HTMLDialogElement>(null),back=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const trigger=returnFocusTo??document.activeElement as HTMLElement|null;
  dialog.current?.showModal();back.current?.focus();
  return()=>{requestAnimationFrame(()=>trigger?.focus());};
 },[returnFocusTo]);
 function close(){dialog.current?.close();onClose();}
 return <dialog ref={dialog} className={styles.dialog} aria-label={title} onCancel={e=>{e.preventDefault();e.stopPropagation();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}><section className={`${styles.sheet} ${styles.conversation}`}>
  <header className={styles.header}><h2 data-assistant-heading>{title}</h2><button ref={back} type="button" aria-label="Вернуться в разговор" onClick={close}><X aria-hidden="true"/></button></header>
  <div className={styles.scroll}>{children}</div>
 </section></dialog>;
}
