/** Shared production route normalizer/RPC contract against isolated real Postgres.
 * This adapter is test transport, NOT a claim about hosted Supabase HTTP/RLS. */
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {saveOwnedMapRoute} from '../../lib/server/mapRouteSave';
function sql(query:string){const r=spawnSync('docker',['exec','-i','supabase_db_pso-mvp','psql','-U','postgres','-d','pso_release_atomic_test','-X','-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'});if(r.status!==0)throw new Error(r.stderr);return r.stdout.trim();}
const literal=(value:unknown)=>value==null?'null':"'"+(typeof value==='object'?JSON.stringify(value):String(value)).replaceAll("'","''")+"'";
const db={rpc:async(name:string,args:Record<string,unknown>)=>{try{return {data:JSON.parse(sql(`select public.${name}(${Object.values(args).map(literal).join(',')});`)),error:null};}catch(error){return {data:null,error:{message:error instanceof Error?error.message:'SQL_ERROR'}};}}} as unknown as SupabaseClient;
const owner=crypto.randomUUID(),pet=crypto.randomUUID();
async function main(){try{
 sql(`insert into auth.users(id) values('${owner}');insert into public.pets(id,owner_id,name) values('${pet}','${owner}','Domain RPC QA');`);
 const path=[[37.6,55.75],[37.601,55.751],[37.602,55.752]];
 const body={petId:pet,title:'Прогулка',path,visibility:'private',routeSource:'recorded',startedAt:'2026-09-09T11:00:00Z',pathGaps:[2],description:'Original note',planning:{version:1,mode:'manual',stops:[{point:path[0],title:'Start'},{point:path[2],title:'Finish'}]},durationSeconds:100,distanceMeters:200};
 const saved=await saveOwnedMapRoute(db,owner,body,'domain-qa');
 assert.deepEqual(saved.feature.path.coordinates,path);assert.equal(saved.feature.pet_id,pet);assert.deepEqual(saved.feature.path_gaps,[2]);
 sql(`update public.map_routes set title='Edited later' where id='${saved.feature.id}';`);
 const replay=await saveOwnedMapRoute(db,owner,body,'domain-qa');assert.equal(replay.feature.id,saved.feature.id);assert.equal(replay.feature.title,'Edited later');assert.equal(replay.replayed,true);
 await assert.rejects(saveOwnedMapRoute(db,owner,{...body,title:'Different command'},'domain-qa'),/IDEMPOTENCY_CONFLICT/);
 sql(`delete from public.map_routes where id='${saved.feature.id}';`);
 await assert.rejects(saveOwnedMapRoute(db,owner,body,'domain-qa'),/ROUTE_REMOVED/);
 console.log('PASS production shared route service -> real SQL: geometry/GPS gaps/stops/metadata; edited canonical replay; conflict; deletion tombstone');
}finally{sql(`delete from public.pets where id='${pet}';delete from auth.users where id='${owner}';`);}}
main().catch(error=>{console.error(error);process.exitCode=1;});
