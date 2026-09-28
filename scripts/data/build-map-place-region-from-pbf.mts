/** Deterministic offline PBF -> reviewed catalog candidate. Requires osmium-tool, never runs in the app. */
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {parseOsmPoly,normalizeOsmGeoJsonFeature} from '../../lib/geofabrikPlaces';

const [pbfFile,polyFile,id,title,sourceUrl,outputFile]=process.argv.slice(2);
if(!pbfFile||!polyFile||!id||!title||!sourceUrl||!outputFile)throw Error('Usage: tsx scripts/data/build-map-place-region-from-pbf.mts extract.osm.pbf boundary.poly region-id "Title" source-url output.json');
if(!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)||title.length>180)throw Error('Invalid region identity');
const source=new URL(sourceUrl);if(source.protocol!=='https:'||source.username||source.password)throw Error('Public HTTPS source URL required');
async function run(command:string,args:string[],capture=false){return new Promise<{stdout:string;stderr:string}>((resolve,reject)=>{const child=spawn(command,args,{stdio:capture?['ignore','pipe','pipe']:'inherit'});let stdout='',stderr='';if(capture){child.stdout!.on('data',chunk=>stdout+=chunk);child.stderr!.on('data',chunk=>stderr+=chunk);}child.on('error',reject);child.on('exit',code=>code===0?resolve({stdout:stdout.trim(),stderr:stderr.trim()}):reject(Error(`${command} exited ${code}${stderr?`: ${stderr}`:''}`)));});}
async function* jsonSequence(file:string){let buffer='';const decoder=new TextDecoder();for await(const chunk of createReadStream(file)){buffer+=decoder.decode(chunk as Buffer,{stream:true});const records=buffer.split('\u001e');buffer=records.pop()||'';for(const record of records){const value=record.trim();if(value)yield JSON.parse(value);}}buffer+=decoder.decode();const value=buffer.trim();if(value)yield JSON.parse(value);}
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'pso-osm-'));
try{
  const filtered=path.join(temp,'places.osm.pbf'),sequence=path.join(temp,'places.geojsonseq');
  const updatedAt=(await run('osmium',['fileinfo','-g','header.option.osmosis_replication_timestamp',pbfFile],true)).stdout;if(!Number.isFinite(Date.parse(updatedAt)))throw Error('PBF source timestamp is missing');
  await run('osmium',['tags-filter',pbfFile,'nwr/leisure=park,dog_park','nwr/amenity=veterinary,cafe,restaurant','nwr/shop=pet,pet_grooming','-o',filtered,'--overwrite','--no-progress']);
  const geometryOutput=await run('osmium',['export',filtered,'-f','geojsonseq','-a','type,id','-u','type_id','-e','-o',sequence,'--overwrite','--no-progress'],true);
  const geometryErrors=geometryOutput.stderr.split(/\r?\n/).filter(line=>line.includes('Geometry error:')).length;
  const places=[];const ids=new Set<string>();
  for await(const feature of jsonSequence(sequence)){const place=normalizeOsmGeoJsonFeature(feature);if(!place||ids.has(place.id)||(place.group!=='dogParks'&&place.title.endsWith(' без названия')))continue;ids.add(place.id);places.push(place);}
  if(!places.length||places.length>250000)throw Error(`Eligible POI count out of range: ${places.length}`);
  const {coverage,bounds}=parseOsmPoly(await fs.readFile(polyFile,'utf8'));
  const region={id,title,bounds,coverage,updatedAt,sourceUrl:source.href,places,importWarnings:{geometryErrors}};
  await fs.writeFile(outputFile,JSON.stringify({license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',regions:[region]}));
  console.log(JSON.stringify({candidate:outputFile,region:id,count:places.length,updatedAt,geometryErrors,installed:false}));
}finally{await fs.rm(temp,{recursive:true,force:true});}
