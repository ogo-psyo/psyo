import { agentDatabase, agentError, agentPrincipal, ownedRun } from '@/lib/server/agent/access';
import { reviewedObservation } from '@/lib/agentObservation';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
function failure(error: unknown) {
  const code=error instanceof Error ? error.message : '';
  if (['DRAFT_NOT_FOUND','OBSERVATION_NOT_FOUND'].includes(code)) return Response.json({error:code},{status:404});
  if (['DRAFT_ALREADY_SAVED','DRAFT_DISCARDED','RUN_NOT_READY'].includes(code)) return Response.json({error:code},{status:409});
  return agentError(error);
}
export async function GET(request: Request, context: Context) {
  try {
    const owner=await agentPrincipal(request), db=agentDatabase();
    const {data:draft,error}=await db.from('agent_observation_drafts').select('*').eq('id',(await context.params).id).eq('owner_id',owner).maybeSingle();
    if(error) throw new Error('READ_FAILED');
    if(!draft) throw new Error('DRAFT_NOT_FOUND');
    const run=await ownedRun(owner,draft.run_id);
    if(run.status!=='succeeded'||run.pet_id!==draft.pet_id) throw new Error('RUN_NOT_READY');
    let observation=null;
    if(draft.status==='saved'&&draft.observation_id) {
      const result=await db.from('pet_observations').select('*').eq('id',draft.observation_id).eq('pet_id',draft.pet_id).is('deleted_at',null).maybeSingle();
      if(result.error) throw new Error('READ_FAILED');
      observation=result.data;
    }
    return Response.json({draft,observation},{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return failure(error); }
}
async function change(request: Request,context: Context,discard: boolean) {
  try {
    const owner=await agentPrincipal(request);
    const parsed=discard ? null : reviewedObservation.safeParse(await request.json().catch(()=>null));
    if(parsed&&!parsed.success) return Response.json({error:'INVALID_DRAFT'},{status:400});
    const result=await agentDatabase().rpc('agent_confirm_observation',{
      p_owner:owner,p_draft:(await context.params).id,p_review:parsed?.success ? parsed.data : null,
    });
    if(result.error) throw new Error(result.error.message);
    return Response.json(result.data,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) { return failure(error); }
}
export const POST=(request:Request,context:Context)=>change(request,context,false);
export const DELETE=(request:Request,context:Context)=>change(request,context,true);
