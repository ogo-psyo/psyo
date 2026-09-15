'use client';
import { useEffect, useRef } from 'react';
import styles from './ProfileConflictDialog.module.css';
export type RecordDetail = { id: string; title: string; date: string; text: string; facts: string[]; trigger?: HTMLElement };
export function RecordDetailDialog({ record, onClose }: { record: RecordDetail; onClose: () => void }) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{dialog.current?.showModal();return()=>{requestAnimationFrame(()=>record.trigger?.focus({preventScroll:true}));};},[record]);
  function close(){dialog.current?.close();onClose();}
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="record-detail-title" onCancel={event=>{event.preventDefault();close();}} data-record-id={record.id}>
    <h2 id="record-detail-title">{record.title}</h2>
    <time dateTime={record.date}>{new Date(record.date).toLocaleString('ru-RU',{dateStyle:'long',timeStyle:'short'})}</time>
    <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{record.text}</p>
    {record.facts.length>0&&<ul>{record.facts.map(fact=><li key={fact}>{fact}</li>)}</ul>}
    <div className={styles.actions}><button type="button" onClick={close}>Назад к истории</button></div>
  </dialog>;
}
