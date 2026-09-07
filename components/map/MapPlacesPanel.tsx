'use client';

import { CaretDown, Check, MapPin } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { zoneTypeLabels } from '@/lib/copy';

export type MapPlaceChoice = {
  id:string;title:string;detail?:string;category?:string;accuracyMeters?:number;privateNote?:string;dogAccess?:string;pointIsCenter?:boolean;
  kind:'place'|'organization';point:{lat:number;lng:number};
};
export function MapPlacesPanel({places,selectedId,selectedContent,onChoose,loading,error,onRetry,hiddenCount,onShowAll,inRoute,savedIds,searching}: {
  places:MapPlaceChoice[];selectedId?:string;selectedContent:ReactNode;onChoose:(p:MapPlaceChoice,trigger:HTMLElement)=>void;
  loading:boolean;error?:string;onRetry:()=>void;hiddenCount:number;onShowAll:()=>void;inRoute:Set<string>;savedIds:Set<string>;searching:boolean;
}) {
  return <section className="map-places-workspace" aria-labelledby="map-places-heading">
    <header><div><h2 id="map-places-heading">{searching?'Найденные места':'Места на карте'}</h2><p>{searching?'Результаты вашего поиска':'Сохранённые точки в видимой области'}</p></div><span className="map-places-count" aria-label={`Мест: ${places.length}`}>{places.length}</span></header>
    {loading&&<p role="status">Загружаю места…</p>}
    {error&&<div role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Повторить</button></div>}
    {!loading&&!places.length&&<div className="map-places-empty"><MapPin aria-hidden="true"/><h3>{searching?'Место не найдено':'Выберите первое место'}</h3><p>{searching?'Уточните название или передвиньте карту и повторите поиск.':'Коснитесь точки на карте или найдите место по названию сверху. Его можно сохранить и добавить в прогулку.'}</p></div>}
    {hiddenCount>0&&<button type="button" className="map-places-outside" onClick={onShowAll}>Показать мои места за пределами карты · {hiddenCount}</button>}
    <ol className="map-linked-places">{places.map(p=><li key={p.id} className={selectedId===p.id?'is-selected':''}>
      <button type="button" className="map-place-row" aria-expanded={selectedId===p.id} data-place-id={p.id} onClick={e=>onChoose(p,e.currentTarget)}>
        <span className="map-place-symbol"><MapPin aria-hidden="true"/></span><span><b>{p.title}</b><small>{p.category?(zoneTypeLabels[p.category]||p.category):'Место'}{p.accuracyMeters?' · примерная область':''}</small>{(inRoute.has(p.id)||savedIds.has(p.id))&&<em><Check aria-hidden="true"/>{inRoute.has(p.id)?'В прогулке':'Сохранено'}</em>}</span><CaretDown aria-hidden="true"/>
      </button>
      {selectedId===p.id&&selectedContent}
    </li>)}</ol>
  </section>;
}
