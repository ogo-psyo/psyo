import {parsePlaceBounds,withinPlaceBounds,type DiscoveredPlace,type PlaceRegion} from './placeDiscovery';

const groups=new Set(['parks','dogParks','vets','shops','grooming','cafes']);
const dogAccess=new Set(['yes','no','leashed','designated']);
export function validateMapPlaceRegion(value:unknown):value is PlaceRegion{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const region=value as Partial<PlaceRegion>;
  if(typeof region.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(region.id)||typeof region.title!=='string'||!region.title.trim()||region.title.length>180||!region.bounds)return false;
  const bounds=parsePlaceBounds([region.bounds.south,region.bounds.west,region.bounds.north,region.bounds.east].join(','));
  if(!bounds||typeof region.updatedAt!=='string'||!Number.isFinite(Date.parse(region.updatedAt))||typeof region.sourceUrl!=='string')return false;
  try{const source=new URL(region.sourceUrl);if(source.protocol!=='https:'||source.username||source.password)return false;}catch{return false;}
  if(!Array.isArray(region.places)||region.places.length<1||region.places.length>25000)return false;
  const ids=new Set<string>();
  return region.places.every((raw:unknown)=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;const place=raw as Partial<DiscoveredPlace>;
    if(typeof place.id!=='string'||!/^osm-(node|way|relation)-[1-9][0-9]*$/.test(place.id)||ids.has(place.id))return false;ids.add(place.id);
    return typeof place.title==='string'&&Boolean(place.title.trim())&&place.title.length<=240&&typeof place.detail==='string'&&place.detail.length<=600&&typeof place.category==='string'&&Boolean(place.category.trim())&&place.category.length<=120&&typeof place.group==='string'&&groups.has(place.group)&&Boolean(place.point)&&typeof place.point?.lat==='number'&&typeof place.point?.lng==='number'&&Number.isFinite(place.point.lat)&&Number.isFinite(place.point.lng)&&withinPlaceBounds(place.point,bounds)&&(!place.dogAccess||dogAccess.has(place.dogAccess));
  });
}
