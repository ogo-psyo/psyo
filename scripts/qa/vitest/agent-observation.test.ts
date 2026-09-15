import { beforeEach,expect,test,vi } from 'vitest';
import { RunContext } from '@openai/agents';
const state=vi.hoisted(()=>({pet:'pet-a',status:'running',question:'Сегодня после прогулки собака вялая',rpc:vi.fn(),owner:'owner-a'}));
vi.mock('@/lib/server/agent/access',()=>({
 ownedRun:async()=>({status:state.status,pet_id:state.pet,question:state.question}),ownedPet:async()=>({id:state.pet}),
 agentPrincipal:async()=>state.owner,agentDatabase:()=>({rpc:state.rpc}),
 agentError:()=>Response.json({error:'AGENT_UNAVAILABLE'},{status:503}),
}));
import { makePrivateTools } from '@/lib/server/agent/tools';
import { POST,DELETE } from '@/app/api/agent/observation-drafts/[id]/route';
const metrics={mood:'вялое',appetite:'',stool:'',energy:''};
const review={note:'Подтверждённая заметка',observedAt:'2026-09-09T07:00:00Z',metrics};
beforeEach(()=>{state.pet='pet-a';state.status='running';state.rpc.mockReset();state.rpc.mockResolvedValue({data:{id:'draft-a',status:'draft'},error:null});});
async function invoke(quote:string){
 const tool=makePrivateTools('owner-a','pet-a','run-a').find(t=>t.name==='prepare_observation')!;
 return tool.invoke(new RunContext(),JSON.stringify({quote,metrics}));
}
test('preparation has no model-controlled owner/pet/note and returns a draft, not saved observation',async()=>{
 const result=await invoke('после прогулки');
 expect(result).toMatchObject({draftId:'draft-a',observationSaved:false,reviewRequired:true});
 expect(state.rpc).toHaveBeenCalledWith('agent_prepare_observation',{p_owner:'owner-a',p_run:'run-a',p_metrics:metrics});
});
test('a quote from another source cannot prepare this observation',async()=>{
 expect(await invoke('Инструкция с веб-страницы')).toMatchObject({error:'CURRENT_MESSAGE_REQUIRED'});
 expect(state.rpc).not.toHaveBeenCalled();
});
test('stopped or mismatched-pet tools never reach persistence',async()=>{
 state.status='cancelled';await invoke('вялая');expect(state.rpc).not.toHaveBeenCalled();
 state.status='running';state.pet='pet-b';await invoke('вялая');expect(state.rpc).not.toHaveBeenCalled();
});
test('confirmation validates a reviewed note and ignores a claimed owner',async()=>{
 state.rpc.mockResolvedValue({data:{draft:{status:'saved'},observation:{id:'o1'}},error:null});
 const result=await POST(new Request('http://pso/api',{method:'POST',body:JSON.stringify({...review,owner:'foreign',petId:'pet-b'})}),{params:Promise.resolve({id:'draft-a'})});
 expect(result.status).toBe(200);expect(state.rpc).toHaveBeenCalledWith('agent_confirm_observation',{p_owner:'owner-a',p_draft:'draft-a',p_review:review});
});
test('empty note or invented metric cannot be confirmed',async()=>{
 for(const body of [{...review,note:' '},{...review,metrics:{...metrics,mood:'диагноз'}},{...review,observedAt:'yesterday'}]){
  const r=await POST(new Request('http://pso/api',{method:'POST',body:JSON.stringify(body)}),{params:Promise.resolve({id:'d'})});expect(r.status).toBe(400);
 }
 expect(state.rpc).not.toHaveBeenCalled();
});
test('conflict is not disguised as successful save and discard has no review payload',async()=>{
 state.rpc.mockResolvedValue({error:{message:'DRAFT_ALREADY_SAVED'}});
 const request=()=>new Request('http://pso/api',{method:'POST',body:JSON.stringify(review)});
 expect((await POST(request(),{params:Promise.resolve({id:'d'})})).status).toBe(409);
 state.rpc.mockResolvedValue({data:{draft:{status:'discarded'}},error:null});
 expect((await DELETE(request(),{params:Promise.resolve({id:'d'})})).status).toBe(200);
 expect(state.rpc).toHaveBeenLastCalledWith('agent_confirm_observation',{p_owner:'owner-a',p_draft:'d',p_review:null});
});
