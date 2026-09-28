import type {DiscoveredPlace,PlaceBounds} from './placeDiscovery';

export type MultiPolygonGeometry={type:'MultiPolygon';coordinates:number[][][][]};
export function parseOsmPoly(text:string):{coverage:MultiPolygonGeometry;bounds:PlaceBounds}{
  const lines=text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);if(lines.length<5)throw Error('Invalid .poly file');
  let index=1;const polygons:number[][][][]=[];
  while(index<lines.length&&lines[index]!=='END'){
    const name=lines[index++],ring:number[][]=[];
    while(index<lines.length&&lines[index]!=='END'){
      const parts=lines[index++].split(/\s+/).map(Number);if(parts.length!==2||!parts.every(Number.isFinite))throw Error('Invalid .poly coordinate');ring.push(parts);
    }
    if(lines[index++]!=='END'||ring.length<4)throw Error('Invalid .poly ring');
    if(ring[0][0]!==ring.at(-1)?.[0]||ring[0][1]!==ring.at(-1)?.[1])ring.push([...ring[0]]);
    if(name.startsWith('!')){if(!polygons.length)throw Error('Hole without outer ring');polygons.at(-1)!.push(ring);}else polygons.push([ring]);
  }
  if(lines[index]!=='END'||!polygons.length)throw Error('Invalid .poly ending');
  const outer=polygons.flatMap(p=>p[0]);const lngs=outer.map(p=>p[0]),lats=outer.map(p=>p[1]);
  return {coverage:{type:'MultiPolygon',coordinates:polygons},bounds:{south:Math.min(...lats),west:Math.min(...lngs),north:Math.max(...lats),east:Math.max(...lngs)}};
}

function coordinatePairs(value:unknown,result:number[][]=[]):number[][]{
  if(!Array.isArray(value))return result;
  if(value.length>=2&&typeof value[0]==='number'&&typeof value[1]==='number'&&Number.isFinite(value[0])&&Number.isFinite(value[1])){result.push([value[0],value[1]]);return result;}
  for(const item of value)coordinatePairs(item,result);return result;
}
export function normalizeOsmGeoJsonFeature(value:unknown):DiscoveredPlace|null{
  if(!value||typeof value!=='object'||Array.isArray(value))return null;const feature=value as Record<string,unknown>;
  const properties=feature.properties&&typeof feature.properties==='object'&&!Array.isArray(feature.properties)?feature.properties as Record<string,unknown>:null;
  const geometry=feature.geometry&&typeof feature.geometry==='object'&&!Array.isArray(feature.geometry)?feature.geometry as Record<string,unknown>:null;
  const osmType=properties?.['@type'],osmId=properties?.['@id'];if(!properties||!geometry||!['node','way','relation'].includes(String(osmType))||typeof osmId!=='number'||!Number.isSafeInteger(osmId)||osmId<1||properties.access==='private'||properties.access==='no')return null;
  let group:DiscoveredPlace['group'],category:string;
  if(properties.leisure==='dog_park'){group='dogParks';category='площадка для собак';}
  else if(properties.leisure==='park'){group='parks';category='парк';}
  else if(properties.amenity==='veterinary'){group='vets';category='ветклиника';}
  else if(properties.shop==='pet'){group='shops';category='зоомагазин';}
  else if(properties.shop==='pet_grooming'){group='grooming';category='груминг';}
  else if(properties.amenity==='cafe'||properties.amenity==='restaurant'){group='cafes';category=properties.amenity==='cafe'?'кафе':'ресторан';}
  else return null;
  const pairs=coordinatePairs(geometry.coordinates);if(!pairs.length)return null;
  const lngs=pairs.map(p=>p[0]),lats=pairs.map(p=>p[1]);const point={lat:(Math.min(...lats)+Math.max(...lats))/2,lng:(Math.min(...lngs)+Math.max(...lngs))/2};
  if(point.lat< -90||point.lat>90||point.lng< -180||point.lng>180)return null;
  const label=(raw:unknown,max=240)=>typeof raw==='string'?raw.trim().slice(0,max):'';
  const title=label(properties['name:ru'])||label(properties.name)||`${category[0].toUpperCase()}${category.slice(1)} без названия`;
  const detail=[label(properties['addr:street']),label(properties['addr:housenumber']),label(properties['addr:city'])].filter(Boolean).join(', ');
  const access=String(properties.dog||'');
  return {id:`osm-${osmType}-${osmId}`,title,detail,category,group,point,...(['yes','no','leashed','designated'].includes(access)?{dogAccess:access}:{}),...(geometry.type==='Point'?{}:{pointIsCenter:true})};
}
