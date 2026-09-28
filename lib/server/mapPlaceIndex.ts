import type { DiscoveryResponse, PlaceBounds, PlaceCategory } from '@/lib/placeDiscovery';
import { getSupabaseAdmin } from './supabase';

type RpcDatabase={rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
type IndexedResult={state:'covered';response:DiscoveryResponse}|{state:'uncovered'|'unavailable'};

function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function indexedResponse(value:unknown,bounds:PlaceBounds,category:PlaceCategory):DiscoveryResponse|null{
  if(!isRecord(value)||value.covered!==true||!Array.isArray(value.results)||!Array.isArray(value.coverage))return null;
  const results=value.results.filter(isRecord).flatMap(raw=>{
    const point=isRecord(raw.point)?raw.point:null;
    if(typeof raw.id!=='string'||!/^osm-(node|way|relation)-[1-9][0-9]*$/.test(raw.id)||typeof raw.title!=='string'||!raw.title.trim()||typeof raw.detail!=='string'||typeof raw.category!=='string'||typeof raw.group!=='string'||!point||typeof point.lat!=='number'||typeof point.lng!=='number')return [];
    if(!['parks','dogParks','vets','shops','grooming','cafes'].includes(raw.group)||!Number.isFinite(point.lat)||!Number.isFinite(point.lng))return [];
    const dogAccess=['yes','no','leashed','designated'].includes(String(raw.dogAccess))?String(raw.dogAccess):undefined;
    return [{id:raw.id,title:raw.title.slice(0,240),detail:raw.detail.slice(0,600),category:raw.category.slice(0,120),group:raw.group as Exclude<PlaceCategory,'all'>,point:{lat:point.lat,lng:point.lng},...(dogAccess?{dogAccess}:{}),...(raw.pointIsCenter===true?{pointIsCenter:true}:{})}];
  });
  const coverage=value.coverage.filter(isRecord).flatMap(item=>typeof item.id==='string'&&typeof item.title==='string'?[{id:item.id,title:item.title}]:[]);
  const total=typeof value.total==='number'&&Number.isSafeInteger(value.total)&&value.total>=results.length?value.total:results.length;
  return {results,bounds,category,total,truncated:value.truncated===true||total>results.length,updatedAt:typeof value.updatedAt==='string'?value.updatedAt:'',source:'OpenStreetMap',coverage};
}

export async function queryMapPlaceIndex(bounds:PlaceBounds,category:PlaceCategory,database:RpcDatabase|null=getSupabaseAdmin()):Promise<IndexedResult>{
  if(!database)return {state:'unavailable'};
  const {data,error}=await database.rpc('query_map_place_index',{p_south:bounds.south,p_west:bounds.west,p_north:bounds.north,p_east:bounds.east,p_group:category,p_limit:80});
  if(error)return {state:'unavailable'};
  if(isRecord(data)&&data.covered===false)return {state:'uncovered'};
  const response=indexedResponse(data,bounds,category);
  return response?{state:'covered',response}:{state:'unavailable'};
}
