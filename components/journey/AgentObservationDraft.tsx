'use client';
import { useEffect, useRef, useState } from 'react';
import { ObservationMetricFields } from '@/components/health/ObservationMetricFields';
import { agentObservationMetrics, reviewedObservation, type ReviewedObservation, type AgentObservationDraft as Draft, type AgentObservationRecord } from '@/lib/agentObservation';
import styles from './AgentObservationDraft.module.css';

export function AgentObservationDraft({id,petId,headers,edits,onSaved,onOpen}: {
  id:string;petId:string;headers:()=>Record<string,string>;edits:Map<string,ReviewedObservation>;
  onSaved:(record:AgentObservationRecord)=>void;
  onOpen:(record:AgentObservationRecord,trigger:HTMLButtonElement)=>void;
}) {
  const [draft,setDraft]=useState<Draft|null>(null);
  const [review,setReview]=useState<ReviewedObservation|null>(null);
  const [record,setRecord]=useState<AgentObservationRecord|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [reload,setReload]=useState(0);
  const alive=useRef(false),text=useRef<HTMLTextAreaElement>(null);
  const callbacks=useRef({headers,onSaved,onOpen});
  useEffect(()=>{callbacks.current={headers,onSaved,onOpen};});
  useEffect(()=>{
    const controller=new AbortController();alive.current=true;
    fetch(`/api/agent/observation-drafts/${id}`,{headers:callbacks.current.headers(),signal:controller.signal})
      .then(async response=>{
        if(!response.ok) throw new Error('READ_FAILED');
        const body=await response.json();
        if(!alive.current||controller.signal.aborted) return;
        if(body.draft.pet_id!==petId) throw new Error('WRONG_PET');
        setDraft(body.draft);setRecord(body.observation??null);setError('');
        setReview(edits.get(id)??{note:body.draft.source_text,observedAt:body.draft.observed_at,metrics:body.draft.metrics});
      }).catch(()=>{if(!controller.signal.aborted)setError('Не удалось открыть черновик. Повторите загрузку.');});
    return()=>{alive.current=false;controller.abort();};
  },[id,petId,edits,reload]);
  function change(next:ReviewedObservation) {setReview(next);edits.set(id,next);}
  async function submit(discard=false) {
    if(busy||!review)return;
    const parsed=reviewedObservation.safeParse(review);
    if(!discard&&!parsed.success){setError('Добавьте текст записи и проверьте дату.');text.current?.focus();return;}
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/agent/observation-drafts/${id}`,{method:discard?'DELETE':'POST',headers:{...callbacks.current.headers(),'Content-Type':'application/json'},...(!discard&&parsed.success?{body:JSON.stringify(parsed.data)}:{})});
      const body=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(body.error??'SAVE_FAILED');
      if(!alive.current)return;
      if(body.draft?.pet_id!==petId||(!discard&&!body.observation?.id))throw new Error('INVALID_RESULT');
      setDraft(body.draft);setRecord(body.observation??null);edits.delete(id);
      if(body.observation)callbacks.current.onSaved(body.observation);
    } catch(cause) {
      if(!alive.current)return;
      const code=cause instanceof Error?cause.message:'';
      setError(['DRAFT_ALREADY_SAVED','DRAFT_DISCARDED','OBSERVATION_NOT_FOUND','RUN_NOT_READY'].includes(code)
        ? 'Состояние записи изменилось. Обновите результат; ваш ввод пока остался здесь.'
        : discard?'Не удалось убрать черновик. Попробуйте ещё раз.':'Не удалось подтвердить сохранение. Ввод остался — повторите попытку.');
    } finally {if(alive.current)setBusy(false);}
  }
  return <section className={styles.sheet} aria-label="Запись из разговора" data-agent-observation={id}>
    {error&&<div><p role="alert">{error}</p><button type="button" disabled={busy} onClick={()=>setReload(value=>value+1)}>Обновить результат</button></div>}
    {!draft&&!error&&<p role="status">Открываю черновик…</p>}
    {draft?.status==='discarded'&&<p role="status">Черновик убран. Запись не создавалась.</p>}
    {draft?.status==='saved'&&<>
      <h3>Запись сохранена</h3>
      {record?<><p className={styles.note}>{record.note||record.value}</p><button type="button" className={styles.primary} onClick={event=>callbacks.current.onOpen(record,event.currentTarget)}>Открыть запись</button></>:<p>Эта запись больше недоступна в истории.</p>}
    </>}
    {draft?.status==='draft'&&review&&<form onSubmit={event=>{event.preventDefault();void submit();}}>
      <h3>Запись о собаке</h3>
      <fieldset disabled={busy}>
        <label htmlFor={`agent-note-${id}`}>Что сохранить</label>
        <textarea ref={text} id={`agent-note-${id}`} value={review.note} maxLength={8000} required onChange={event=>change({...review,note:event.target.value})}/>
        <details><summary>Дата и показатели</summary>
          <label htmlFor={`agent-date-${id}`}>Дата наблюдения</label>
          <input id={`agent-date-${id}`} type="datetime-local" required value={localDate(review.observedAt)} onChange={event=>{const date=new Date(event.target.value);change({...review,observedAt:Number.isFinite(date.getTime())?date.toISOString():''});}}/>
          <ObservationMetricFields values={review.metrics} onChange={patch=>change({...review,metrics:agentObservationMetrics.parse({...review.metrics,...patch})})}/>
        </details>
        {review.note!==draft.source_text&&<details><summary>Исходное сообщение</summary><p className={styles.note}>{draft.source_text}</p></details>}
        <div className={styles.actions}><button type="submit" className={styles.primary}>{busy?'Сохраняю…':'Сохранить запись'}</button><button type="button" onClick={()=>void submit(true)}>Не сохранять</button></div>
      </fieldset>
    </form>}
  </section>;
}
function localDate(value:string) {
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
