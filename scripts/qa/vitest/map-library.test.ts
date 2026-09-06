import {describe,it,expect} from 'vitest';
import {applyLibraryCommand,emptyMapLibrary,collectionPoints,type SavedPlace} from '@/lib/mapLibrary';
import {measuredRouteDistance,splitRoute,routeEwkt} from '@/lib/routeGeometry';
const place:SavedPlace={id:'a',title:'Парк',detail:'',category:'park',point:{lat:55.7,lng:37.6},source:{provider:'osm',id:'way-1'},note:'Вода у входа'};
describe('map saved value',()=>{
 it('preserves one identity, independent memberships, notes, replay and source order',()=>{
  let l=applyLibraryCommand(emptyMapLibrary(),{id:'1',kind:'savePlace',collectionId:'saved',place});
  l=applyLibraryCommand(l,{id:'2',kind:'createCollection',collectionId:'parks',title:'Парки'});
  l=applyLibraryCommand(l,{id:'3',kind:'savePlace',collectionId:'parks',place:{...place,id:'other'}});
  expect(l.places).toHaveLength(1);expect(l.collections[1].placeIds).toEqual(['a']);
  l=applyLibraryCommand(l,{id:'4',kind:'membership',collectionId:'saved',placeId:'a',present:false});
  expect(l.collections[1].placeIds).toEqual(['a']);expect(l.places[0].note).toBe(place.note);
  const before=JSON.stringify(l);expect(collectionPoints(l,'parks')).toEqual([[37.6,55.7]]);expect(JSON.stringify(l)).toBe(before);
  expect(applyLibraryCommand(l,{id:'4',kind:'membership',collectionId:'saved',placeId:'a',present:false})).toBe(l);
 });
 it('rejects invalid geometry and injected member references',()=>{
  expect(()=>applyLibraryCommand(emptyMapLibrary(),{id:'1',kind:'savePlace',collectionId:'saved',place:{...place,point:{lat:NaN,lng:37}}})).toThrow();
  expect(()=>applyLibraryCommand(emptyMapLibrary(),{id:'1',kind:'membership',collectionId:'saved',placeId:'foreign',present:true})).toThrow();
 });
 it('never draws or measures a missing GPS segment',()=>{
  const p=[[37,55],[37.001,55],[38,56],[38.001,56]];
  expect(splitRoute(p,[2])).toEqual([p.slice(0,2),p.slice(2)]);
  expect(measuredRouteDistance(p,[2])).toBeLessThan(200);expect(measuredRouteDistance(p)).toBeGreaterThan(100000);
  expect(routeEwkt([[null,55],[37,55]])).toBeNull();
 });
});

import {previewMeetingPlace,previewMeetingRoute} from '@/lib/meetingPlace';
import {storedRoutePoints} from '@/lib/routeGeometry';
describe('meeting disclosures and old routes',()=>{
 it('excludes notes and provider internals from place previews',()=>{const p=previewMeetingPlace(place);expect(p).not.toHaveProperty('note');expect(p).not.toHaveProperty('source');});
 it('does not leak endpoints or rejoin disconnected safe parts',()=>{
  const points=[[37,55],[37.001,55],[37.03,55],[37.04,55],[37.001,55],[37,55]];
  const p=previewMeetingRoute('route','Прогулка',points);expect(p?.points).toEqual([[37.03,55],[37.04,55]]);
  expect(previewMeetingRoute('r','short',[[37,55],[37.001,55],[37.002,55]])).toBeNull();
 });
 it('reads PostGIS EWKT and little-endian EWKB without dropping old coordinates',()=>{
  const points=[[37.6,55.7],[37.7,55.8]];
  const buf=new ArrayBuffer(45);const view=new DataView(buf);view.setUint8(0,1);view.setUint32(1,0x20000002,true);view.setUint32(5,4326,true);view.setUint32(9,2,true);
  points.flat().forEach((n,i)=>view.setFloat64(13+i*8,n,true));const hex=Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('');
  expect(storedRoutePoints(hex)).toEqual(points);expect(storedRoutePoints('SRID=4326;LINESTRING(37.6 55.7, 37.7 55.8)')).toEqual(points);
  expect(storedRoutePoints(hex.slice(0,-2))).toBeNull();
 });
});

import {findDurationWalk} from '@/lib/durationWalk';
import {clusterPoints} from '@/lib/mapClusters';
describe('bounded duration and map clusters',()=>{
 it('offers only recorded local loops within declared time tolerance',()=>{
  const route={id:'r',type:'route' as const,title:'Круг',visibility:'private' as const,routeSource:'recorded' as const,path:{type:'LineString' as const,coordinates:[[37,55],[37.01,55],[37.01,55.01],[37,55.01],[37,55]]}};
  expect(findDurationWalk([route],{lng:37,lat:55},53)?.route.id).toBe('r');
  expect(findDurationWalk([route],{lng:38,lat:55},53)).toBeNull();
  expect(findDurationWalk([{...route,pathGaps:[2]}],{lng:37,lat:55},53)).toBeNull();
  expect(findDurationWalk([route],{lng:37,lat:55},10)).toBeNull();
 });
 it('keeps selected markers separate from dense clusters',()=>{
  const points=[{id:'a'},{id:'b'},{id:'c'}];expect(clusterPoints(points,()=>({x:1,y:1}),56,'a').map(c=>c.length)).toEqual([1,2]);
 });
});
