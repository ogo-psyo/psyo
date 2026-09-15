import {test,expect,vi,beforeEach} from 'vitest';
import {reminderTiming,reminderReceipt} from '@/lib/reminder';
const state=vi.hoisted(()=>({rpc:vi.fn(),owner:'owner',session:null as null|{ownerId:string},ready:true}));
vi.mock('@/lib/server/auth',()=>({getRequestAuth:async()=>({user:state.owner?{id:state.owner}:null})}));
vi.mock('@/lib/server/appSession',()=>({getAppSessionFromRequest:()=>state.session}));
vi.mock('@/lib/server/supabase',()=>({getSupabaseAdmin:()=>state.ready?{rpc:state.rpc}:null,demoModeResponse:()=>({mode:'demo'})}));
import {POST} from '@/app/api/reminders/route';
import {PATCH} from '@/app/api/reminders/[id]/route';
const body={petId:'pet',title:'Ветеринар',dueAt:'2026-09-09T09:00:00Z',type:'custom',recurrence:'none'};
const request=(value:unknown,method='POST')=>new Request('http://localhost/api/reminders',{method,headers:{'Idempotency-Key':'test-precision'},body:JSON.stringify(value)});
beforeEach(()=>{state.ready=true;state.owner='owner';state.session=null;state.rpc.mockReset();state.rpc.mockResolvedValue({data:{reminder:{...body,id:'r',status:'active'}},error:null});});
test('exact noon and 10am are never inferred as flexible or approximate; legacy precision stays unknown',()=>{
 for(const hour of [10,12]){const dueAt=new Date(2026,8,9,hour,0,0).toISOString();expect(reminderTiming({dueAt,timeMode:'exact'})).toContain(`в ${hour}:00`);expect(reminderTiming({dueAt})).toContain('время не уточнено');expect(reminderTiming({dueAt,timeMode:'flexible'})).not.toContain(`${hour}:00`);}
 expect(reminderTiming({dueAt:new Date(2026,8,9,18).toISOString(),timeMode:'approximate'})).toContain('около 18:00');
});
test('canonical snake/camel receipts retain explicit precision and reject foreign or invalid identity',()=>{
 const row={id:'r',pet_id:'pet',title:'QA',type:'custom',due_at:body.dueAt,status:'active',metadata:{timeMode:'exact',source:'manual'}};
 expect(reminderReceipt(row,'pet','r')?.timeMode).toBe('exact');expect(reminderReceipt({...row,metadata:{}},'pet','r')?.timeMode).toBeUndefined();expect(reminderReceipt(row,'other','r')).toBeNull();expect(reminderReceipt(row,'pet','other')).toBeNull();expect(reminderReceipt({...row,due_at:'invalid'},'pet','r')).toBeNull();
});
test('new create selects atomic precision wrapper; legacy callers keep old signature and fingerprint',async()=>{
 expect((await POST(request({...body,timeMode:'exact'}))).status).toBe(201);const [name,args]=state.rpc.mock.calls[0];expect(name).toBe('care_create_reminder_v2');expect(args.p_time_mode).toBe('exact');
 await POST(request(body));expect(state.rpc.mock.calls[1][0]).toBe('care_create_reminder_atomic');expect(state.rpc.mock.calls[1][1]).not.toHaveProperty('p_time_mode');expect(args.p_request_fingerprint).not.toBe(state.rpc.mock.calls[1][1].p_request_fingerprint);
});
test('storage absence cannot report a successful fake reminder; conflicting principals never write',async()=>{
 state.ready=false;expect((await POST(request(body))).status).toBe(503);state.ready=true;state.session={ownerId:'other'};expect((await POST(request(body))).status).toBe(401);expect(state.rpc).not.toHaveBeenCalled();
});
test('invalid dates, title and precision fail before write; edit carries explicit metadata patch',async()=>{
 for(const value of [{...body,timeMode:'made-up'},{...body,title:3},{...body,dueAt:'2026-02-31T12:00:00Z'}])expect((await POST(request(value))).status).toBe(400);
 expect(state.rpc).not.toHaveBeenCalled();expect((await PATCH(request({timeMode:'flexible'},'PATCH'),{params:Promise.resolve({id:'r'})})).status).toBe(200);expect(state.rpc.mock.calls[0][1].p_patch).toEqual({time_mode:'flexible'});
});
