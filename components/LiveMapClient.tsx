'use client';

import { useEffect, useRef, useState } from 'react';
import { AttributionControl, Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, Rectangle, useMap, useMapEvents } from 'react-leaflet';
import type { LiveMapProps, MapFeature } from './LiveMap';
import { OpenFreeMapLayer } from './OpenFreeMapLayer';
import 'leaflet/dist/leaflet.css';
import {divIcon} from 'leaflet';
import {clusterPoints} from '@/lib/mapClusters';
import { splitRoute } from '@/lib/routeGeometry';

const defaultCenter: [number, number] = [55.751244, 37.618423];

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function zoneColor(type: string) {
  if (type === 'risk_zone' || type === 'risk') return '#dd617c';
  if (type === 'clinic') return '#07814d';
  if (type === 'route') return '#07814d';
  if (type === 'shop' || type === 'grooming') return '#8d8053';
  return '#648e6b';
}

const zoneLabels: Record<string, string> = {
  safe_place: 'безопасное место',
  risk_zone: 'зона риска',
  home_area: 'домашний район',
  walk_route: 'маршрут прогулки',
  route: 'маршрут прогулки',
  clinic: 'ветклиника',
  shop: 'зоомагазин',
  grooming: 'груминг',
  point: 'точка на карте',
};

const visibilityLabels: Record<string, string> = {
  private: 'только владельцу',
  shared: 'по ссылке',
  public: 'публично',
};

function featureRoutePositions(path: MapFeature['path']): [number, number][] {
  const source = Array.isArray(path) ? path[0] : path;
  const coordinates = source?.coordinates;
  if (!Array.isArray(coordinates)) return [];
  return coordinates
    .map((point) => Array.isArray(point) && point.length >= 2 ? [Number(point[1]), Number(point[0])] as [number, number] : null)
    .filter((point): point is [number, number] => Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1])));
}

function draftRoutePositions(routePoints: number[][]): [number, number][] {
  return routePoints
    .map((point) => Array.isArray(point) && point.length >= 2 ? [Number(point[1]), Number(point[0])] as [number, number] : null)
    .filter((point): point is [number, number] => Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1])));
}

function MapEvents({ onMapClick, onPick, onCenterChange,onBoundsChange }: Pick<LiveMapProps, 'onMapClick' | 'onPick' | 'onCenterChange'|'onBoundsChange'>) {
  const map = useMapEvents({
    click(event) {
      const point = {
        lat: Number(event.latlng.lat.toFixed(5)),
        lng: Number(event.latlng.lng.toFixed(5)),
      };
      if (onMapClick) {
        onMapClick({ latlng: point });
        return;
      }
      onPick?.(point);
    },
    moveend() {
      const center = map.getCenter();
      onCenterChange?.({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
      const bounds=map.getBounds();onBoundsChange?.({south:bounds.getSouth(),west:bounds.getWest(),north:bounds.getNorth(),east:bounds.getEast()});
    },
  });
  useEffect(() => {
    const center = map.getCenter();
    onCenterChange?.({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    const bounds=map.getBounds();onBoundsChange?.({south:bounds.getSouth(),west:bounds.getWest(),north:bounds.getNorth(),east:bounds.getEast()});
  }, [map, onCenterChange,onBoundsChange]);
  return null;
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function MapAccessibility({ label }: { label: string }) {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => { if(container.clientWidth && container.clientHeight) map.invalidateSize({animate:false,pan:false}); });
    observer.observe(container);
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', label);
    return () => observer.disconnect();
  }, [label, map]);
  return null;
}

function MapViewport({ zones, features, userLocation, focusPoint, routePoints, fitDraftRoute }: Pick<LiveMapProps, 'zones' | 'features' | 'userLocation' | 'focusPoint' | 'routePoints' | 'fitDraftRoute'>) {
  const map = useMap();
  const orientedRef = useRef(false);
  const focusTokenRef = useRef<number | null>(null);
  const fittedDraftRef = useRef('');

  useEffect(() => {
    const draft = draftRoutePositions(routePoints || []);
    const draftSignature = fitDraftRoute && draft.length > 1
      ? JSON.stringify(draft)
      : '';
    if (draftSignature && draftSignature !== fittedDraftRef.current) {
      fittedDraftRef.current = draftSignature;
      const fitCompletedRoute = () => {
        map.invalidateSize({ animate: false });
        const adjacent=Boolean(map.getContainer().closest('.production-map-workspace')?.querySelector('.map-work-area'));
        const mapHeight = map.getSize().y;
        map.fitBounds(draft, {
          paddingTopLeft: [36, adjacent?36:76],
          paddingBottomRight: [36, adjacent?36:Math.round(mapHeight * 0.58)],
          maxZoom: 17,
          animate: false,
        });
      };
      fitCompletedRoute();
      const refitTimer = window.setTimeout(fitCompletedRoute, 140);
      orientedRef.current = true;
      return () => window.clearTimeout(refitTimer);
    }
    if (focusPoint && focusPoint.token !== focusTokenRef.current) {
      focusTokenRef.current = focusPoint.token;
      if (focusPoint.bounds) {
        const b = focusPoint.bounds;
        map.fitBounds([[b.south,b.west],[b.north,b.east]], {padding:[44,44],maxZoom:16,animate:!reducedMotion()});
      } else map.setView([focusPoint.lat, focusPoint.lng], focusPoint.zoom ?? 16, { animate: !reducedMotion() });
      return;
    }
    if (userLocation && !orientedRef.current) {
      orientedRef.current = true;
      map.setView([userLocation.lat, userLocation.lng], 16, { animate: !reducedMotion() });
      return;
    }
    if (orientedRef.current) return;
    const points: [number, number][] = [];
    for (const zone of zones || []) {
      const lat = toNumber(zone.approximate_lat);
      const lng = toNumber(zone.approximate_lng);
      if (lat !== null && lng !== null) points.push([lat, lng]);
    }
    for (const feature of features || []) {
      if (feature.type === 'point') {
        const lat = toNumber(feature.lat);
        const lng = toNumber(feature.lng);
        if (lat !== null && lng !== null) points.push([lat, lng]);
      } else {
        points.push(...featureRoutePositions(feature.path));
      }
    }
    if (points.length === 1) map.setView(points[0], 15, { animate: false });
    if (points.length > 1) map.fitBounds(points, { padding: [44, 44], maxZoom: 15, animate: false });
    orientedRef.current = true;
  }, [features, fitDraftRoute, focusPoint, map, routePoints, userLocation, zones]);
  return null;
}

function FeaturePointMarkers({features,selectedId,onSelect}:{features:MapFeature[];selectedId?:string|null;onSelect?:(id:string)=>void}) {
 const map=useMap();const [zoom,setZoom]=useState(map.getZoom());useMapEvents({zoomend:()=>setZoom(map.getZoom())});
 const points=features.filter(f=>f.type==='point'&&f.pointKind==='ownerPlace'&&toNumber(f.lat)!==null&&toNumber(f.lng)!==null);
 const clusters=clusterPoints(points,f=>map.project([Number(f.lat),Number(f.lng)],zoom),56,selectedId);
 return <>{clusters.map(group=>{
  const center:[number,number]=[group.reduce((sum,f)=>sum+Number(f.lat),0)/group.length,group.reduce((sum,f)=>sum+Number(f.lng),0)/group.length];
  if(group.length>1)return <Marker key={group.map(f=>f.id).join(':')} position={center} title={`Мест: ${group.length}. Приблизить`} icon={divIcon({className:'pso-map-cluster',html:`<span>${group.length}</span>`,iconSize:[44,44]})} eventHandlers={{click:()=>map.setView(center,Math.min(zoom+2,map.getMaxZoom()),{animate:!reducedMotion()})}}><Popup>{group.map(f=><button type="button" key={f.id} onClick={()=>onSelect?.(f.id)}>{f.title}</button>)}</Popup></Marker>;
  const f=group[0];const symbol=/clinic|ветклиник/.test(f.zone_type||'')?'+':/shop|магазин/.test(f.zone_type||'')?'▣':/park|парк/.test(f.zone_type||'')?'♧':'●';
  return <Marker key={f.id} position={center} title={`${f.title} · ${f.zone_type||'место'}`} icon={divIcon({className:`pso-map-marker${selectedId===f.id?' selected':''}`,html:`<span>${symbol}</span>`,iconSize:[44,44]})} eventHandlers={{click:()=>onSelect?.(f.id)}}>{!onSelect&&<Popup><b>{f.title}</b><br/>{f.zone_type||'место'}</Popup>}</Marker>;
 })}</>;
}

export function LiveMapClient({
  zones = [],
  features = [],
  picked,
  routePoints = [],
  routeStops = [],
  routeStopIds = [],
  routeGaps = [],
  onPick,
  onMapClick,
  onCenterChange,onBoundsChange,searchBounds,
  filter = 'all',
  selectedFeatureId,onSelectFeature,
  userLocation,
  focusPoint,
  searchPoint,
  fitDraftRoute = false,
  accessibleLabel = 'Интерактивная карта прогулок и сохранённых мест',
}: LiveMapProps) {
  const [tilesReady, setTilesReady] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [tileRevision, setTileRevision] = useState(0);
  const mappedZones = zones
    .map((zone) => ({
      ...zone,
      lat: toNumber(zone.approximate_lat),
      lng: toNumber(zone.approximate_lng),
      radius: Number(zone.radius_meters || zone.radiusMeters || 500),
    }))
    .filter((zone) => zone.lat !== null && zone.lng !== null)
    .filter((zone) => filter === 'all' || (filter === 'risks' ? zone.type === 'risk_zone' || zone.type === 'risk' : filter === 'places' ? zone.type !== 'risk_zone' && zone.type !== 'risk' : false));
  const mappedFeatures = features.filter((feature) => filter === 'all'
    || (filter === 'routes' && feature.type === 'route')
    || (filter === 'risks' && feature.type === 'point' && (feature.zone_type === 'risk_zone' || feature.zone_type === 'risk'))
    || (filter === 'places' && feature.type === 'point' && feature.zone_type !== 'risk_zone' && feature.zone_type !== 'risk'));
  const draftPositions = draftRoutePositions(routePoints);

  return (
    <div className="live-map-frame">
      <MapContainer center={defaultCenter} zoom={12} className="live-map" zoomControl attributionControl={false} aria-label={accessibleLabel}>
        <MapAccessibility label={accessibleLabel} />
        <AttributionControl prefix={false} />
        <OpenFreeMapLayer key={tileRevision} onLoad={() => setTilesReady(true)} onError={() => setTilesFailed(true)} />
        <MapEvents onMapClick={onMapClick} onPick={onPick} onCenterChange={onCenterChange} onBoundsChange={onBoundsChange} />
        {searchBounds&&<Rectangle bounds={[[searchBounds.south,searchBounds.west],[searchBounds.north,searchBounds.east]]} pathOptions={{color:'#526f53',weight:1,dashArray:'4 6',fillOpacity:0}} interactive={false} />}
        <MapViewport zones={zones} features={features} userLocation={userLocation} focusPoint={focusPoint} routePoints={routePoints} fitDraftRoute={fitDraftRoute} />

        {userLocation && <>
          <Circle center={[userLocation.lat, userLocation.lng]} radius={Math.max(40, Math.min(userLocation.accuracy || 80, 600))} pathOptions={{ color: '#07814d', fillColor: '#3df881', fillOpacity: 0.12, weight: 1 }} interactive={false} />
          <CircleMarker center={[userLocation.lat, userLocation.lng]} radius={8} pathOptions={{ color: '#fafffb', fillColor: '#07814d', fillOpacity: 1, weight: 3 }}><Popup>Вы здесь</Popup></CircleMarker>
        </>}

        {searchPoint && (
          <CircleMarker center={[searchPoint.lat, searchPoint.lng]} radius={10} pathOptions={{ color: '#f7f6f0', fillColor: '#07814d', fillOpacity: 1, weight: 4 }}>
            <Popup><b>{searchPoint.title}</b>{searchPoint.detail ? <><br />{searchPoint.detail}</> : null}</Popup>
          </CircleMarker>
        )}

        {mappedZones.map((zone) => {
        const color = zoneColor(zone.type);
        return (
          <Circle
            key={zone.id}
            center={[zone.lat as number, zone.lng as number]}
            radius={zone.radius}
            eventHandlers={{click:()=>onSelectFeature?.(zone.id)}}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.16, weight: selectedFeatureId===zone.id?4:2 }}
          >
            <Popup>
              <b>{zone.title}</b>
              <br />
              {zoneLabels[zone.type] || 'место'}
              {zone.note ? <><br />{zone.note}</> : null}
            </Popup>
          </Circle>
        );
        })}

        <FeaturePointMarkers features={mappedFeatures} selectedId={selectedFeatureId} onSelect={onSelectFeature} />
        {mappedFeatures.map((feat) => {
        if(feat.type==='point'&&feat.pointKind!=='ownerPlace'&&toNumber(feat.lat)!==null&&toNumber(feat.lng)!==null){
          const color=zoneColor(feat.zone_type||'safe_place');
          return <Circle key={feat.id} center={[Number(feat.lat),Number(feat.lng)]} radius={Math.max(500,feat.radiusMeters||500)} pathOptions={{color,fillColor:color,fillOpacity:.16,weight:2}} eventHandlers={{click:()=>onSelectFeature?.(feat.id)}}><Popup><b>{feat.title}</b><br/>{zoneLabels[feat.zone_type||'point']||'Примерная область'}</Popup></Circle>;
        }
        if (feat.type === 'route' && feat.path) {
          const positions = featureRoutePositions(feat.path);
          if (positions.length < 2) return null;
          return (
            <Polyline
              key={feat.id}
              positions={splitRoute(positions, feat.pathGaps) as [number,number][][]}
              eventHandlers={{click:()=>onSelectFeature?.(feat.id)}}
              pathOptions={{ color: feat.visibility === 'public' ? '#3c7553' : '#4f7659', weight: selectedFeatureId===feat.id?6:4 }}
            >
              <Popup>
                <b>{feat.title}</b>
                <br />
                {visibilityLabels[feat.visibility] || 'только владельцу'}
              </Popup>
            </Polyline>
          );
        }

        return null;
        })}

        {routeStops.map((p,i)=><Marker key={`stop-${i}`} position={[p[1],p[0]]} title={`Остановка ${i+1}`} zIndexOffset={800} icon={divIcon({className:'pso-route-stop-marker',html:`<span>${i+1}</span>`,iconSize:[32,32],iconAnchor:[16,16]})} eventHandlers={{click:()=>{const id=routeStopIds[i];if(id)onSelectFeature?.(id);}}} />)}
        {draftPositions.length > 1 && (
          <Polyline positions={splitRoute(draftPositions, routeGaps) as [number,number][][]} pathOptions={{ color: '#4f7659', weight: 4, dashArray: '6 8' }}>
            <Popup>Новый маршрут</Popup>
          </Polyline>
        )}

        {picked && (
          <CircleMarker center={[picked.lat, picked.lng]} radius={10} pathOptions={{ color: '#fff', fillColor: '#dd617c', fillOpacity: 1, weight: 4 }}>
            <Popup>Новая примерная точка</Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {!tilesReady && (
        <div className="map-surface-status map-surface-overlay" role="status">
          <b>{tilesFailed ? 'Карта пока недоступна' : 'Загружаю карту'}</b>
          {tilesFailed && <button type="button" onClick={() => {setTilesFailed(false);setTilesReady(false);setTileRevision(value=>value+1);}}>Повторить загрузку</button>}
          <span>{tilesFailed ? 'Сохранённые места и маршруты остаются доступны.' : 'Места и маршруты появятся здесь.'}</span>
        </div>
      )}
    </div>
  );
}
