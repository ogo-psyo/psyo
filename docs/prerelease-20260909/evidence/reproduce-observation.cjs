// Executes unmodified c15d067 route/helper through TypeScript transpilation.
// Database transport is simulated; no external calls, credentials or real rows.
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'../../..');
const ts=require(path.resolve(root,'../wt-pso-agent-20260908/node_modules/typescript'));
const rows=[],claims=new Map();let failFinish=true;
const owner='00000000-0000-4000-8000-000000000001',pet='00000000-0000-4000-8000-000000000002';
function query(table){let action='select',value,filters={};const q={};for(const m of ['select','single','maybeSingle','order','limit'])q[m]=()=>q;q.eq=(k,v)=>(filters[k]=v,q);q.is=q.eq;q.insert=v=>(action='insert',value=v,q);q.update=v=>(action='update',value=v,q);q.delete=()=>(action='delete',q);q.then=(ok,bad)=>Promise.resolve().then(()=>{
 if(table==='pets')return{data:{id:pet},error:null};
 if(table==='care_mutations'){
  const key=filters.idempotency_key||value?.idempotency_key;
  if(action==='insert'){claims.set(key,{...value,response:null});return{data:null,error:null}}
  if(action==='update'){if(failFinish){failFinish=false;return{data:null,error:new Error('injected transport failure after observation commit')}}claims.set(key,{...claims.get(key),...value});return{data:null,error:null}}
  if(action==='delete'){claims.delete(key);return{data:null,error:null}}
  return{data:claims.get(key)||null,error:null};
 }
 if(table==='pet_observations'&&action==='insert'){const row={...value,id:'row-'+(rows.length+1),created_at:'2026-09-09T00:00:00Z'};rows.push(row);return{data:row,error:null}}
 throw Error('Unexpected '+table+' '+action);
}).then(ok,bad);return q}
const db={from:query};let care;
function load(file){const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};const req=n=>{
 if(n==='next/server')return{NextResponse:{json:(v,i)=>Response.json(v,i)}};
 if(n==='@/lib/server/auth')return{getRequestAuth:async()=>({user:{id:owner},supabase:db})};
 if(n==='@/lib/server/appSession')return{getAppSessionFromRequest:()=>null};
 if(n==='@/lib/server/supabase')return{getSupabaseAdmin:()=>db,demoModeResponse:()=>({mode:'demo'})};
 if(n==='@/lib/server/careHttp')return care;
 if(n==='node:crypto')return require(n);
 throw Error('Unexpected import '+n);
};new Function('require','exports',code)(req,exports);return exports}
care=load('lib/server/careHttp.ts');const route=load('app/api/observations/route.ts');
const request=()=>new Request('https://audit.invalid/api/observations',{method:'POST',headers:{'content-type':'application/json','idempotency-key':'audit-stable-request-0001'},body:JSON.stringify({petId:pet,type:'note',value:'Synthetic note',note:'Synthetic note',observedAt:'2026-09-09T00:00:00Z',source:'manual'})});
(async()=>{const first=await route.POST(request()),firstBody=await first.json();const afterFirst=rows.length;const second=await route.POST(request()),secondBody=await second.json();assert.equal(first.status,500);assert.equal(afterFirst,1);assert.equal(second.status,201);assert.equal(rows.length,2);const result={source:'c15d067',fixture:'Unmodified route and care helpers, simulated Supabase transport; failure finishing replay record after note insert',first:{status:first.status,code:firstBody.error,committedNotes:afterFirst},retry:{status:second.status,committedNotes:rows.length,id:secondBody.observation.id},verdict:'REPRODUCED: identical request/key can duplicate a committed note when finishCareMutation fails and abort clears its claim',limits:'Not a live database test; does not assert this incident occurred in production'};fs.writeFileSync(path.join(__dirname,'observation-fault-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));})().catch(e=>{console.error(e);process.exit(1)});
