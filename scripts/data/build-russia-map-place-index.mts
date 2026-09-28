/** Sequential Geofabrik runner: bounded disk use, checksum verification, one reviewed catalog per extract. */
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const [workDirectory,outputDirectory]=process.argv.slice(2);
if(!workDirectory||!outputDirectory)throw Error('Usage: tsx scripts/data/build-russia-map-place-index.mts work-directory output-directory');
const regions=[
  ['central-fed-district','central-federal-district','Центральный федеральный округ'],
  ['crimean-fed-district','crimean-federal-district','Крымский федеральный округ'],
  ['far-eastern-fed-district','far-eastern-federal-district','Дальневосточный федеральный округ'],
  ['north-caucasus-fed-district','north-caucasus-federal-district','Северо-Кавказский федеральный округ'],
  ['northwestern-fed-district','northwestern-federal-district','Северо-Западный федеральный округ'],
  ['siberian-fed-district','siberian-federal-district','Сибирский федеральный округ'],
  ['south-fed-district','southern-federal-district','Южный федеральный округ'],
  ['ural-fed-district','ural-federal-district','Уральский федеральный округ'],
  ['volga-fed-district','volga-federal-district','Приволжский федеральный округ'],
  ['kaliningrad','kaliningrad-oblast','Калининградская область'],
] as const;
await fs.mkdir(workDirectory,{recursive:true});await fs.mkdir(outputDirectory,{recursive:true});
async function run(command:string,args:string[]){return new Promise<void>((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${command} exited ${code}`)));});}
async function md5(file:string){const hash=crypto.createHash('md5');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
const catalogs:string[]=[];
for(const [slug,id,title] of regions){
  const base=`https://download.geofabrik.de/russia/${slug}-latest`,pbf=path.join(workDirectory,`${slug}.osm.pbf`),poly=path.join(workDirectory,`${slug}.poly`),checksum=path.join(workDirectory,`${slug}.md5`),catalog=path.join(outputDirectory,`${slug}.json`);
  console.log(JSON.stringify({stage:'download',region:id}));
  await run('curl',['--http1.1','-fsSL','--retry','5','--retry-all-errors','-o',checksum,`${base}.osm.pbf.md5`]);
  const expected=(await fs.readFile(checksum,'utf8')).trim().split(/\s+/)[0].toLowerCase();if(!/^[a-f0-9]{32}$/.test(expected))throw Error(`Invalid checksum for ${id}`);
  const current=await fs.stat(pbf).then(()=>md5(pbf)).catch(()=>null);
  if(current!==expected)await run('curl',['--http1.1','-fsSL','--retry','5','--retry-all-errors','--continue-at','-','-o',pbf,`${base}.osm.pbf`]);
  await run('curl',['--http1.1','-fsSL','--retry','5','--retry-all-errors','-o',poly,`${base.replace('-latest','')}.poly`]);
  const actual=await md5(pbf);if(actual!==expected)throw Error(`Checksum mismatch for ${id}`);
  console.log(JSON.stringify({stage:'extract',region:id,bytes:(await fs.stat(pbf)).size}));
  await run(process.execPath,['--import','tsx',path.resolve('scripts/data/build-map-place-region-from-pbf.mts'),pbf,poly,id,title,`https://download.geofabrik.de/russia/${slug}.html`,catalog]);
  catalogs.push(catalog);await fs.rm(pbf,{force:true});await fs.rm(checksum,{force:true});
}
const manifest={license:'ODbL-1.0',attribution:'© OpenStreetMap contributors',generatedAt:new Date().toISOString(),catalogs};
await fs.writeFile(path.join(outputDirectory,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify({stage:'complete',regions:catalogs.length,manifest:path.join(outputDirectory,'manifest.json')}));
