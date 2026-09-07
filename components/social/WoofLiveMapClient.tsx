'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { AttributionControl, Circle, CircleMarker, MapContainer, Marker, useMap } from 'react-leaflet';
import type { WoofLiveMapProps } from './WoofLiveMap';
import { OpenFreeMapLayer } from '../OpenFreeMapLayer';
import 'leaflet/dist/leaflet.css';

const defaultCenter: [number, number] = [55.751244, 37.618423];

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
}

function Viewport({ viewerLocation, selectedId, signals }: Pick<WoofLiveMapProps, 'viewerLocation' | 'selectedId' | 'signals'>) {
  const map = useMap();
  const positionedFor = useRef<string|null>(null);
  const selection = useRef<string|null>(selectedId);
  useEffect(() => {
    if (!viewerLocation) return;
    const area = `${viewerLocation.lat}:${viewerLocation.lng}`;
    if (positionedFor.current === area) return;
    const first = positionedFor.current === null;
    positionedFor.current = area;
    map.invalidateSize({ animate: false, pan: false });
    // Preserve the user's zoom when searching a moved map. New results must not
    // fit back to a distant own signal or reset the camera on every poll.
    map.setView([viewerLocation.lat, viewerLocation.lng], first ? 14 : map.getZoom(), { animate: false });
  }, [map, viewerLocation]);
  useEffect(() => {
    if (selection.current === selectedId) return;
    selection.current = selectedId;
    const signal = signals.find(s => s.id === selectedId);
    if (signal) map.panTo([signal.approximateLocation.lat, signal.approximateLocation.lng], { animate: false });
  }, [map, selectedId, signals]);
  return null;
}

function ExplorerControls({ expanded, onToggleExpanded, onSearchHere, searching, viewerLocation, viewerRadiusMeters }: WoofLiveMapProps) {
  const map = useMap();
  const ref = useRef<HTMLDivElement>(null);
  const [moved, setMoved] = useState(false);
  const viewerLat = viewerLocation?.lat, viewerLng = viewerLocation?.lng;
  useEffect(() => {
    if (ref.current) { L.DomEvent.disableClickPropagation(ref.current); L.DomEvent.disableScrollPropagation(ref.current); }
    const update = () => setMoved(viewerLat !== undefined && viewerLng !== undefined && map.getCenter().distanceTo([viewerLat, viewerLng]) > 100);
    // Selecting a marker pans the camera too, but does not ask for a new search.
    map.on('dragend', update);
    const frame = requestAnimationFrame(() => setMoved(false));
    return () => { cancelAnimationFrame(frame); map.off('dragend', update); };
  }, [map, viewerLat, viewerLng]);
  return <div ref={ref} className="woof-map-explorer">
    <button type="button" className="woof-expand-map" aria-expanded={expanded} onClick={onToggleExpanded}>{expanded ? 'Свернуть карту' : 'Развернуть карту'}</button>
    {expanded && onSearchHere && <button type="button" className="woof-search-here" disabled={searching} onClick={() => { const center = map.getCenter(); setMoved(false); onSearchHere({lat:center.lat,lng:center.lng}); }}>{searching ? 'Ищем компанию…' : `Искать здесь · ${viewerRadiusMeters / 1000} км`}</button>}
    {expanded && moved && <span className="woof-map-moved" role="status">Карта перемещена — обновите поиск здесь</span>}
  </div>;
}

export function WoofLiveMapClient(props: WoofLiveMapProps) {
  const {signals,viewerLocation,viewerRadiusMeters,selectedId,onSelect,onMapState}=props;
  const [tileState,setTileState] = useState<'loading'|'ready'|'error'>('loading');
  const [tileRevision,setTileRevision] = useState(0);
  useEffect(() => { onMapState?.(tileState); }, [onMapState, tileState]);
  const icons = useMemo(() => new Map(signals.map((signal) => {
    const content = signal.avatarUrl
      ? `<img src="${escapeHtml(signal.avatarUrl)}" alt="" />`
      : `<span aria-hidden="true">${escapeHtml(signal.name.slice(0, 1).toUpperCase())}</span>`;
    return [signal.id, L.divIcon({
      className: `woof-avatar-marker${signal.id === selectedId ? ' is-selected' : ''}${signal.isMine ? ' is-mine' : ''}`,
      html: `<div>${content}<i></i></div>`,
      iconSize: [62, 72],
      iconAnchor: [31, 64],
    })];
  })), [selectedId, signals]);

  return <MapContainer center={defaultCenter} zoom={12} className="woof-live-map" zoomControl attributionControl={false} aria-label="Карта активных Гав-сигналов поблизости">
    <AttributionControl prefix={false} />
<OpenFreeMapLayer key={tileRevision} onLoad={()=>setTileState('ready')} onError={()=>setTileState('error')} />
    {tileState!=='ready'&&<div className="woof-map-load-state" role={tileState==='error'?'alert':'status'}>{tileState==='loading'?'Карта загружается…':<>Карта недоступна. Гав и отклики работают. <button type="button" onClick={()=>{setTileState('loading');setTileRevision(v=>v+1);}}>Повторить загрузку карты</button></>}</div>}
    <Viewport signals={signals} viewerLocation={viewerLocation} selectedId={selectedId} />
    <ExplorerControls {...props} />
    {viewerLocation && <>
      <Circle center={[viewerLocation.lat, viewerLocation.lng]} radius={viewerRadiusMeters} pathOptions={{ color: '#4d7057', fillColor: '#c4d4b8', fillOpacity: 0.055, weight: 1, dashArray: '6 8' }} interactive={false} />
      <CircleMarker center={[viewerLocation.lat, viewerLocation.lng]} radius={7} pathOptions={{ color: '#f7fff9', fillColor: '#4d7057', fillOpacity: 1, weight: 3 }} interactive={false} />
    </>}
    {signals.map((signal) => <Circle
      key={`${signal.id}:privacy`}
      center={[signal.approximateLocation.lat, signal.approximateLocation.lng]}
      radius={signal.privacyRadiusMeters}
      pathOptions={{ color: signal.isMine ? '#4d7057' : '#ae7978', fillColor: signal.isMine ? '#aec9aa' : '#ae7978', fillOpacity: signal.id === selectedId ? 0.18 : 0.08, weight: signal.id === selectedId ? 2 : 1 }}
      interactive={false}
    />)}
    {signals.map((signal) => <Marker
      key={signal.id}
      position={[signal.approximateLocation.lat, signal.approximateLocation.lng]}
      icon={icons.get(signal.id)!}
      eventHandlers={{ click: () => onSelect(signal.id) }}
      title={`${signal.name}: Гав-сигнал, примерная зона`}
      keyboard
    />)}
  </MapContainer>;
}
