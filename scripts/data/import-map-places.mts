/** Offline import only. Never calls public geocoding/Overpass on behalf of app users. */
import fs from 'node:fs/promises';
import {normalizeOsmPlaces} from '../../lib/osmPlaces';
import {parsePlaceBounds,type PlaceRegion} from '../../lib/placeDiscovery';
const [sourceFile, manifestFile, outputFile]=process.argv.slice(2);
if(!sourceFile||!manifestFile||!outputFile)throw Error('Usage: tsx scripts/data/import-map-places.mts source.json region-manifest.json output-catalog.json');
if((await fs.stat(sourceFile)).size>8_000_000)throw Error('Extract exceeds 8MB import limit; split documented regions before import.');
const source=JSON.parse(await fs.readFile(sourceFile,'utf8'));
const manifest=JSON.parse(await fs.readFile(manifestFile,'utf8'));
if(source.remark||!Array.isArray(source.elements))throw Error('Incomplete OSM extract');
if(!/^[a-z0-9-]{1,80}$/.test(manifest.id)||typeof manifest.title!=='string'||!manifest.title.trim()||manifest.title.length>180)throw Error('Invalid region identity');
const b=manifest.bounds;
const bounds=b&&parsePlaceBounds([b.south,b.west,b.north,b.east].join(','));
if(!bounds)throw Error('Explicit valid coverage is required');
const sourceUrl=new URL(manifest.sourceUrl);if(sourceUrl.protocol!=='https:'||sourceUrl.username||sourceUrl.password)throw Error('Public HTTPS source URL required');
if(typeof source.osm3s?.timestamp_osm_base!=='string'||!Number.isFinite(Date.parse(source.osm3s.timestamp_osm_base)))throw Error('Source timestamp required');
const places=normalizeOsmPlaces(source.elements,bounds);
if(!places.length||places.length>25000)throw Error('Import must contain 1–25000 eligible POIs');
const region:PlaceRegion={id:manifest.id,title:manifest.title,bounds,updatedAt:source.osm3s.timestamp_osm_base,sourceUrl:sourceUrl.href,places};
// Candidate output only: review coverage/counts/age, then explicitly add to the runtime catalog.
await fs.writeFile(outputFile,JSON.stringify({license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',regions:[region]}));
console.log(JSON.stringify({candidate:outputFile,region:region.id,count:places.length,updatedAt:region.updatedAt,coverage:bounds,installed:false}));
