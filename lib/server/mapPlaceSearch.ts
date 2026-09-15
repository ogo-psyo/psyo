import {takeMapSearchSlot} from './mapSearchBudget';
import type {MapSearchPlace} from '@/lib/mapSearchPlace';
const categories:Record<string,string>={veterinary:'ветклиника',pet:'зоомагазин',pet_grooming:'груминг',park:'парк',dog_park:'площадка для собак',cafe:'кафе',restaurant:'ресторан',pharmacy:'аптека'};
export type PlaceSearchResponse={status:number;results:MapSearchPlace[];error?:'search_quota'|'search_unavailable';retryAfter?:string};
function coordinate(value:unknown,min:number,max:number) {
 if((typeof value!=='string'&&typeof value!=='number')||(typeof value==='string'&&!value.trim()))return null;
 const n=Number(value);return Number.isFinite(n)&&n>=min&&n<=max?n:null;
}
export async function searchMapPlaces(query:string,options:{bounds?:string|null;lat?:string|null;lng?:string|null;signal?:AbortSignal}={}):Promise<PlaceSearchResponse> {
 const q=query.trim().slice(0,120);if(q.length<2)return {status:200,results:[]};
 options.signal?.throwIfAborted();
 const b=options.bounds?.split(',').map(Number);
 const bounds=b&&b.length===4&&b.every(Number.isFinite)&&b[0]>=-90&&b[2]<=90&&b[1]>=-180&&b[3]<=180&&b[0]<b[2]&&b[1]<b[3]?b:null;
 const params=new URLSearchParams({format:'jsonv2',q,limit:'6','accept-language':'ru',addressdetails:'1'});
 const lat=coordinate(options.lat,-90,90),lng=coordinate(options.lng,-180,180);
 if(bounds){params.set('viewbox',`${bounds[1]},${bounds[2]},${bounds[3]},${bounds[0]}`);params.set('bounded','1');}
 else if(lat!==null&&lng!==null){params.set('viewbox',`${lng-.18},${lat+.18},${lng+.18},${lat-.18}`);params.set('bounded','1');}
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
   if(bounds&&(pointLat<bounds[0]||pointLat>bounds[2]||pointLng<bounds[1]||pointLng>bounds[3]))return [];
   const full=(typeof raw.display_name==='string'?raw.display_name:typeof raw.name==='string'?raw.name:'').trim();if(!full)return [];
   const title=(typeof raw.name==='string'&&raw.name.trim()?raw.name.trim():full.split(',')[0]).slice(0,300);
   const parts=full.split(',').map((s:string)=>s.trim()).filter(Boolean);if(parts[0]?.toLocaleLowerCase('ru-RU')===title.toLocaleLowerCase('ru-RU'))parts.shift();
   const osmType=['node','way','relation'].includes(raw.osm_type)?raw.osm_type:null;
   const osmId=Number.isSafeInteger(raw.osm_id)&&raw.osm_id>0?raw.osm_id:null;
   const placeId=Number.isSafeInteger(raw.place_id)&&raw.place_id>0?raw.place_id:null;
   const sourceUrl=osmType&&osmId?`https://www.openstreetmap.org/${osmType}/${osmId}`:`https://www.openstreetmap.org/?mlat=${pointLat}&mlon=${pointLng}`;
   return [{id:`osm-${osmType||'place'}-${osmId||placeId||`${pointLat}-${pointLng}`}`,title,detail:parts.slice(0,3).join(', ').slice(0,600),category:categories[raw.type]||categories[raw.category]||'место',kind:'organization' as const,point:{lat:pointLat,lng:pointLng},sourceUrl,retrievedAt,pointIsCenter:true as const,dogAccess:'unknown' as const}];
  }).slice(0,6);
  options.signal?.throwIfAborted();
  return {status:200,results};
 } catch(error){if(options.signal?.aborted)throw error;return {status:503,results:[],error:'search_unavailable'};}
}
