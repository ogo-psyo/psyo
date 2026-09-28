/** Loads reviewed regional catalog files into PostGIS. Reads credentials only from process env. */
import fs from 'node:fs/promises';
import pg from 'pg';
import type {DiscoveredPlace} from '../../lib/placeDiscovery';
import {validateMapPlaceRegion,type MapPlaceImportRegion} from '../../lib/mapPlaceIndexImport';

const files=process.argv.slice(2);
const databaseUrl=process.env.DATABASE_URL||process.env.POSTGRES_URL_NON_POOLING;
if(!files.length)throw Error('Usage: DATABASE_URL=... tsx scripts/data/load-map-place-index.mts catalog.json [...]');
if(!databaseUrl)throw Error('DATABASE_URL or POSTGRES_URL_NON_POOLING is required');
const client=new pg.Client({connectionString:databaseUrl});
async function insertBatch(region:MapPlaceImportRegion,places:DiscoveredPlace[]){
  const values:string[]=[];const parameters:unknown[]=[];
  for(const place of places){const at=parameters.length;values.push(`($${at+1},$${at+2},$${at+3},$${at+4},$${at+5},public.st_setsrid(public.st_makepoint($${at+6},$${at+7}),4326),$${at+8},$${at+9},$${at+10})`);parameters.push(place.id,place.title,place.detail,place.category,place.group,place.point.lng,place.point.lat,place.dogAccess||null,place.pointIsCenter===true,region.updatedAt);}
  await client.query(`insert into map_place_import_stage(id,title,detail,category,group_key,point,dog_access,point_is_center,source_updated_at) values ${values.join(',')}`,parameters);
}
async function load(region:MapPlaceImportRegion){
  if(!validateMapPlaceRegion(region))throw Error(`Invalid reviewed region: ${region?.id||'unknown'}`);
  await client.query('begin');
  try{
    await client.query(`select pg_advisory_xact_lock(hashtext('pso-map-place-index-import'))`);
    await client.query(`create temporary table map_place_import_stage (like public.map_place_index including defaults) on commit drop`);
    for(let i=0;i<region.places.length;i+=500)await insertBatch(region,region.places.slice(i,i+500));
    await client.query(`insert into public.map_place_index(id,title,detail,category,group_key,point,dog_access,point_is_center,source_updated_at,indexed_at)
      select id,title,detail,category,group_key,point,dog_access,point_is_center,source_updated_at,clock_timestamp() from map_place_import_stage
      on conflict(id) do update set title=excluded.title,detail=excluded.detail,category=excluded.category,group_key=excluded.group_key,point=excluded.point,dog_access=excluded.dog_access,point_is_center=excluded.point_is_center,source_updated_at=excluded.source_updated_at,indexed_at=excluded.indexed_at
      where excluded.source_updated_at>=public.map_place_index.source_updated_at`);
    const b=region.bounds;
    const coverage=region.coverage||{type:'MultiPolygon',coordinates:[[[[b.west,b.south],[b.east,b.south],[b.east,b.north],[b.west,b.north],[b.west,b.south]]]]};
    await client.query(`insert into public.map_place_regions(id,title,bounds,source_url,source_updated_at,imported_at,place_count)
      values($1,$2,public.st_multi(public.st_setsrid(public.st_geomfromgeojson($3),4326)),$4,$5,clock_timestamp(),$6)
      on conflict(id) do update set title=excluded.title,bounds=excluded.bounds,source_url=excluded.source_url,source_updated_at=excluded.source_updated_at,imported_at=excluded.imported_at,place_count=excluded.place_count`,[region.id,region.title,JSON.stringify(coverage),region.sourceUrl,region.updatedAt,region.places.length]);
    await client.query('delete from public.map_place_region_members where region_id=$1',[region.id]);
    await client.query('insert into public.map_place_region_members(region_id,place_id) select $1,id from map_place_import_stage',[region.id]);
    await client.query('delete from public.map_place_index place where not exists(select 1 from public.map_place_region_members member where member.place_id=place.id)');
    await client.query('commit');
    console.log(JSON.stringify({region:region.id,places:region.places.length,updatedAt:region.updatedAt}));
  }catch(error){await client.query('rollback');throw error;}
}
await client.connect();
try{for(const file of files){const payload=JSON.parse(await fs.readFile(file,'utf8'));if(payload.license!=='ODbL-1.0'||!Array.isArray(payload.regions))throw Error(`Invalid catalog: ${file}`);for(const region of payload.regions)await load(region);}}finally{await client.end();}
