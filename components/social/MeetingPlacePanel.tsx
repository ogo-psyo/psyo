'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MapLibrary } from '@/lib/mapLibrary';
import type { OwnerRouteView } from '@/lib/mapUi';
import type { MeetingPreview } from '@/lib/meetingPlace';
import { LiveMap } from '@/components/LiveMap';
type Proposal = {
    id: string;
    mine: boolean;
    status: string;
    preview: MeetingPreview | null;
};
export function MeetingPlacePanel({ requestId, petId, routes, headers, onClose }: {
    requestId: string;
    petId: string;
    routes: OwnerRouteView[];
    headers: () => Record<string, string>;
    onClose: () => void;
}) {
    const [library, setLibrary] = useState<MapLibrary | null>(null), [proposals, setProposals] = useState<Proposal[]>([]);
    const [selection, setSelection] = useState(''), [preview, setPreview] = useState<MeetingPreview | null>(null), [digest, setDigest] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
    const attempt = useRef<string | null>(null), lock = useRef(false), headersRef = useRef(headers);
    useLayoutEffect(() => { headersRef.current = headers; }, [headers]);
    const endpoint = `/api/social/requests/${encodeURIComponent(requestId)}/meeting`;
    const load = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError('');
        const [lr, pr] = await Promise.all([fetch(`/api/map/library?petId=${encodeURIComponent(petId)}`, { headers: headersRef.current(), credentials: 'include', signal }), fetch(endpoint, { headers: headersRef.current(), credentials: 'include', signal })]);
        if (!lr.ok || !pr.ok)
            throw Error('load');
        const [l, p] = await Promise.all([lr.json(), pr.json()]);
        if (signal?.aborted)
            return;
        setLibrary(l.library);
        setProposals(p.proposals || []);
        setLoading(false);
    }, [petId, endpoint]);
    useEffect(() => { const controller = new AbortController(); void load(controller.signal).catch(() => { if (!controller.signal.aborted)
        setError('Не удалось загрузить места и договорённости. Попробуйте открыть заново.'); }); return () => controller.abort(); }, [load]);
    async function makePreview() {
        if (lock.current || !selection)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        const [kind, ...ids] = selection.split(':');
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headersRef.current() }, credentials: 'include', body: JSON.stringify({ action: 'preview', kind, sourceId: ids.join(':') }) });
            const payload = await response.json();
            if (!response.ok)
                throw Error();
            setPreview(payload.preview);
            setDigest(payload.fingerprint);
            attempt.current = crypto.randomUUID();
        }
        catch {
            setError('Этот объект нельзя предложить сейчас. У маршрута может не быть фрагмента вне частных начала и конца. Выберите другое место или маршрут.');
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function send() {
        if (lock.current || !preview || !attempt.current)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headersRef.current() }, credentials: 'include', body: JSON.stringify({ action: 'send', id: attempt.current, kind: preview.kind, sourceId: preview.sourceId, fingerprint: digest, confirmed: true }) });
            if (!response.ok)
                throw Error();
            setNotice('Предложение отправлено участнику знакомства');
            setPreview(null);
            attempt.current = null;
            await load().catch(() => setError('Предложение отправлено, но список не обновился. Откройте его снова.'));
        }
        catch {
            setError('Отправка не подтверждена. Повтор не создаст второе предложение. Если объект изменился, проверьте его заново.');
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    function previewMap(value: MeetingPreview) { return <div className="meeting-preview-map"><LiveMap features={value.kind === 'route' ? [{ id: 'preview', type: 'route', title: value.title, path: { type: 'LineString', coordinates: value.points }, visibility: 'private' }] : value.accuracyMeters ? [{ id: 'preview', type: 'point', title: value.title, lat: value.points[0][1], lng: value.points[0][0], radiusMeters: value.accuracyMeters, pointKind: 'area', visibility: 'private' }] : []} searchPoint={value.kind === 'place' && !value.accuracyMeters ? { lng: value.points[0][0], lat: value.points[0][1], title: value.title } : null} focusPoint={{ lng: value.points[0][0], lat: value.points[0][1], token: 1 }} accessibleLabel="Место или фрагмент маршрута для встречи"/></div>; }
    return <section className="meeting-place-panel" aria-label="Место встречи"><header><h3>Место встречи</h3><button type="button" onClick={onClose}>К откликам</button></header>
  <p>Предложение видно только участнику этого знакомства. Личные заметки не передаются; видимость исходной подборки не меняется.</p>
  {loading && !error && <p role="status">Загружаю места и предложения…</p>}
  <label>Выбрать место или маршрут<select aria-label="Выбрать место или маршрут" value={selection} onChange={e => { setSelection(e.target.value); setPreview(null); }}><option value="">Выберите сохранённое</option>{library?.places.map(p => <option key={p.id} value={`place:${p.id}`}>{p.title}</option>)}{routes.map(r => <option key={r.id} value={`route:${r.id}`}>Маршрут · {r.title}</option>)}</select></label>
  <button type="button" disabled={!selection || busy} onClick={makePreview}>Проверить перед отправкой</button>
  {preview && <article><h4>Участник увидит: {preview.title}</h4><p>{preview.detail}</p>{previewMap(preview)}<p>{preview.kind === 'place' ? 'Будет передана эта точка места. Убедитесь, что её можно показать участнику.' : 'Начало и конец исключены; на карте — только передаваемый фрагмент.'}</p><button type="button" disabled={busy} onClick={send}>{busy ? 'Отправляю…' : 'Предложить это место'}</button><button type="button" disabled={busy} onClick={() => setPreview(null)}>Отмена</button></article>}
  {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}<button type="button" disabled={busy} onClick={() => void load().catch(() => setError("Не удалось обновить. Сохранённые предложения не удалены."))}>Обновить предложения</button></p>}
  <h4>Предложения</h4>{!proposals.length && library && <p>Место пока не предложено.</p>}
  {proposals.map(p => <article key={p.id}><b>{p.mine ? 'Вы предложили' : 'Вам предложили'}</b>{p.preview ? <><h4>{p.preview.title}</h4><p>{p.preview.detail}</p><details><summary>Открыть на карте</summary>{previewMap(p.preview)}</details></> : <p>Объект изменён или больше недоступен. Попросите новое предложение.</p>}</article>)}
 </section>;
}
