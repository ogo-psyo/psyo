import {beforeEach,describe,it,expect,vi} from 'vitest';
import {emptyMapLibrary,applyLibraryCommand} from '../../../lib/mapLibrary';
const mocks=vi.hoisted(()=>({context:vi.fn(),owned:vi.fn(),blocked:vi.fn()}));
vi.mock('@/lib/server/socialHttp',()=>({socialRequestContext:mocks.context,socialStorageError:()=>Response.json({error:'STORAGE'},{status:503})}));
vi.mock('@/lib/server/socialService',()=>({requireOwnedPet:mocks.owned,isOwnerPairBlocked:mocks.blocked}));
import {GET as getLibrary,POST as changeLibrary} from '../../../app/api/map/library/route';
import {GET as getMeeting,POST as sendMeeting} from '../../../app/api/social/requests/[id]/meeting/route';
type Reply={data?:unknown;error?:unknown};
function database(replies:Record<string,Reply[]>){
 const calls:{table:string;action:string;filters:unknown[]}[]=[];
 return {calls,from(table:string){const call={table,action:'select',filters:[] as unknown[]};calls.push(call);let resolved=false;let reply:Reply;
  function result(){if(!resolved){resolved=true;reply=replies[table]?.shift()||{data:null,error:null};}return Promise.resolve(reply);}
  const chain={select(){return chain;},insert(){call.action='insert';return chain;},update(){call.action='update';return chain;},eq(k:string,v:unknown){call.filters.push([k,v]);return chain;},in(k:string,v:unknown){call.filters.push([k,v]);return chain;},order(){return chain;},limit(){return chain;},maybeSingle:result,then(resolve:(v:Reply)=>unknown){return result().then(resolve);}};return chain;
 }};
}
const command={id:'command-one',kind:'createCollection' as const,collectionId:'parks',title:'Парки'};
const req=(body:unknown)=>new Request('http://localhost/api/map/library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const connection={id:'connection',status:'accepted',source:'signal',sender_owner_id:'owner-a',recipient_owner_id:'owner-b',sender_pet_id:'pet-a',recipient_pet_id:'pet-b'};
const ctx={params:Promise.resolve({id:'connection'})};
beforeEach(()=>{vi.clearAllMocks();mocks.owned.mockResolvedValue({id:'pet-a'});mocks.blocked.mockResolvedValue(false);});
describe('private library API boundary and concurrent edits',()=>{
 it('does not access storage without a principal',async()=>{mocks.context.mockResolvedValue({response:Response.json({error:'AUTH'},{status:401})});expect((await getLibrary(new Request('http://localhost/api/map/library?petId=pet-a'))).status).toBe(401);expect(mocks.owned).not.toHaveBeenCalled();});
 it('rejects another dog before reading its library',async()=>{const db=database({});mocks.context.mockResolvedValue({supabase:db,ownerId:'owner-a'});mocks.owned.mockResolvedValue(null);expect((await changeLibrary(req({petId:'pet-b',command}))).status).toBe(404);expect(db.calls).toHaveLength(0);});
 it('retries a lost CAS against the latest revision and preserves the other edit',async()=>{
  const initial=emptyMapLibrary(),other=applyLibraryCommand(initial,{id:'other',kind:'createCollection',collectionId:'other',title:'Дворы'});
  const db=database({map_libraries:[{data:{document:initial,revision:initial.version}},{data:null},{data:{document:other,revision:other.version}},{data:{revision:other.version+1}}]});mocks.context.mockResolvedValue({supabase:db,ownerId:'owner-a'});
  const response=await changeLibrary(req({petId:'pet-a',command}));expect(response.status).toBe(200);expect((await response.json()).library.collections.map((c:{id:string})=>c.id)).toEqual(['saved','other','parks']);expect(db.calls.filter(c=>c.action==='update')).toHaveLength(2);expect(db.calls.every(c=>c.filters.some(f=>JSON.stringify(f)==='["owner_id","owner-a"]'))).toBe(true);
 });
 it('a confirmed command replay performs no second write',async()=>{const done=applyLibraryCommand(emptyMapLibrary(),command);const db=database({map_libraries:[{data:{document:done,revision:done.version}}]});mocks.context.mockResolvedValue({supabase:db,ownerId:'owner-a'});expect((await (await changeLibrary(req({petId:'pet-a',command}))).json()).replayed).toBe(true);expect(db.calls).toHaveLength(1);});
});
describe('meeting proposals require current mutual permission',()=>{
 it('rejects an unrelated owner without projecting a snapshot',async()=>{const db=database({social_match_requests:[{data:connection}]});mocks.context.mockResolvedValue({supabase:db,ownerId:'stranger'});expect((await getMeeting(new Request('http://localhost'),ctx)).status).toBe(404);expect(db.calls).toHaveLength(1);});
 it('rejects a closed connection and a blocked pair',async()=>{for(const blocked of [false,true]){const db=database({social_match_requests:[{data:{...connection,status:blocked?'accepted':'cancelled'}}]});mocks.context.mockResolvedValue({supabase:db,ownerId:'owner-a'});mocks.blocked.mockResolvedValue(blocked);expect((await getMeeting(new Request('http://localhost'),ctx)).status).toBe(404);expect(db.calls).toHaveLength(1);}});
 it('hides previously shared geometry if the source was deleted',async()=>{const db=database({social_match_requests:[{data:connection}],social_meeting_proposals:[{data:[{id:'proposal',author_owner_id:'owner-b',author_pet_id:'pet-b',kind:'route',source_id:'route',snapshot:{points:[[37,55],[38,56]]},fingerprint:'old',created_at:'2026-09-07'}]}],map_routes:[{data:null}]});mocks.context.mockResolvedValue({supabase:db,ownerId:'owner-a'});const response=await getMeeting(new Request('http://localhost'),ctx);const body=await response.json();expect(body.proposals[0]).toMatchObject({status:'changed_or_unavailable',preview:null});expect(JSON.stringify(body)).not.toContain('owner-b');expect(response.headers.get('Cache-Control')).toBe('private, no-store');});
 it('cannot send using a forged preview confirmation',async()=>{const lib=emptyMapLibrary();lib.places.push({id:'place',title:'Парк',detail:'',category:'park',point:{lat:55,lng:37},source:{provider:'user',id:'place'},note:'PRIVATE NOTE'});const db=database({social_match_requests:[{data:connection}],map_libraries:[{data:{document:lib}}]});mocks.context.mockResolvedValue({supabase:db,ownerId:'owner-a'});const response=await sendMeeting(req({action:'send',kind:'place',sourceId:'place',confirmed:true,fingerprint:'forged',id:'00000000-0000-4000-8000-000000000001'}),ctx);expect(response.status).toBe(409);expect(db.calls.some(c=>c.action==='insert')).toBe(false);});
});

describe('meeting point without private-library side effects', () => {
 const point = { id:'11111111-1111-4111-8111-111111111111', title:'У пруда', lat:55.7, lng:37.6, note:'PRIVATE', ownerId:'OTHER_OWNER' };
 it('previews only the selected public point, then sends without creating a saved place', async () => {
  const db = database({ social_match_requests:[{data:connection},{data:connection}], social_meeting_proposals:[{data:null,error:null}] });
  mocks.context.mockResolvedValue({supabase:db,ownerId:'owner-a'});
  const response = await sendMeeting(req({action:'preview',kind:'point',point}),ctx);
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.preview).toEqual({kind:'place',origin:'selected-point',title:'У пруда',detail:'Точка, выбранная для встречи',points:[[37.6,55.7]],sourceId:point.id});
  expect(JSON.stringify(body)).not.toMatch(/PRIVATE|OTHER_OWNER/);
  expect(db.calls.some(call=>call.action==='insert')).toBe(false);
  const sent = await sendMeeting(req({action:'send',kind:'point',point,fingerprint:body.fingerprint,confirmed:true,id:'22222222-2222-4222-8222-222222222222'}),ctx);
  expect(sent.status).toBe(200);
  expect(db.calls.filter(call=>call.action==='insert')).toHaveLength(1);
  expect(db.calls.some(call=>call.table==='map_libraries')).toBe(false);
 });
 it('rejects invalid coordinates before any write', async () => {
  const db=database({social_match_requests:[{data:connection}]});mocks.context.mockResolvedValue({supabase:db,ownerId:'owner-a'});
  expect((await sendMeeting(req({action:'preview',kind:'point',point:{...point,lat:91}}),ctx)).status).toBe(409);
  expect(db.calls.some(call=>call.action==='insert')).toBe(false);
 });
 it('does not accept a changed point with the previous confirmation', async () => {
  const db=database({social_match_requests:[{data:connection},{data:connection}]});mocks.context.mockResolvedValue({supabase:db,ownerId:'owner-a'});
  const preview=await (await sendMeeting(req({action:'preview',kind:'point',point}),ctx)).json();
  const response=await sendMeeting(req({action:'send',kind:'point',point:{...point,lng:38},fingerprint:preview.fingerprint,confirmed:true,id:'22222222-2222-4222-8222-222222222222'}),ctx);
  expect(response.status).toBe(409);expect(db.calls.some(call=>call.action==='insert')).toBe(false);
 });
});
