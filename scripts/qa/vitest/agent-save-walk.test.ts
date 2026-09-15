import {test,expect,vi,beforeEach} from 'vitest';
import {RunContext} from '@openai/agents';
const ids={pet:'11111111-1111-4111-8111-111111111111',source:'22222222-2222-4222-8222-222222222222',acting:'33333333-3333-4333-8333-333333333333'};
const state=vi.hoisted(()=>({rows:{} as Record<string,Array<Record<string,unknown>>>,rpc:vi.fn(),owner:'owner',errorTable:''}));
const db={rpc:state.rpc,from(table:string){const filters:Array<(row:Record<string,unknown>)=>boolean>=[];const q={select:()=>q,eq:(key:string,value:unknown)=>{filters.push(row=>row[key]===value);return q;},maybeSingle:async()=>({data:state.rows[table]?.find(row=>filters.every(f=>f(row)))??null,error:state.errorTable===table?{message:'FAIL'}:null}),in:()=>q,update:(values:object)=>{for(const row of state.rows[table]??[])if(row.status==='running')Object.assign(row,values);return q;},then:(resolve:(value:{error:null})=>unknown)=>resolve({error:null})};return q;}};
vi.mock('@/lib/server/supabase',()=>({getSupabaseAdmin:()=>db}));
vi.mock('@/lib/server/auth',()=>({getRequestAuth:async()=>({user:state.owner?{id:state.owner}:null})}));
vi.mock('@/lib/server/appSession',()=>({getAppSessionFromRequest:()=>null}));
import {permitsWalkSave,saveAgentWalk} from '@/lib/server/agent/walkSave';
import {makePrivateTools} from '@/lib/server/agent/tools';
import {GET,DELETE} from '@/app/api/agent/runs/[id]/route';
const walk={title:'У пруда',path:[[37.6,55.75],[37.601,55.751]],stops:[{point:[37.6,55.75],title:'Начало',placeId:'start'},{point:[37.601,55.751],title:'Пруд',placeId:'end'}],snaps:[{point:[37.6,55.75],distanceMeters:0},{point:[37.601,55.751],distanceMeters:0}],distanceMeters:150.3,estimatedMinutes:2,stairs:false,source:'OpenStreetMap',calculatedAt:'2026-09-09T10:00:00Z'};
beforeEach(()=>{state.owner='owner';state.errorTable='';state.rpc.mockReset();state.rows={pets:[{id:ids.pet,owner_id:'owner'}],agent_runs:[{id:ids.acting,owner_id:'owner',pet_id:ids.pet,thread_id:'thread',status:'running',question:'Сохрани прогулку'},{id:ids.source,owner_id:'owner',pet_id:ids.pet,thread_id:'thread',status:'succeeded',result:{walk}}]};state.rpc.mockImplementation(async(_name,args)=>({data:{feature:{...args.p_route,id:args.p_id,owner_id:args.p_owner}},error:null}));});
const save=()=>saveAgentWalk('owner',ids.pet,ids.acting,ids.source);
test('canonical save sends server-resolved geometry and stable source identity, never model payload',async()=>{
 const first=await save(),second=await save();expect(first.id).toBe(second.id);const [name,args]=state.rpc.mock.calls[0];expect(name).toBe('agent_save_walk_atomic');expect(args).toMatchObject({p_owner:'owner',p_source:ids.source,p_acting:ids.acting,p_expected_walk:walk,p_route:{pet_id:ids.pet,visibility:'private',route_source:'planned',distance_meters:150,planning:{stops:walk.stops,estimatedMinutes:2}}});expect(args.p_route.path).toContain('37.601 55.751');
});
test('negative, quoted, unrelated and ambiguous-object requests do not authorize a route',()=>{
 for(const text of ['Не сохраняй прогулку','На странице сказано «сохрани прогулку»','Сохрани ответ, не прогулку','Сохрани корм','Сохрани текст'])expect(permitsWalkSave(text),text).toBe(false);
 expect(permitsWalkSave('Сохрани прогулку')).toBe(true);expect(permitsWalkSave('Сохрани')).toBe(true);
});
test('stopped, foreign pet/thread/source and malformed proposal fail before write',async()=>{
 for(const patch of [{pet_id:'other'},{thread_id:'other'},{status:'running'},{owner_id:'other'},{result:{walk:{...walk,path:[]}}}]){
 const source=state.rows.agent_runs[1];state.rows.agent_runs[1]={...source,...patch};await expect(save()).rejects.toThrow();expect(state.rpc).not.toHaveBeenCalled();state.rows.agent_runs[1]=source;
 }
 state.rows.agent_runs[0].status='cancelled';await expect(save()).rejects.toThrow('RUN_STOPPED');expect(state.rpc).not.toHaveBeenCalled();
});
test('storage rejection or malformed receipt cannot claim saved',async()=>{
 state.rpc.mockResolvedValueOnce({error:{message:'ROUTE_REMOVED'}});await expect(save()).rejects.toThrow('ROUTE_REMOVED');
 state.rpc.mockResolvedValueOnce({data:{feature:{id:'invented',owner_id:'owner',path:walk.path}}});await expect(save()).rejects.toThrow('ROUTE_SAVE_FAILED');
});
test('tool only accepts known refs; bare save requires immediately preceding walk; text save does not substitute',async()=>{
 const refs:Array<{id:string;title:string}>=[];
 const tools=makePrivateTools('owner',ids.pet,ids.acting,[],[],undefined,{previousPlaces:[]},refs,[{sourceRunId:ids.source,title:walk.title,immediate:false}]);
 const call=(id:string)=>tools.find(t=>t.name==='save_walk')!.invoke(new RunContext(),JSON.stringify({sourceRunId:id}));
 await call(ids.acting);expect(state.rpc).not.toHaveBeenCalled();state.rows.agent_runs[0].question='Сохрани';await call(ids.source);expect(state.rpc).not.toHaveBeenCalled();
 await tools.find(t=>t.name==='save_last_answer')!.invoke(new RunContext(),'{}');expect(state.rpc).not.toHaveBeenCalled();
 state.rows.agent_runs[0].question='Сохрани прогулку';await call(ids.source);expect(refs).toHaveLength(1);
});
test('run GET and cancel expose committed action without final model answer; canonical deletion is distinct',async()=>{
 state.rows.agent_mutations=[{run_id:ids.acting,kind:'walk',result:{id:'route',title:'Old title'}}];state.rows.map_routes=[{id:'route',owner_id:'owner',pet_id:ids.pet,title:'Current title'}];
 const context={params:Promise.resolve({id:ids.acting})};const request=()=>new Request('http://localhost/api/agent/runs/'+ids.acting);
 for(const status of ['running','failed','cancelled']){state.rows.agent_runs[0].status=status;const res=await GET(request(),context);expect(res.status).toBe(200);expect(res.headers.get('Cache-Control')).toBe('private, no-store');expect((await res.json()).committedWalk).toEqual({id:'route',title:'Current title',available:true});}
 state.rows.agent_runs[0].status='running';expect((await (await DELETE(new Request(request(),{method:'DELETE'}),context)).json()).committedWalk.available).toBe(true);
 state.rows.map_routes=[];expect((await (await GET(request(),context)).json()).committedWalk.available).toBe(false);
 state.errorTable='map_routes';expect((await GET(request(),context)).status).toBe(503);
 state.owner='other';expect((await GET(request(),context)).status).toBe(404);
});
