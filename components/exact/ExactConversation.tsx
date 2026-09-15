'use client';

import { useEffect, type ComponentProps } from 'react';
import type { ProductionAssistantSheet } from '@/components/journey/ProductionAssistantSheet';
import { ExactIcon, ExactPage } from './ExactShell';

export function ExactConversation(props: ComponentProps<typeof ProductionAssistantSheet>) {
  useEffect(()=>{const origin=props.returnFocusTo;return()=>{requestAnimationFrame(()=>{if(origin?.isConnected)origin.focus({preventScroll:true});});};},[props.returnFocusTo]);
  return <div data-exact-conversation>
    <ExactPage viewKey="conversation" onBack={props.onClose}>
      <h1>Давай разберёмся</h1>
      <div data-assistant-scroll aria-live="polite">
        {props.messages?.map((message, index) => <article className={message.role === 'user' ? 'bubble' : 'exact-answer'} key={`${message.role}:${index}`} aria-label={message.role === 'user' ? 'Вы' : 'Псё'}><p>{message.content}</p></article>)}
        {!props.messages?.length && props.answer && <p className="exact-answer">{props.answer}</p>}
        {props.loading && <p className="status-line" role="status">Псё думает…</p>}
      </div>
      {props.error && <p className="error" role="alert">{props.error}</p>}
      <div className="stack exact-agent-actions">{props.actions}</div>
      {props.suggestions.length>0 && <details><summary>Ещё по теме</summary><div className="stack">{props.suggestions.slice(0,3).map(suggestion=><button type="button" className="secondary" key={suggestion} disabled={props.loading} onClick={()=>props.onAsk(suggestion)}>{suggestion}</button>)}</div></details>}
      <form className="soft composer" data-assistant-composer onSubmit={event => { event.preventDefault(); if (!props.loading && props.question.trim()) props.onAsk(); }}>
        <label className="sr-only" htmlFor="production-assistant-question">Сообщение помощнику</label>
        <textarea id="production-assistant-question" value={props.question} onChange={event => props.onQuestionChange(event.target.value)} placeholder="Напиши ещё…" />
        <div className="tools"><span /><button type="submit" className="icon-button send" disabled={props.loading || !props.question.trim()} aria-label="Отправить"><ExactIcon name="arrow" /></button></div>
      </form>
      <button type="button" className="text-button" onClick={props.onClose}>Вернуться к вводу</button>
    </ExactPage>
  </div>;
}
