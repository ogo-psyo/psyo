'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { applyLibraryCommand, emptyMapLibrary, type MapLibrary, type SavedPlace } from '@/lib/mapLibrary';
import type { OwnerRouteView } from '@/lib/mapUi';
import type { MeetingPreview } from '@/lib/meetingPlace';
type MapSearchResult = {id:string;title:string;detail?:string;category?:string;point:{lat:number;lng:number}};
import { LiveMap } from '@/components/LiveMap';

type Proposal = { id: string; mine: boolean; preview: MeetingPreview | null };
type Point = { lat: number; lng: number };
export function MeetingPlacePanel({ requestId, petId, routes, headers, center, partnerName }: {
  requestId: string; petId: string; routes: OwnerRouteView[];
  headers: () => Record<string, string>; center?: Point | null; partnerName: string;
}) {
  const draftKey = `pso.gav.meeting-draft.v1:${petId}:${requestId}`;
  const [draft] = useState(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
      if (!value || typeof value.query !== 'string' || typeof value.selection !== 'string' || !['search','map','saved'].includes(value.method)) return null;
      if (value.newPlace) applyLibraryCommand(emptyMapLibrary(), {id:'validate',kind:'savePlace',place:value.newPlace,collectionId:'saved'});
      return value as {query:string;selection:string;method:'search'|'map'|'saved';newPlace:SavedPlace|null;saveId:string|null;attempt:string|null;fingerprint:string};
    } catch { return null; }
  });
  const [library, setLibrary] = useState<MapLibrary | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [composing, setComposing] = useState(false), [method, setMethod] = useState<'search'|'map'|'saved'>(draft?.method || 'search');
  const [query, setQuery] = useState(draft?.query || ''), [results, setResults] = useState<MapSearchResult[]>([]);
  const [searchState, setSearchState] = useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [selection, setSelection] = useState(draft?.selection || ''), [newPlace, setNewPlace] = useState<SavedPlace | null>(draft?.newPlace || null);
  const [preview, setPreview] = useState<MeetingPreview | null>(null), [digest, setDigest] = useState(draft?.fingerprint || '');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const attempt = useRef<string | null>(draft?.attempt || null), saveAttempt = useRef<string | null>(draft?.saveId || null), lock = useRef(false);
  const headersRef = useRef(headers), searchRef = useRef<AbortController | null>(null);
  const live = useRef(true), loadSequence = useRef(0);
  const pickerRef = useRef<HTMLDivElement>(null), previewRef = useRef<HTMLDivElement>(null), triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { headersRef.current = headers; }, [headers]);
  useEffect(() => { live.current = true; return () => { live.current = false; searchRef.current?.abort(); }; }, []);
  useEffect(() => {
    try {
      if (!query && !selection && !newPlace) sessionStorage.removeItem(draftKey);
      else sessionStorage.setItem(draftKey, JSON.stringify({query,selection,newPlace,method,saveId:saveAttempt.current,attempt:attempt.current,fingerprint:digest}));
    } catch { /* Keep the live draft if browser storage is unavailable. */ }
  }, [draftKey, query, selection, newPlace, method, digest]);
  const endpoint = `/api/social/requests/${encodeURIComponent(requestId)}/meeting`;
  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const [lr, pr] = await Promise.all([
        fetch(`/api/map/library?petId=${encodeURIComponent(petId)}`, { headers: headersRef.current(), credentials: 'include' }),
        fetch(endpoint, { headers: headersRef.current(), credentials: 'include' }),
      ]);
      if (!live.current || sequence !== loadSequence.current) return;
      if ([401,403,404].includes(pr.status)) { setUnavailable(true); setProposals([]); setPreview(null); throw Error('unavailable'); }
      if (!lr.ok || !pr.ok) throw Error('load');
      const [l,p] = await Promise.all([lr.json(),pr.json()]);
      if (!live.current || sequence !== loadSequence.current) return;
      setLibrary(l.library); setProposals(p.proposals || []); setLoadError(''); setUnavailable(false);
    } catch { if (live.current && sequence === loadSequence.current) setLoadError('Не удалось обновить места. Повторите загрузку.'); }
    finally { if (live.current && sequence === loadSequence.current) setLoading(false); }
  }, [endpoint, petId]);
  useEffect(() => {
    // load only updates React state after asynchronous I/O (including a rejected fetch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 12000); window.addEventListener('focus', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [load]);
  useEffect(() => {
    if (preview) previewRef.current?.focus();
    else if (composing) pickerRef.current?.focus();
  }, [preview, composing]);
  function choose(place: SavedPlace) { setNewPlace(place); setSelection(''); setError(''); saveAttempt.current = crypto.randomUUID(); }
  async function search() {
    if (!query.trim()) return;
    searchRef.current?.abort(); const controller = new AbortController(); searchRef.current = controller;
    setSearchState('loading'); setResults([]);
    const point = center || library?.places[0]?.point;
    const params = new URLSearchParams({ q: query.trim(), ...(point ? { lat:String(point.lat),lng:String(point.lng) } : {}) });
    try {
      const response = await fetch(`/api/map/search?${params}`, { signal:controller.signal });
      const payload = await response.json(); if (!response.ok) throw Error();
      if (!controller.signal.aborted) { setResults(Array.isArray(payload.results) ? payload.results : []); setSearchState('ready'); }
    } catch { if (!controller.signal.aborted) setSearchState('error'); }
  }
  async function makePreview() {
    if (lock.current || (!selection && !newPlace) || unavailable) return;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      let source = selection;
      if (newPlace) {
        const response = await fetch(`/api/map/library`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json',...headersRef.current()}, body:JSON.stringify({petId,command:{id:saveAttempt.current,kind:'savePlace',collectionId:'saved',place:newPlace}}) });
        if (!response.ok) throw Error('save');
        const payload = await response.json();
        const saved = (payload.library as MapLibrary).places.find(p => p.source.provider === newPlace.source.provider && p.source.id === newPlace.source.id);
        if (!saved) throw Error('save');
        source = `place:${saved.id}`; setLibrary(payload.library); setSelection(source); setNewPlace(null);
      }
      const [kind,...ids] = source.split(':');
      const response = await fetch(endpoint, { method:'POST',credentials:'include',headers:{'Content-Type':'application/json',...headersRef.current()},body:JSON.stringify({action:'preview',kind,sourceId:ids.join(':')}) });
      if (!response.ok) throw Error('preview');
      const payload = await response.json(); if (!live.current) return;
      setPreview(payload.preview); if (!attempt.current || digest !== payload.fingerprint) attempt.current = crypto.randomUUID(); setDigest(payload.fingerprint);
    } catch (e) { if (live.current) setError(e instanceof Error && e.message === 'save' ? 'Место не сохранилось. Попробуйте ещё раз — ваш выбор остался.' : 'Это место или маршрут сейчас нельзя предложить. Выберите другое. У короткого маршрута может не быть участка вне личных начала и конца.'); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  }
  async function send() {
    if (lock.current || !preview || !attempt.current || unavailable) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(endpoint,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',...headersRef.current()},body:JSON.stringify({action:'send',id:attempt.current,kind:preview.kind,sourceId:preview.sourceId,fingerprint:digest,confirmed:true})});
      if (!response.ok) throw Error(response.status === 409 ? 'changed' : 'send');
      if (!live.current) return;
      setNotice(`Место предложено. Осталось обсудить встречу с владельцем ${partnerName}.`);setPreview(null);setComposing(false);attempt.current=null;setQuery('');setSelection('');setNewPlace(null);setDigest('');
      await load(); triggerRef.current?.focus();
    } catch (e) { if (live.current) {
      setError(e instanceof Error && e.message === 'changed' ? 'Место изменилось. Вернитесь к выбору и проверьте его заново.' : 'Отправка не подтверждена. Повторите — второе предложение не появится.');
    } } finally { lock.current=false;if(live.current)setBusy(false); }
  }
  function showMap(value: MeetingPreview) { return <div className="meeting-preview-map"><LiveMap
    features={value.kind==='route'?[{id:'preview',type:'route',title:value.title,path:{type:'LineString',coordinates:value.points},visibility:'private'}]:value.accuracyMeters?[{id:'preview',type:'point',title:value.title,lat:value.points[0][1],lng:value.points[0][0],radiusMeters:value.accuracyMeters,pointKind:'area',visibility:'private'}]:[]}
    searchPoint={value.kind==='place'&&!value.accuracyMeters?{lng:value.points[0][0],lat:value.points[0][1],title:value.title}:null}
    focusPoint={{lng:value.points[0][0],lat:value.points[0][1],token:1}} accessibleLabel="Место или фрагмент маршрута для встречи"/>
  </div>; }
  function cancel() { setComposing(false);setPreview(null);setError('');triggerRef.current?.focus(); }
  if (unavailable) return <section className="meeting-place-panel"><h3>Предложения больше недоступны</h3><p>Знакомство могло завершиться. Вернитесь к откликам и обновите его состояние.</p></section>;
  return <section className="meeting-place-panel" aria-label="Место встречи">
    <h3>Где встретимся?</h3>
    <p className="gav-muted">Место видно только вам двоим. Предложение ещё не означает, что встреча согласована.</p>
    {loading && <p role="status">Загружаю места и предложения…</p>}
    {loadError && <p role="alert">{loadError}<button type="button" onClick={()=>{setLoading(true);void load();}} disabled={loading}>Повторить загрузку</button></p>}
    {notice && <p role="status">{notice}</p>}
    {!composing && <>
      {proposals.map(p=><article className="gav-meeting-proposal" key={p.id}><span>{p.mine?'Вы предложили':`${partnerName}: предложение места`}</span>{p.preview?<><h4>{p.preview.title}</h4><p>{p.preview.detail}</p>{showMap(p.preview)}</>:<p>Место изменилось или больше недоступно. Предложите другое или обсудите его в чате.</p>}</article>)}
      {!loading&&!loadError&&!proposals.length&&<p>Пока без места. Можно найти новое или выбрать из сохранённых.</p>}
    </>}
    <button ref={triggerRef} className="woof-primary" type="button" hidden={composing} onClick={()=>{setComposing(true);setError('');setNotice('');}}>{query || selection || newPlace ? 'Продолжить выбор места' : proposals.length?'Предложить другое место':'Предложить место'}</button>
    {composing && <div className="gav-meeting-editor" ref={pickerRef} tabIndex={-1}>
      <div className="gav-step-heading"><h4>{preview?'Проверьте перед отправкой':'Выберите место'}</h4><button type="button" onClick={cancel} disabled={busy}>Отмена</button></div>
      {preview ? <div ref={previewRef} tabIndex={-1}><h4>{preview.title}</h4><p>{preview.detail}</p>{showMap(preview)}<p>{preview.kind==='place'?'Другой участник увидит эту точку. Личные заметки не передаются.':'Показываем только участок без личных начала и конца маршрута.'}</p><button className="woof-primary" type="button" disabled={busy} onClick={send}>{busy?'Отправляю…':'Предложить это место'}</button><button type="button" disabled={busy} onClick={()=>{setPreview(null);setError('');}}>Изменить место</button></div>
      : <>
        <div className="gav-picker-methods" aria-label="Способ выбора места">{(['search','map','saved'] as const).map(m=><button type="button" key={m} aria-pressed={method===m} onClick={()=>{setMethod(m);setNewPlace(null);setSelection('');setError('');}}>{({search:'Найти',map:'На карте',saved:'Сохранённое'})[m]}</button>)}</div>
        {method==='search'&&<form onSubmit={e=>{e.preventDefault();void search();}}><label htmlFor="gav-meeting-query">Место или адрес</label><div className="gav-search-row"><input id="gav-meeting-query" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Например, парк и город"/><button type="submit" disabled={!query.trim()||searchState==='loading'}>Найти место</button></div>
          {searchState==='loading'&&<p role="status">Ищу места…</p>}{searchState==='error'&&<p role="alert">Поиск не ответил. Название сохранилось — попробуйте ещё раз.</p>}{searchState==='ready'&&!results.length&&<p role="status">Не нашли. Уточните город или выберите точку на карте.</p>}
          {results.map(r=><button className="gav-place-choice" type="button" key={r.id} aria-pressed={newPlace?.source.id===r.id} onClick={()=>choose({id:crypto.randomUUID(),title:r.title,detail:r.detail||'',category:r.category||'место',point:r.point,source:{provider:'osm',id:r.id},note:''})}>{r.title}{r.detail&&<small>{r.detail}</small>}</button>)}
        </form>}
        {method==='map'&&<><p>Нажмите на место встречи. При неточном попадании можно передвинуть карту и выбрать снова.</p><div className="meeting-preview-map"><LiveMap drawMode="point" picked={newPlace?.point||null} onPick={point=>choose({id:crypto.randomUUID(),title:'Место встречи',detail:'Точка, выбранная на карте',category:'место',point,source:{provider:'user',id:crypto.randomUUID()},note:''})} focusPoint={{...(center||library?.places[0]?.point||{lat:55.7512,lng:37.6184}),token:1}} accessibleLabel="Выбор места встречи на карте"/></div>{newPlace&&<label>Название места<input value={newPlace.title} onChange={e=>setNewPlace({...newPlace,title:e.target.value})}/></label>}<p className="gav-muted">Для выбора без точного нажатия используйте «Найти».</p></>}
        {method==='saved'&&<>{!library?.places.length&&!routes.length?<p>Здесь пока пусто. Найдите место или выберите точку на карте — выходить из знакомства не нужно.</p>:<label>Место или маршрут<select value={selection} onChange={e=>{setSelection(e.target.value);setNewPlace(null);setError('');}}><option value="">Выберите сохранённое</option>{library?.places.filter(p=>!p.unavailable).map(p=><option key={p.id} value={`place:${p.id}`}>{p.title}</option>)}{routes.map(r=><option key={r.id} value={`route:${r.id}`}>Маршрут · {r.title}</option>)}</select></label>}</>}
        {newPlace&&<p className="gav-chosen-place">Выбрано: <b>{newPlace.title}</b>. Место сохранится в ваших местах; участник увидит его только после отправки.</p>}
        {(selection||newPlace)&&<button className="woof-primary" type="button" disabled={busy||!!newPlace&&!newPlace.title.trim()} onClick={makePreview}>{busy?'Проверяю…':newPlace?'Сохранить и проверить':'Проверить место'}</button>}
      </>}
      {error&&<p role="alert">{error}</p>}
    </div>}
  </section>;
}
