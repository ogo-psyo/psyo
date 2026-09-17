import {takeMapSearchSlot} from './mapSearchBudget';
import type {MapSearchPlace} from '@/lib/mapSearchPlace';
export function mapDogAccess(value: unknown): MapSearchPlace['dogAccess'] { return value==='yes'?'yes':value==='leashed'?'leashed':value==='no'?'no':value==='designated'?'designated':'unknown'; }
const categories:Record<string,string>={veterinary:'ветклиника',pet:'зоомагазин',pet_grooming:'груминг',park:'парк',dog_park:'площадка для собак',cafe:'кафе',restaurant:'ресторан',pharmacy:'аптека'};
export type PlaceSearchResponse={status:number;results:MapSearchPlace[];error?:'search_quota'|'search_unavailable';retryAfter?:string};
function coordinate(value:unknown,min:number,max:number) {
 if((typeof value!=='string'&&typeof value!=='number')||(typeof value==='string'&&!value.trim()))return null;
 const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}
export async function searchMapPlaces(query:string,options:{bounds?:string|null;lat?:string|null;lng?:string|null;signal?:AbortSignal;category?:string|null}={}):Promise<PlaceSearchResponse> {
 if(options.category)return searchCategory(options.category,options);
 const q=query.trim().slice(0,120);if(q.length<2)return {status:200,results:[]};
 options.signal?.throwIfAborted();
 const b=options.bounds?.split(',').map(Number);
 const bounds=b&&b.length===4&&b.every(Number.isFinite)&&b[0]>=-90&&b[2]<=90&&b[1]>=-180&&b[3]<=180&&b[0]<b[2]&&b[1]<b[3]?b:null;
 const params=new URLSearchParams({format:'jsonv2',q,limit:'12',extratags:'1','accept-language':'ru',addressdetails:'1'});
 const lat=coordinate(options.lat,-90,90),lng=coordinate(options.lng,-180,180);
 if(bounds){params.set('viewbox',`${bounds[1]},${bounds[2]},${bounds[3]},${bounds[0]}`);}
 else if(lat!==null&&lng!==null){params.set('viewbox',`${lng-.18},${lat+.18},${lng+.18},${lat-.18}`);}
 if(!await takeMapSearchSlot())return {status:429,results:[],error:'search_quota',retryAfter:'2'};
 try {
  const signal=options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(6500)]):AbortSignal.timeout(6500);
  const response=await fetch(`https://nominatim.openstreetmap.org/search?${params}`,{headers:{Accept:'application/json','Accept-Language':'ru','User-Agent':'PsoApp/0.2 (https://pso-mvp.vercel.app)'},signal,next:{revalidate:3600}});
  if(response.status===429)return {status:429,results:[],error:'search_quota',retryAfter:'60'};
  if(!response.ok)throw new Error('UPSTREAM_FAILED');
  const payload:unknown=await response.json();if(!Array.isArray(payload)||payload.length>100)throw new Error('INVALID_PROVIDER_DATA');
  const retrievedAt=new Date().toISOString();
  const results:MapSearchPlace[]=payload.flatMap(raw=>{
   if(!raw||typeof raw!=='object')return [];
   const pointLat=coordinate(raw.lat,-90,90),pointLng=coordinate(raw.lon,-180,180);
   if(pointLat===null||pointLng===null)return [];
   const full=(typeof raw.display_name==='string'?raw.display_name:typeof raw.name==='string'?raw.name:'').trim();if(!full)return [];
   const title=(typeof raw.name==='string'&&raw.name.trim()?raw.name.trim():full.split(',')[0]).slice(0,300);
   const parts=full.split(',').map((s:string)=>s.trim()).filter(Boolean);if(parts[0]?.toLocaleLowerCase('ru-RU')===title.toLocaleLowerCase('ru-RU'))parts.shift();
   const osmType=['node','way','relation'].includes(raw.osm_type)?raw.osm_type:null;
   const osmId=Number.isSafeInteger(raw.osm_id)&&raw.osm_id>0?raw.osm_id:null;
   const placeId=Number.isSafeInteger(raw.place_id)&&raw.place_id>0?raw.place_id:null;
   const sourceUrl=osmType&&osmId?`https://www.openstreetmap.org/${osmType}/${osmId}`:`https://www.openstreetmap.org/?mlat=${pointLat}&mlon=${pointLng}`;
   return [{id:`osm-${osmType||'place'}-${osmId||placeId||`${pointLat}-${pointLng}`}`,title,detail:parts.slice(0,3).join(', ').slice(0,600),category:categories[raw.type]||categories[raw.category]||'место',kind:'organization' as const,point:{lat:pointLat,lng:pointLng},sourceUrl,retrievedAt,pointIsCenter:true as const,dogAccess:mapDogAccess(raw.extratags?.dog)}];
  }).slice(0,12);
  options.signal?.throwIfAborted();
  return {status:200,results};
 } catch(error){if(options.signal?.aborted)throw error;return {status:503,results:[],error:'search_unavailable'};}
}

const categoryFilters:Record<string,string>={park:'[leisure=park]',dog_park:'[leisure=dog_park]',cafe:'[amenity=cafe]',veterinary:'[amenity=veterinary]',pet:'[shop=pet]'};
const categoryCache=new Map<string,{time:number;results:MapSearchPlace[]}>();
async function searchCategory(category:string,options:{lat?:string|null;lng?:string|null;signal?:AbortSignal}):Promise<PlaceSearchResponse>{
 const lat=coordinate(options.lat,-85,85),lng=coordinate(options.lng,-180,180),filter=categoryFilters[category];
 if(lat===null||lng===null||!filter)return {status:400,results:[]};
 const key=`${category}:${lat.toFixed(3)}:${lng.toFixed(3)}`,cached=categoryCache.get(key);
 if(cached&&Date.now()-cached.time<3600000)return {status:200,results:cached.results};
 if(!await takeMapSearchSlot())return {status:429,results:[],error:'search_quota',retryAfter:'2'};
 try{
 const query=`[out:json][timeout:15];nwr${filter}(around:3000,${lat},${lng});out center tags 45;`;
 const r=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),headers:{'User-Agent':'PsoApp/0.2 (https://pso-mvp.vercel.app)'},signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(20000)]):AbortSignal.timeout(20000)});
 if(!r.ok)throw Error();
 const text=await r.text();if(text.length>2000000)throw Error();
 const body=JSON.parse(text);if(body.remark||!Array.isArray(body.elements))throw Error();
 const results:MapSearchPlace[]=body.elements.slice(0,45).flatMap((raw: {id:number;type:string;lat?:number;lon?:number;center?:{lat:number;lon:number};tags?:Record<string,string>})=>{
 const a=coordinate(raw.lat??raw.center?.lat,-90,90),b=coordinate(raw.lon??raw.center?.lon,-180,180);if(a===null||b===null||!['node','way','relation'].includes(raw.type)||!Number.isSafeInteger(raw.id))return [];
 const tags=raw.tags||{};return [{id:`osm-${raw.type}-${raw.id}`,title:(tags.name||categories[category]||'Место').slice(0,240),detail:[tags['addr:street'],tags['addr:housenumber']].filter(Boolean).join(', ').slice(0,600),category:categories[category]||'место',kind:'organization',point:{lat:a,lng:b},pointIsCenter:true,dogAccess:mapDogAccess(tags.dog),sourceUrl:`https://www.openstreetmap.org/${raw.type}/${raw.id}`,retrievedAt:new Date().toISOString()}];
 });if(categoryCache.size>=50)categoryCache.delete(categoryCache.keys().next().value!);categoryCache.set(key,{time:Date.now(),results});return {status:200,results};
 }catch{return {status:503,results:[],error:'search_unavailable'};}
}
