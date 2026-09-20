'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import Image from 'next/image';
import { ExactPage } from './ExactShell';

type Memory = { id: string; memory_key: string; content: string; updated_at?: string; source_run_id?: string | null };
type Props = { draftsStore: Map<string,string>; petId?: string; guest: boolean; headers: () => Record<string, string>; onBack: () => void; onChat: () => void; chatOpen: boolean };
export function ExactMemory({ petId, guest, headers, onBack, onChat, chatOpen, draftsStore }: Props) {
  const [items, setItems] = useState<Memory[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(draftsStore));
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(!guest && Boolean(petId));
  const [readError, setReadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState('');
  const alive = useRef(true), pending = useRef(false);
  const read = useEffectEvent((signal: AbortSignal) => fetch(`/api/agent/memory?petId=${encodeURIComponent(petId || '')}`, { headers: headers(), signal }));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (guest || !petId || chatOpen) return;
    read(controller.signal).then(async response => {
      if (!response.ok) throw new Error('READ_FAILED');
      const data = await response.json();
      if (!Array.isArray(data.memories)) throw new Error('INVALID_RESPONSE');
      if (!controller.signal.aborted) {
        setItems(data.memories.filter((item: Memory) => typeof item.id === 'string' && typeof item.memory_key === 'string' && typeof item.content === 'string'));
        setReadError('');
      }
    }).catch(() => { if (!controller.signal.aborted) setReadError('Не удалось загрузить записи. Попробуй ещё раз.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [petId, guest, chatOpen, revision]);
  function clearDraft(id: string) {
    draftsStore.delete(id);
    setDrafts(current => { const next = { ...current }; delete next[id]; return next; });
  }
  async function write(item: Memory, remove = false) {
    if (pending.current || guest || !petId) return;
    const content = (drafts[item.id] ?? item.content).trim();
    if (!remove && !content) { setError('Напиши, что учитывать, или отмени изменение. Убрать запись можно кнопкой «Забыть».'); return; }
    pending.current = true; setBusy(item.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/agent/memory', { method: remove ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify({ petId, key: item.memory_key, ...(!remove ? { content } : {}) }) });
      const data = await response.json();
      if (!response.ok || remove && data.forgotten !== true || !remove && (data.memory?.id !== item.id || data.memory?.memory_key !== item.memory_key || typeof data.memory?.content !== 'string')) throw new Error('NOT_CONFIRMED');
      if (!alive.current) return;
      setItems(current => remove ? current.filter(value => value.id !== item.id) : current.map(value => value.id === item.id ? data.memory : value));
      clearDraft(item.id); setEditing(null); setNotice(remove ? 'Запись убрана из памяти помощника. Профиль и наблюдения не изменились.' : 'Изменения сохранены.');
    } catch { if (alive.current) setError(remove ? 'Не удалось убрать запись. Она осталась здесь — попробуй ещё раз.' : 'Сохранение не подтверждено. Текст остался здесь — повтори попытку.'); }
    finally { pending.current = false; if (alive.current) setBusy(''); }
  }
  const available = !guest && Boolean(petId);
  const empty = available && !loading && !readError && !items.length;
  return <ExactPage viewKey="memory" onBack={onBack} active={!chatOpen}>
    <div className="assistant-memory">
      {(empty || items.length > 0 || !available) && <Image className={`memory-illustration${items.length ? ' memory-illustration-small' : ''}`} src="/illustrations/assistant-memory.webp" alt="" width={768} height={512} sizes="190px" />}
      <h1>Память помощника</h1>
      {loading && <p role="status">Загружаю записи…</p>}
      {readError && <div className="memory-load-error"><p className="error" role="alert">{readError}</p><button type="button" className="secondary" onClick={() => { setLoading(true); setReadError(''); setRevision(value => value + 1); }}>Повторить</button></div>}
      {!available && <p className="lead">Память помощника доступна при входе через Telegram. Сведения о собаке остаются в профиле.</p>}
      {empty && <div className="memory-welcome">
        <p className="lead">Здесь будет то, что ты попросишь Псё запомнить — чтобы не повторять это в следующих разговорах.</p>
        <div className="memory-example"><p>Например, напиши в чате:</p><blockquote>«Запомни: мы любим гулять в тихих местах»</blockquote></div>
        <button type="button" className="primary memory-chat" onClick={onChat}>Перейти в чат</button>
        <p className="memory-caption">Сведения о собаке уже есть в профиле. Заполнять ещё одну анкету не нужно.</p>
      </div>}
      {items.length > 0 && <p className="lead">Это Псё может учитывать в разговорах. Если что-то изменилось, поправь запись или попроси забыть её.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="memory-notice" role="status">{notice}</p>}
      <div className="memory-list">{items.map(item => <article className="memory-item" key={item.id}>
        {editing === item.id ? <form onSubmit={event => { event.preventDefault(); void write(item); }}><fieldset disabled={Boolean(busy)}>
          <label htmlFor={`memory-${item.id}`}>Что учитывать</label>
          <textarea id={`memory-${item.id}`} autoFocus rows={3} maxLength={2000} value={drafts[item.id] ?? item.content} onChange={event => { draftsStore.set(item.id,event.target.value); setDrafts(current => ({ ...current, [item.id]: event.target.value })); }} />
          <div className="row-actions"><button type="submit" className="primary">{busy === item.id ? 'Сохраняю…' : 'Сохранить'}</button><button type="button" className="secondary" onClick={() => { clearDraft(item.id); setEditing(null); setError(''); }}>Отмена</button></div>
        </fieldset></form> : <>
          <p className="memory-content">{item.content}</p>
          <p className="memory-source">{item.source_run_id ? 'Из разговора с Псё' : 'Добавлено тобой'}</p>
          <div className="row-actions"><button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => { setEditing(item.id); setError(''); setNotice(''); }}>Изменить</button><button type="button" className="text-button" disabled={Boolean(busy)} onClick={() => void write(item, true)}>{busy === item.id ? 'Убираю…' : 'Забыть'}</button></div>
        </>}
      </article>)}</div>
      {items.length > 0 && <button type="button" className="secondary memory-chat" disabled={Boolean(busy)} onClick={onChat}>Перейти в чат</button>}
    </div>
  </ExactPage>;
}
