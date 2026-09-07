'use client';
import { useRef, useState } from 'react';
import { collectionPlaces, type SavedPlace } from '@/lib/mapLibrary';
import type { MapLibraryStore } from './useMapLibrary';
export function MapLibraryPanel({ store, onChoose, onPlan, canPlan, collectionId, onCollectionChange, plannedPlaceIds, hasPlan, placesVisible }: {
    store: MapLibraryStore;
    onChoose: (place: SavedPlace, trigger?: HTMLElement) => void;
    onPlan: (places: SavedPlace[]) => void;
    canPlan: boolean;
    collectionId: string;
    onCollectionChange: (id: string) => void;
    plannedPlaceIds: Set<string>;
    hasPlan: boolean;
    placesVisible: boolean;
}) {
    const createAttempt = useRef<{
        title: string;
        id: string;
    } | null>(null);

    const [title, setTitle] = useState('');
    const [managing,setManaging]=useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [editingPlace, setEditingPlace] = useState<string | null>(null), [note, setNote] = useState('');
    const [undo, setUndo] = useState<{
        collectionId: string;
        placeId: string;
    } | null>(null);
    const { library, mutate, busy, state, error } = store;
    const selectedAreas=library.places.filter(p=>selected.includes(p.id)&&p.accuracyMeters);
    const collection = library.collections.find(c => c.id === collectionId) || library.collections[0];
    const places = (collection?.placeIds || []).flatMap(id => { const p = library.places.find(p => p.id === id); return p ? [p] : []; });
    async function addCollection() { if (!title.trim())
        return; if (createAttempt.current?.title !== title)
        createAttempt.current = { title, id: crypto.randomUUID() }; const id = createAttempt.current.id; const next = await mutate({ id, kind: 'createCollection', collectionId: id, title }); if (next) {
        onCollectionChange(id);
        createAttempt.current = null;
        setTitle('');
        setSelected([]);
    } }
    return <section className="map-library" aria-label="Подборки мест"><h2>Подборки</h2>
  {state === 'loading' ? <p role="status">Загружаю подборки…</p> : state === 'error' ? <p role="alert">{error}<button type="button" onClick={() => store.reload()}>Повторить</button></p> : <>
  <label><span className="sr-only">Открыть подборку</span><select aria-label="Открыть подборку" value={collection?.id} onChange={e => { onCollectionChange(e.target.value); setSelected([]); setUndo(null); }}>{library.collections.map(c => <option key={c.id} value={c.id}>{c.title} · {c.placeIds.length}</option>)}</select></label>
  <p className="map-collection-caption">{places.length ? `${places.length} мест · ${placesVisible?"показаны на карте":"слой мест выключен"}` : "В подборке пока нет мест. Найдите место на карте или через поиск и сохраните его сюда."}</p>
  <ol className="map-library-places">{places.map((place, index) => <li key={place.id}>
   <label><input type="checkbox" checked={selected.includes(place.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, place.id] : ids.filter(id => id !== place.id))}/><span className="sr-only">Выбрать {place.title}</span></label>
   <button type="button" onClick={event => onChoose(place,event.currentTarget)}><b>{place.title}</b><span>{place.detail}</span></button>
   {place.note && <p>{place.note}</p>}
   <button type="button" className="collection-add-place" disabled={!canPlan || busy || plannedPlaceIds.has(place.id) || !!place.accuracyMeters} onClick={()=>onPlan([place])}>{plannedPlaceIds.has(place.id)?'В прогулке':'В прогулку'}</button>
   {place.accuracyMeters&&<p>Примерная область — откройте место, чтобы выбрать точную остановку.</p>}
   <div className="map-place-management" hidden={!managing}>
   {editingPlace === place.id ? <div><label>Моя заметка<textarea value={note} maxLength={4000} onChange={e => setNote(e.target.value)}/></label><button type="button" disabled={busy} onClick={async () => { if (await mutate({ id: crypto.randomUUID(), kind: 'note', placeId: place.id, note }))
                setEditingPlace(null); }}>Сохранить заметку</button><button type="button" onClick={() => setEditingPlace(null)}>Отмена</button></div> : <button type="button" onClick={() => { setEditingPlace(place.id); setNote(place.note); }}>Изменить заметку</button>}
   <div className="map-library-actions"><button type="button" disabled={busy || index === 0} onClick={() => { const order = [...collection.placeIds]; [order[index - 1], order[index]] = [order[index], order[index - 1]]; void mutate({ id: crypto.randomUUID(), kind: 'reorder', collectionId: collection.id, placeIds: order }); }}>Выше</button><button type="button" disabled={busy || index === places.length - 1} onClick={() => { const order = [...collection.placeIds]; [order[index + 1], order[index]] = [order[index], order[index + 1]]; void mutate({ id: crypto.randomUUID(), kind: 'reorder', collectionId: collection.id, placeIds: order }); }}>Ниже</button><button type="button" disabled={busy} onClick={async () => { if (await mutate({ id: crypto.randomUUID(), kind: 'membership', collectionId: collection.id, placeId: place.id, present: false })) {
                setUndo({ collectionId: collection.id, placeId: place.id });
                setSelected(ids => ids.filter(id => id !== place.id));
            } }}>Убрать из подборки</button></div>
   <label>Добавить также в<select aria-label="Добавить также в" value="" disabled={busy} onChange={e => { if (e.target.value)
                void mutate({ id: crypto.randomUUID(), kind: 'membership', collectionId: e.target.value, placeId: place.id, present: true }); }}><option value="">Выбрать подборку</option>{library.collections.filter(c => !c.placeIds.includes(place.id)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
   </div>
  </li>)}</ol>
  {selected.length > 0 && <button type="button" disabled={!canPlan || busy || selectedAreas.length>0} onClick={() => {onPlan(collectionPlaces(library, collection.id, selected));setSelected([]);}}>{hasPlan?'Добавить в прогулку':'Собрать прогулку'} · {selected.length}</button>}
  {selectedAreas.length>0&&<p>Среди выбранного есть примерная область. Откройте её карточку и выберите точную остановку на карте.</p>}
  {!canPlan && selected.length > 0 && <p>Сейчас открыта запись прогулки. Места можно просматривать и сохранять; добавление остановок доступно при планировании.</p>}
  <button type="button" aria-pressed={managing} onClick={()=>setManaging(v=>!v)}>{managing?"Закончить управление":"Управлять местами"}</button>
  <details className="map-collection-management"><summary>Управлять подборками</summary>
  <div className="map-library-new"><label>Название подборки<input value={title} maxLength={120} onChange={e => setTitle(e.target.value)} placeholder="Например, парки рядом"/></label><button type="button" disabled={busy || !title.trim()} onClick={addCollection}>Создать</button><button type="button" disabled={busy || !title.trim()} onClick={async () => { if (await mutate({ id: crypto.randomUUID(), kind: 'renameCollection', collectionId: collection.id, title }))
            setTitle(''); }}>Переименовать текущую</button></div>
  </details>
  {undo && <p role="status">Убрано только из этой подборки. <button type="button" disabled={busy} onClick={async () => { if (await mutate({ id: crypto.randomUUID(), kind: 'membership', ...undo, present: true }))
            setUndo(null); }}>Вернуть</button></p>}
  {error && <p role="alert">{error}</p>}
  </>}
 </section>;
}
