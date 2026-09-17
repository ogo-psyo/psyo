import {beforeEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({context:vi.fn(),owned:vi.fn(),excluded:vi.fn(),rpc:vi.fn()}));
vi.mock('@/lib/server/socialHttp',()=>({socialRequestContext:mocks.context}));
vi.mock('@/lib/server/socialService',async original=>({...await original<object>(),requireOwnedPet:mocks.owned,excludedOwnerIds:mocks.excluded}));
import {GET,PUT,DELETE} from '@/app/api/map/live/route';
const date=(offset:number)=>new Date(Date.now()+offset).toISOString();
let rows:Record<string,Record<string,unknown>[]>;
let owner:string;
const client={rpc:mocks.rpc,from:(table:string)=>{
 let data=[...(rows[table]||[])];let update:Record<string,unknown>|null=null;let remove=false;
 const query={select:()=>query,eq:(k:string,v:unknown)=>{data=data.filter(r=>r[k]===v);return query;},gt:(k:string,v:unknown)=>{data=data.filter(r=>String(r[k])>String(v));return query;},gte:(k:string,v:number)=>{data=data.filter(r=>Number(r[k])>=v);return query;},lte:(k:string,v:number)=>{data=data.filter(r=>Number(r[k])<=v);return query;},limit:()=>query,update:(value:Record<string,unknown>)=>{update=value;return query;},delete:()=>{remove=true;return query;},then:(resolve:(v:unknown)=>unknown)=>{if(update)data.forEach(r=>Object.assign(r,update));if(remove)rows[table]=rows[table].filter(r=>!data.includes(r));return Promise.resolve({data,error:null}).then(resolve);}};return query;
}};
beforeEach(()=>{
 vi.clearAllMocks();owner='A';mocks.context.mockImplementation(async()=>({supabase:client,ownerId:owner}));mocks.owned.mockImplementation(async(_s,o,p)=>p===`pet-${o}`?{id:p}:null);mocks.excluded.mockResolvedValue(new Set(['blocked']));mocks.rpc.mockResolvedValue({data:{ok:true},error:null});
 const signal=(id:string,o:string,expiresAt=date(60000))=>({id,owner_id:o,pet_id:`pet-${o}`,status:'active',city:'world',coarse_lat:55.75,coarse_lng:37.62,starts_at:date(-1000),expires_at:expiresAt,pace:'balanced',private_note:'DO NOT EXPOSE',pets:{name:`Dog ${o}`,avatar_source:'none',social_profiles:{temperament:'Спокойный'},owner_phone:'DO NOT EXPOSE'}});
 rows={social_walk_signals:[signal('one','A'),signal('two','blocked'),signal('expired','A',date(-60000))],map_hazards:[{id:'glass',owner_id:'A',title:'Стекло',lat:55.75,lng:37.62,radius:50,expires_at:date(60000)}]};
});
const request=(method:string,body?:unknown)=>new Request('http://localhost/api/map/live?petId=pet-B&lat=55.75&lng=37.62',{method,headers:{'Content-Type':'application/json','Idempotency-Key':'fixture-request'},...(body?{body:JSON.stringify(body)}:{})});
it('second account sees active public card and hazard, no blocked/expired pins or private fields',async()=>{
 owner='B';const response=await GET(request('GET'));expect(response.status).toBe(200);const body=await response.json();expect(body.signals).toHaveLength(1);expect(body.signals[0]).toMatchObject({id:'one',name:'Dog A',isMine:false,privacyRadiusMeters:700});expect(body.signals[0].approximateLocation).not.toEqual({lat:55.75,lng:37.62});expect(body.hazards[0]).toMatchObject({id:'glass',isMine:false});expect(JSON.stringify(body)).not.toContain('DO NOT EXPOSE');
});
it('foreign removal leaves mark; owner removal disappears for second viewer',async()=>{
 owner='B';await DELETE(request('DELETE',{kind:'hazard',id:'glass'}));expect(rows.map_hazards).toHaveLength(1);
 owner='A';await DELETE(request('DELETE',{kind:'hazard',id:'glass'}));owner='B';expect((await (await GET(request('GET'))).json()).hazards).toHaveLength(0);
});
it('publishing checks pet ownership and coarsens coordinates before the atomic RPC',async()=>{
 const payload={kind:'presence',petId:'pet-B',lat:55.75123,lng:37.62123,minutes:45};expect((await PUT(request('PUT',payload))).status).toBe(404);expect(mocks.rpc).not.toHaveBeenCalled();
 owner='B';expect((await PUT(request('PUT',payload))).status).toBe(200);expect(mocks.rpc).toHaveBeenCalledWith('map_publish_signal',expect.objectContaining({p_owner:'B',p_pet:'pet-B',p_lat:55.75,p_lng:37.62,p_key:'fixture-request'}));
});
it('anonymous access is refused before any read or write',async()=>{mocks.context.mockResolvedValue({response:Response.json({error:'AUTH_REQUIRED'},{status:401})});expect((await GET(request('GET'))).status).toBe(401);expect((await PUT(request('PUT',{petId:'pet-A'}))).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();});
