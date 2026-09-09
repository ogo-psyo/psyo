import { expect, test, vi } from 'vitest';
import { RunContext } from '@openai/agents';
const state=vi.hoisted(()=>({ rows: [] as Record<string, unknown>[] }));
vi.mock('@/lib/server/agent/access',()=>({
  ownedRun: async()=>({status:'running'}), ownedPet: async()=>({id:'pet-a'}),
  agentDatabase:()=>({ from:()=>{
    let fields: string[]=[]; const filters: ((row:Record<string,unknown>)=>boolean)[]=[];
    const q={select:(names:string)=>{fields=names.split(',');return q;},eq:(name:string,value:unknown)=>{filters.push(row=>row[name]===value);return q;},
      is:(name:string,value:unknown)=>{filters.push(row=>row[name]===value);return q;}, order:()=>q,limit:()=>q,
      then:(resolve:(result:unknown)=>unknown)=>Promise.resolve(resolve({data:state.rows.filter(row=>filters.every(f=>f(row))).map(row=>Object.fromEntries(fields.map(name=>[name,row[name]]))),error:null})),
    };return q;
  } }),
}));
import { makePrivateTools } from '@/lib/server/agent/tools';
async function search(kind:string,query:string){
  const tool=makePrivateTools('owner-a','pet-a','run-a').find(item=>item.name==='search_private_records')!;
  return await tool.invoke(new RunContext(),JSON.stringify({kind,query})) as unknown as {records:Record<string,unknown>[];fileContentsRead:boolean};
}
test('agent search only surfaces ready documents for the current pet',async()=>{
  state.rows=['pending','ready','deleting','deleted'].map(lifecycle=>({id:lifecycle,pet_id:'pet-a',lifecycle,title:'Analysis'}));
  state.rows.push({id:'foreign',pet_id:'pet-b',lifecycle:'ready',title:'Analysis'});
  const result=await search('documents','Analysis');
  expect(result.records.map(row=>row.id)).toEqual(['ready']);expect(result.fileContentsRead).toBe(false);
});
test('agent can find the original observation note, but not deleted notes',async()=>{
  state.rows=[{id:'note-a',pet_id:'pet-a',type:'appetite',value:'normal',note:'Увидел сыпь после прогулки',deleted_at:null},
    {id:'deleted',pet_id:'pet-a',note:'сыпь',deleted_at:'2026-09-09'}];
  const result=await search('observations','сыпь');
  expect(result.records.map(row=>row.id)).toEqual(['note-a']);expect(result.records[0].note).toContain('после прогулки');
});
