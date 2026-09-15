'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { ExactIcon, ExactPage, ExactRow } from '@/components/exact/ExactShell';
import { inflectPetName } from '@/lib/copy';

type Recent = { id: string; question?: string; thread_id?: string; status?: string };
export function ConnectedHome(props: {
  dogName: string; petId?: string; guest: boolean; question: string; loading: boolean;
  recentQuestion?: string; headers: () => Record<string, string>; onQuestion: (text: string) => void;
  onAsk: () => void; onContinue: (run?: Recent) => void; onProfile: () => void; onAll: () => void;
  observationCount: number; onHistory: () => void; onAttach: () => void; onVoice: () => void;
}) {
  const [recent,setRecent]=useState<Recent|null>(null),[readError,setReadError]=useState(false),[revision,setRevision]=useState(0);
  const readRecent=useEffectEvent((signal:AbortSignal)=>fetch(`/api/agent/runs?petId=${encodeURIComponent(props.petId || '')}`,{headers:props.headers(),signal}));
  useEffect(()=>{if(props.guest || !props.petId)return;const controller=new AbortController();readRecent(controller.signal).then(async response=>{if(!response.ok)throw new Error('READ_FAILED');const body=await response.json();if(!controller.signal.aborted){setReadError(false);setRecent(body.enabled && typeof body.latest?.id==='string'?body.latest:null);}}).catch(()=>{if(!controller.signal.aborted)setReadError(true);});return()=>controller.abort();},[props.petId,props.guest,props.recentQuestion,revision]);
  const topic=props.recentQuestion || recent?.question;
  return <ExactPage home viewKey="home"><section className="home" aria-label="Псё — разговор" data-connected-home>
    <h1 data-assistant-heading>Что сегодня<br /><span>обсудим?</span></h1>
    <p className="lead">Про {inflectPetName(props.dogName, 'accs')}. И вашу жизнь вместе.</p>
    <form className="soft composer" onSubmit={event => { event.preventDefault(); if (props.question.trim() && !props.loading) props.onAsk(); }}>
      <label className="sr-only" htmlFor="connected-question">Сообщение помощнику</label>
      <textarea id="connected-question" value={props.question} onChange={event => props.onQuestion(event.target.value)} placeholder="Начни с любой мысли…" spellCheck={false} maxLength={8000} onKeyDown={event=>{if(event.key==='Enter' && !event.shiftKey && !event.nativeEvent.isComposing){event.preventDefault();if(props.question.trim() && !props.loading)props.onAsk();}}} />
      <div className="tools">
        <button type="button" className="icon-button" aria-label="Прикрепить файл" onClick={props.onAttach}><ExactIcon name="plus" /></button>
        <div>
          <button type="button" className="icon-button" aria-label="Голосовой ввод" onClick={props.onVoice}><ExactIcon name="mic" /></button>
          <button type="submit" className="icon-button send" disabled={props.loading} aria-label={props.loading ? 'Псё отвечает' : 'Отправить сообщение'}><ExactIcon name="arrow" /></button>
        </div>
      </div>
    </form>
    {(topic || recent) && <div className="recent"><ExactRow title="Продолжить разговор" detail={topic || 'Последний разговор'} onClick={()=>props.onContinue(props.recentQuestion?undefined:recent??undefined)}/></div>}
    {readError && !topic && <div className="status-line" role="status">Недавний разговор не загрузился.<button type="button" className="text-button" onClick={()=>setRevision(value=>value+1)}>Повторить</button></div>}
    <div className="recent"><ExactRow title={`Записи о ${inflectPetName(props.dogName, 'loct')}`} detail={`Записей в истории: ${props.observationCount}`} onClick={props.onHistory} /></div>
  </section></ExactPage>;
}

export type ToolDestination = 'diary' | 'calendar' | 'health' | 'habits' | 'things' | 'passport' | 'card' | 'library' | 'connections' | 'documents';
export function ConnectedTools({ onOpen }: { onOpen: (destination: ToolDestination) => void }) {
  return <ExactPage viewKey="all"><section data-connected-tools>
    <h1 data-assistant-heading>Всё под рукой</h1>
    <p className="lead">Можно открыть напрямую, без разговора с помощником.</p>
    <div className="list">
      <ExactRow icon="heart" title="Уход" detail="Предстоящие дела и выполнение" destination="calendar" onClick={() => onOpen('calendar')} />
      <ExactRow icon="bag" title="Нужно купить" detail="Записать и не забыть в магазине" destination="things" onClick={() => onOpen('things')} />
      <ExactRow icon="book" title="История" detail="Найти прошлую запись" destination="health" onClick={() => onOpen('health')} />
      <ExactRow icon="save" title="Сохранённое" detail="Места и прогулки" destination="library" onClick={() => onOpen('library')} />
      <ExactRow icon="file" title="Документы" detail="Открыть нужный файл" destination="documents" onClick={() => onOpen('documents')} />
      <ExactRow icon="book" title="Дневник" detail="События дня и наблюдения" destination="diary" onClick={() => onOpen('diary')} />
      <ExactRow icon="clock" title="Привычки" detail="Регулярные занятия" destination="habits" onClick={() => onOpen('habits')} />
      <ExactRow icon="profile" title="Сведения о собаке" detail="Паспорт, характер и здоровье" destination="passport" onClick={() => onOpen('passport')} />
      <ExactRow icon="file" title="Памятка для других" detail="Приватность и ссылка" destination="card" onClick={() => onOpen('card')} />
      <ExactRow icon="gav" title="Знакомства" detail="Ответы и места встреч" destination="connections" onClick={() => onOpen('connections')} />
    </div>
  </section></ExactPage>;
}
