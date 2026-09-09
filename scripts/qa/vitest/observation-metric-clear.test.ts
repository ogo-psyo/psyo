import {test,expect,vi,beforeEach} from 'vitest';
const state=vi.hoisted(()=>({patch:null as Record<string,unknown>|null}));
vi.mock('@/lib/server/auth',()=>({getRequestAuth:async()=>({user:{id:'owner-a'}})}));
vi.mock('@/lib/server/appSession',()=>({getAppSessionFromRequest:()=>null}));
vi.mock('@/lib/server/supabase',()=>({getSupabaseAdmin:()=>({rpc:async(_name:string,args:{p_patch:Record<string,unknown>})=>{state.patch=args.p_patch;return {data:{observation:{id:'22222222-2222-4222-8222-222222222222',pet_id:'11111111-1111-4111-8111-111111111111',...args.p_patch,observed_at:'2026-09-09T09:00:00Z'}},error:null};}})}));
import {PATCH} from '@/app/api/observations/[id]/route';
const patch=(body:object)=>PATCH(new Request('http://localhost/api/observations/22222222-2222-4222-8222-222222222222',{method:'PATCH',headers:{'Content-Type':'application/json','Idempotency-Key':'qa-metric-clear-unique-key'},body:JSON.stringify(body)}),{params:Promise.resolve({id:'22222222-2222-4222-8222-222222222222'})});
beforeEach(()=>{state.patch=null;});
test('clearing one metric persists an explicit empty override and derives remaining primary',async()=>{
 const response=await patch({mood:'',appetite:'обычный',stool:'',energy:'ниже обычного',note:'Исходный текст'});
 expect(response.status).toBe(200);expect(state.patch).toMatchObject({type:'appetite',value:'обычный',metadata:{mood:'',appetite:'обычный',stool:'',energy:'ниже обычного'}});
 expect((await response.json()).observation).toMatchObject({mood:'',appetite:'обычный',energy:'ниже обычного'});
});
test('all metrics can become a plain note, but not an empty record',async()=>{
 const response=await patch({mood:'',appetite:'',stool:'',energy:'',note:'Остался только текст'});expect(response.status).toBe(200);expect(state.patch).toMatchObject({type:'note',value:'Остался только текст',metadata:{mood:'',appetite:'',stool:'',energy:''}});
 expect((await patch({mood:'',appetite:'',stool:'',energy:'',note:''})).status).toBe(400);
});
test('incomplete clear is rejected rather than silently restoring a stale primary metric',async()=>{expect((await patch({mood:''})).status).toBe(400);expect(state.patch).toBe(null);});
test('editing an imported weight or other primary fact preserves its type/value',async()=>{
 const response=await patch({type:'weight',value:'16,8 кг',mood:'',appetite:'',stool:'',energy:'',note:'После прогулки'});
 expect(response.status).toBe(200);expect(state.patch).toMatchObject({type:'weight',value:'16,8 кг',metadata:{mood:'',appetite:'',stool:'',energy:''}});
});
