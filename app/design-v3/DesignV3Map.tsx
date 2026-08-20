'use client';

import { useState } from 'react';
import { AttributionControl, Circle, CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type Mode = 'view' | 'route' | 'hazard';
type Point = { lat: number; lng: number };

const center: [number, number] = [55.751244, 37.618423];
const initialRoute: [number, number][] = [
  [55.7478, 37.6075],
  [55.7501, 37.6122],
  [55.7528, 37.6168],
  [55.7549, 37.6234],
];

function MapClick({ mode, onPoint }: { mode: Mode; onPoint: (point: Point) => void }) {
  useMapEvents({
    click(event) {
      if (mode === 'view') return;
      onPoint({ lat: Number(event.latlng.lat.toFixed(5)), lng: Number(event.latlng.lng.toFixed(5)) });
    },
  });
  return null;
}

export default function DesignV3Map() {
  const [mode, setMode] = useState<Mode>('view');
  const [route, setRoute] = useState<Point[]>([]);
  const [hazard, setHazard] = useState<Point | null>(null);
  const [shared, setShared] = useState(false);
  const [hazardPublished, setHazardPublished] = useState(false);

  function handlePoint(point: Point) {
    if (mode === 'route') setRoute((current) => [...current, point]);
    if (mode === 'hazard') setHazard(point);
  }

  return <section className="v3-real-map" aria-label="Интерактивная карта прогулок">
    <MapContainer center={center} zoom={14} className="v3-leaflet-map" zoomControl attributionControl={false}>
      <AttributionControl prefix={false} />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        subdomains="abcd"
        maxZoom={20}
      />
      <MapClick mode={mode} onPoint={handlePoint} />

      <Polyline positions={initialRoute} pathOptions={{ color: '#07814d', weight: 6, opacity: 0.9 }}>
        <Popup><b>Тихий маршрут вдоль воды</b><br />42 минуты · общий маршрут</Popup>
      </Polyline>
      <Circle center={[55.7556, 37.613]} radius={110} pathOptions={{ color: '#98df73', fillColor: '#cbfedb', fillOpacity: 0.65, weight: 3 }}>
        <Popup><b>Тихий сквер</b><br />Подходит для спокойной прогулки</Popup>
      </Circle>
      <Circle center={[55.7494, 37.625]} radius={85} pathOptions={{ color: '#dd617c', fillColor: '#dd617c', fillOpacity: 0.34, weight: 3 }}>
        <Popup><b>Разбитое стекло</b><br />Подтвердили 4 владельца</Popup>
      </Circle>

      {route.length > 1 && <Polyline positions={route.map(({ lat, lng }) => [lat, lng] as [number, number])} pathOptions={{ color: '#3df881', weight: 6, dashArray: '8 10' }} />}
      {route.map((point, index) => <CircleMarker key={`${point.lat}-${point.lng}-${index}`} center={[point.lat, point.lng]} radius={7} pathOptions={{ color: '#07814d', fillColor: '#3df881', fillOpacity: 1, weight: 3 }} />)}
      {hazard && <CircleMarker center={[hazard.lat, hazard.lng]} radius={12} pathOptions={{ color: '#07814d', fillColor: '#dd617c', fillOpacity: 1, weight: 3 }}><Popup>Новая опасная зона</Popup></CircleMarker>}
    </MapContainer>

    <div className="v3-map-mode" aria-label="Режим карты">
      <button type="button" className={mode === 'route' ? 'active' : ''} onClick={() => setMode(mode === 'route' ? 'view' : 'route')}>Маршрут</button>
      <button type="button" className={mode === 'hazard' ? 'danger active' : 'danger'} onClick={() => setMode(mode === 'hazard' ? 'view' : 'hazard')}>Опасность</button>
    </div>

    {mode === 'route' && <div className="v3-map-feedback" role="status"><b>{route.length < 2 ? 'Коснись карты минимум два раза' : `Маршрут: ${route.length} точек`}</b><span>Каждое касание добавляет участок.</span>{route.length >= 2 && <button type="button" onClick={() => setShared(true)}>{shared ? 'Маршрут готов к публикации' : 'Поделиться маршрутом'}</button>}</div>}
    {mode === 'hazard' && <div className="v3-map-feedback danger" role="status"><b>{hazard ? 'Опасная зона отмечена' : 'Коснись опасного места на карте'}</b><span>Адрес показывается приблизительно.</span>{hazard && <button type="button" onClick={() => setHazardPublished(true)}>{hazardPublished ? 'Предупреждение готово к публикации' : 'Предупредить район'}</button>}</div>}
  </section>;
}
