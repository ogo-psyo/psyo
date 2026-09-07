'use client';
import { MapPin, ArrowClockwise } from '@phosphor-icons/react';
import { placeCategories, type DiscoveredPlace, type PlaceCategory } from '@/lib/placeDiscovery';
import type { usePlaceDiscovery } from './usePlaceDiscovery';

export function PlaceDiscoveryPanel({ discovery, onChoose, savedIds }: {
    discovery: ReturnType<typeof usePlaceDiscovery>; onChoose: (place: DiscoveredPlace, trigger: HTMLElement) => void; savedIds: Set<string>;
}) {
    const { data, state, category, load, moved } = discovery;
    return <section className="map-place-discovery" aria-labelledby="place-discovery-heading">
        <header><h2 id="place-discovery-heading">Места на карте</h2><p>В области, видимой на карте</p></header>
        <div className="place-category-filters"><label>Тип места<select aria-label="Тип места" disabled={!discovery.requestedBounds} value={category} onChange={e=>load(e.target.value as PlaceCategory)}>{Object.entries(placeCategories).map(([key,title])=><option key={key} value={key}>{title}</option>)}</select></label></div>
        {moved && <div className="place-area-change"><span>Область карты изменилась</span><button type="button" onClick={() => load()}>Показать места в этой области</button></div>}
        <p className="place-discovery-status" role="status" aria-live="polite">{state === 'idle' ? 'Загружаем область карты…' : state === 'loading' ? 'Загружаем места…' : state === 'ready' ? data?.results.length ? `Показано мест: ${data.results.length}${moved ? ' · в прежней области' : ''}` : 'В этой области нет мест выбранного типа в нашей базе.' : state === 'coverage' ? 'Для этой области список мест ещё не подключён. Поиск по названию и сохранённые места остаются доступны.' : state === 'area' ? 'Приблизьте карту, чтобы посмотреть места в меньшей области.' : state === 'quota' ? 'Список мест временно занят. Повторите чуть позже.' : 'Не удалось загрузить места. Сохранённые данные не изменились.'}</p>
        {['error','quota'].includes(state) && <button type="button" className="place-retry" onClick={() => load()}><ArrowClockwise aria-hidden="true"/>Повторить загрузку</button>}
        {state === 'ready' && !data?.results.length && <p>Измените тип места или переместите карту и обновите область.</p>}
        {state === 'ready' && data && <>
            <ol className="place-discovery-list">{data.results.map(place => <li key={place.id}><button type="button" data-place-id={place.id} onClick={event => onChoose(place,event.currentTarget)}><MapPin aria-hidden="true"/><span><b>{place.title}</b><span>{place.category}{place.detail ? ` · ${place.detail}` : ''}</span>{savedIds.has(place.id) && <small>Сохранено</small>}</span></button></li>)}</ol>
            {data.truncated && <p>Показаны первые {data.results.length} мест из {data.total} в нашей базе. Приблизьте карту или уточните тип.</p>}
            <p className="place-data-source">© OpenStreetMap contributors · данные от {new Date(data.updatedAt).toLocaleDateString('ru-RU')}<br/><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Источник и лицензия ODbL</a></p>
        </>}
    </section>;
}
