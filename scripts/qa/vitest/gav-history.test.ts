import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({context:vi.fn(),owned:vi.fn(),excluded:vi.fn()}));
vi.mock('@/lib/server/socialHttp', () => ({socialRequestContext:mocks.context,socialStorageError:()=>Response.json({error:'STORAGE'},{status:503}),readIdempotencyKey:vi.fn()}));
vi.mock('@/lib/server/socialService', async importOriginal => ({...await importOriginal<typeof import('@/lib/server/socialService')>(),requireOwnedPet:mocks.owned,excludedOwnerIds:mocks.excluded}));
import {GET} from '../../../app/api/social/requests/route';
function database(){
 const calls:{table:string;statuses:string[];ownerFilter:string;limit:number;update:boolean}[]=[];
 const base={sender_pet_id:'a',sender_owner_id:'oa',recipient_pet_id:'b',recipient_owner_id:'ob',source:'signal',scenario:'walk',created_at:'2026-09-07',recipient_contact_username:'verified_contact',recipient_contact_verified_at:new Date().toISOString()};
 return {calls,from(table:string){const call={table,statuses:[] as string[],ownerFilter:'',limit:0,update:false};calls.push(call);
 const chain={select(){return chain;},update(){call.update=true;return chain;},eq(){return chain;},or(value:string){call.ownerFilter=value;return chain;},in(key:string,values:string[]){if(key==='status')call.statuses=values;return chain;},order(){return chain;},limit(n:number){call.limit=n;return chain;},then(resolve:(v:unknown)=>unknown){
 let data:unknown=[];
 if(table==='social_match_requests'&&!call.update)data=call.statuses.includes('rejected')?[{...base,id:'closed',status:'cancelled'}]:[{...base,id:'active',status:'accepted'}];
 if(table==='pets')data=[{id:'b',name:'Луна',avatar_source:'none'}];
 if(table==='social_discovery_profiles')data=[];
 return Promise.resolve({data,error:null}).then(resolve);
 }};return chain;}};
}
beforeEach(()=>{vi.clearAllMocks();mocks.owned.mockResolvedValue(true);mocks.excluded.mockResolvedValue(new Set());});
it('opt-in history does not displace active rows or reveal contacts of closed connections',async()=>{
 const db=database();mocks.context.mockResolvedValue({ownerId:'oa',supabase:db,verifiedTelegramContact:{username:'my_name'}});
 const response=await GET(new Request('http://localhost/api/social/requests?petId=a&history=1'));expect(response.status).toBe(200);
 const body=await response.json();expect(body.requests.map((r:{id:string})=>r.id)).toEqual(['active','closed']);expect(body.requests[0].telegramContactUrl).toBe('https://t.me/verified_contact');expect(body.requests[1].telegramContactUrl).toBeNull();
 const reads=db.calls.filter(c=>c.table==='social_match_requests'&&!c.update);expect(reads.map(c=>c.limit)).toEqual([100,30]);expect(reads.every(c=>c.ownerFilter==='sender_pet_id.eq.a,recipient_pet_id.eq.a')).toBe(true);expect(reads.flatMap(c=>c.statuses)).not.toContain('blocked');
});
it('the default feed remains active-only; excluded owners remain absent even in history',async()=>{
 for(const history of ['', '&history=1']){
 const db=database();mocks.context.mockResolvedValue({ownerId:'oa',supabase:db,verifiedTelegramContact:{username:null}});mocks.excluded.mockResolvedValue(new Set(['ob']));
 const response=await GET(new Request('http://localhost/api/social/requests?petId=a'+history));expect((await response.json()).requests).toEqual([]);
 expect(db.calls.filter(c=>c.table==='social_match_requests'&&!c.update)).toHaveLength(history?2:1);
 }
});
it('history cannot be used to inspect an unowned pet or unauthenticated account',async()=>{
 const db=database();mocks.context.mockResolvedValue({ownerId:'oa',supabase:db,verifiedTelegramContact:{username:null}});mocks.owned.mockResolvedValue(false);
 expect((await GET(new Request('http://localhost/api/social/requests?petId=b&history=1'))).status).toBe(404);expect(db.calls).toHaveLength(0);
 mocks.context.mockResolvedValue({response:Response.json({error:'AUTH'},{status:401})});expect((await GET(new Request('http://localhost/api/social/requests?petId=a&history=1'))).status).toBe(401);
});
