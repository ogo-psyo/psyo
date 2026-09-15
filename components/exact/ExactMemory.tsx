'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ExactIcon, ExactPage } from './ExactShell';

type Memory = { id: string; memory_key: string; content: string; updated_at?: string; source_run_id?: string | null };
export function ExactMemory({ petId, guest, headers, onBack, draftsStore }: { draftsStore: Map<string,string>; petId?: string; guest: boolean; headers: () => Record<string, string>; onBack: () => void }) {
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState(()=>draftsStore.get('$new-key') || '');
  const [newContent, setNewContent] = useState(()=>draftsStore.get('$new-content') || '');
  async function create() {
    if (pending.current || guest || !petId) return;
    const key=newKey.trim(),content=newContent.trim();
    if (!key || !content) {setError('Напиши тему и то, что нужно запомнить.');return;}
    if(items.some(item=>item.memory_key===key)){setError('Такая тема уже есть. Измени существующее предпочтение.');return;}
    pending.current=true;setBusy('$new');setError('');
    try {const response=await fetch('/api/agent/memory',{method:'POST',headers:{'Content-Type':'application/json',...headers()},body:JSON.stringify({petId,key,content})});const data=await response.json();
      if(!response.ok || data.memory?.memory_key!==key || typeof data.memory?.id!=='string' || typeof data.memory?.content!=='string')throw new Error('NOT_CONFIRMED');
      if(!alive.current)return;setItems(current=>[data.memory,...current.filter(item=>item.memory_key!==key)]);draftsStore.delete('$new-key');draftsStore.delete('$new-content');setNewKey('');setNewContent('');setCreating(false);
    }catch {if(alive.current)setError('Сохранение не подтверждено. Текст остался здесь — повтори попытку.');}
    finally {pending.current=false;if(alive.current)setBusy('');}
  }
  const [items, setItems] = useState<Memory[]>([]), [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(draftsStore));
  const [loading, setLoading] = useState(!guest && Boolean(petId)), [error, setError] = useState(''), [revision, setRevision] = useState(0), [busy, setBusy] = useState('');
  const alive = useRef(true), pending = useRef(false);
  const read = useEffectEvent((signal: AbortSignal) => fetch(`/api/agent/memory?petId=${encodeURIComponent(petId || '')}`, { headers: headers(), signal }));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (guest || !petId) return;
    read(controller.signal).then(async response => {
      if (!response.ok) throw new Error('READ_FAILED'); const data = await response.json();
      if (!Array.isArray(data.memories)) throw new Error('INVALID_RESPONSE');
      if (!controller.signal.aborted) setItems(data.memories.filter((item: Memory) => typeof item.id === 'string' && typeof item.memory_key === 'string' && typeof item.content === 'string'));
    }).catch(() => { if (!controller.signal.aborted) setError('Не удалось загрузить память. Попробуй ещё раз.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [petId, guest, revision]);
  async function write(item: Memory, remove = false) {
    if (pending.current || guest || !petId) return;
    const content = (drafts[item.id] ?? item.content).trim();
    if (!remove && !content) { setError('Для удаления используй «Забыть».'); return; }
    pending.current = true; setBusy(item.id); setError('');
    try {
      const response = await fetch('/api/agent/memory', { method: remove ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify({ petId, key: item.memory_key, ...(!remove ? { content } : {}) }) });
      const data = await response.json(); if (!response.ok || remove && data.forgotten !== true || !remove && (data.memory?.memory_key !== item.memory_key || typeof data.memory?.content !== 'string')) throw new Error('NOT_CONFIRMED');
      if (!alive.current) return;
      setItems(current => remove ? current.filter(value => value.id !== item.id) : current.map(value => value.id === item.id ? data.memory : value));
      draftsStore.delete(item.id);
      setDrafts(current => { const next = { ...current }; delete next[item.id]; return next; });
    } catch { if (alive.current) setError('Изменение не подтверждено. Текст остался здесь — повтори попытку.'); }
    finally { pending.current = false; if (alive.current) setBusy(''); }
  }
  return <ExactPage viewKey="memory" onBack={onBack}>
    <h1>Что помнит Псё</h1><p className="lead">Можно поправить или убрать. Не нужно настраивать перед каждым вопросом.</p>
    {loading && <p role="status">Загружаю память…</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {!loading && error && !items.length && <button type="button" className="secondary" onClick={() => { setLoading(true); setError(''); setRevision(value => value + 1); }}>Повторить</button>}
    {!loading && !error && !items.length && <p className="empty">{guest ? 'Память помощника доступна в личном профиле Telegram.' : 'Дополнительных предпочтений пока нет. Основные сведения остаются в профиле.'}</p>}
    {!guest && petId && (creating ? <form onSubmit={event=>{event.preventDefault();void create();}}><fieldset disabled={Boolean(busy)}>
      <div className="field"><label htmlFor="exact-memory-topic">О чём</label><input id="exact-memory-topic" value={newKey} maxLength={120} onChange={event=>{setNewKey(event.target.value);draftsStore.set('$new-key',event.target.value);}} placeholder="Например, о питании"/></div>
      <div className="field"><label htmlFor="exact-memory-new">Что запомнить</label><textarea id="exact-memory-new" value={newContent} maxLength={2000} onChange={event=>{setNewContent(event.target.value);draftsStore.set('$new-content',event.target.value);}}/></div>
      <div className="row-actions"><button className="primary" type="submit">{busy==='$new'?'Сохраняю…':'Сохранить'}</button><button className="secondary" type="button" onClick={()=>setCreating(false)}>Назад</button></div>
    </fieldset></form> : <button type="button" className="text-button" onClick={()=>setCreating(true)}><ExactIcon name="plus"/>Добавить предпочтение</button>)}
    {items.map(item => <form key={item.id} onSubmit={event => { event.preventDefault(); void write(item); }}>
      <p className="eyebrow">{item.source_run_id ? 'Предпочтение · из разговора' : 'Предпочтение · сообщил владелец'}</p>
      <label htmlFor={`memory-${item.id}`}>{/walk|прогул/i.test(item.memory_key) ? 'О прогулках' : /^[А-Яа-яЁё][А-Яа-яЁё .-]{0,60}$/.test(item.memory_key) ? item.memory_key : 'Предпочтение'}</label><textarea id={`memory-${item.id}`} maxLength={2000} value={drafts[item.id] ?? item.content} onChange={event => { draftsStore.set(item.id,event.target.value); setDrafts(current => ({ ...current, [item.id]: event.target.value })); }} />
      <div className="row-actions"><button type="submit" className="primary" disabled={Boolean(busy)}>{busy === item.id ? 'Сохраняю…' : 'Сохранить'}</button><button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => void write(item, true)}>Забыть</button></div>
    </form>)}
  </ExactPage>;
}
