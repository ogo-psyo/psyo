import {test,expect,vi,beforeEach} from 'vitest';
import {RunContext} from '@openai/agents';
const ids={pet:'11111111-1111-4111-8111-111111111111',route:'22222222-2222-4222-8222-222222222222'};
const state=vi.hoisted(()=>({owner:'owner-a',session:null as null|{ownerId:string},status:'running',fail:'',calls:[] as string[],rows:{} as Record<string,Record<string,unknown>[]>}));
vi.mock('@/lib/server/auth',()=>({getRequestAuth:async()=>({user:state.owner?{id:state.owner}:null})}));
vi.mock('@/lib/server/appSession',()=>({getAppSessionFromRequest:()=>state.session}));
vi.mock('@/lib/server/supabase',()=>({getSupabaseAdmin:()=>({from:(table:string)=>{
 state.calls.push(table);const filters:Array<(r:Record<string,unknown>)=>boolean>=[];
 const q={select:()=>q,eq:(key:string,value:unknown)=>{filters.push(r=>r[key]===value);return q;},maybeSingle:async()=>({data:state.fail===table?null:state.rows[table]?.find(r=>filters.every(f=>f(r)))??null,error:state.fail===table?{code:'TEST_FAILURE'}:null})};return q;
}})}));
vi.mock('@/lib/server/agent/access',()=>({agentDatabase:()=>({}),ownedRun:async()=>({status:state.status,pet_id:'11111111-1111-4111-8111-111111111111'})}));
import {GET} from '@/app/api/map/features/[id]/route';
import {makePrivateTools} from '@/lib/server/agent/tools';
const path=[[37.6,55.75],[37.61,55.75],[37.62,55.76],[37.63,55.76]];
beforeEach(()=>{state.owner='owner-a';state.session=null;state.status='running';state.fail='';state.calls=[];
 state.rows={pets:[{id:ids.pet,owner_id:'owner-a'}],map_routes:[{id:ids.route,owner_id:'owner-a',pet_id:ids.pet,title:'Записанная прогулка',description:'У пруда была вода',path:{type:'LineString',coordinates:path},path_gaps:[2],route_source:'recorded',distance_meters:1500,visibility:'private'}]};});
const get=(pet=ids.pet)=>GET(new Request(`http://localhost/api/map/features/${ids.route}?petId=${pet}`),{params:Promise.resolve({id:ids.route})});
test('fresh canonical read retains geometry, GPS gaps and note without exposing storage fields',async()=>{
 const response=await get();expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');
 const {route}=await response.json();expect(route).toMatchObject({id:ids.route,petId:ids.pet,description:'У пруда была вода',pathGaps:[2],routeSource:'recorded',path:{coordinates:path}});expect(route).not.toHaveProperty('owner_id');
});
test('anonymous/mismatched identity fails before data reads',async()=>{
 state.owner='';expect((await get()).status).toBe(401);state.owner='owner-a';state.session={ownerId:'other'};expect((await get()).status).toBe(401);expect(state.calls).toEqual([]);
});
test('deleted, foreign route or pet is unavailable rather than a cached reconstruction',async()=>{
 state.rows.map_routes[0].owner_id='other';expect((await get()).status).toBe(404);
 state.rows.map_routes=[];expect((await get()).status).toBe(404);
 state.rows.pets[0].owner_id='other';state.calls=[];expect((await get()).status).toBe(404);expect(state.calls).toEqual(['pets']);
});
test('storage failures return retryable errors, not missing routes',async()=>{
 state.fail='map_routes';expect((await get()).status).toBe(503);state.fail='pets';expect((await get()).status).toBe(503);
});
test('read tool adds a canonical reference only after successful read and run guard',async()=>{
 const refs:Array<{id:string;title:string}>=[];const tool=makePrivateTools('owner-a',ids.pet,'run',[],[],undefined,{previousPlaces:[]},refs).find(t=>t.name==='read_walk')!;
 const call=()=>tool.invoke(new RunContext(),JSON.stringify({id:ids.route}));
 const result=await call();expect(result).toMatchObject({id:ids.route,saved:true,hasGpsGaps:true});expect(result).not.toHaveProperty('path');expect(refs).toEqual([{id:ids.route,title:'Записанная прогулка'}]);
 refs.length=0;state.status='cancelled';await call();expect(refs).toEqual([]);state.status='running';state.rows.map_routes=[];await call();expect(refs).toEqual([]);
});
