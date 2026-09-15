import {isAgentWalk} from '@/lib/agentWalk';
import {saveOwnedMapRoute} from '@/lib/server/mapRouteSave';
import {agentDatabase,ownedRun} from './access';

export type WalkProposal={sourceRunId:string;title:string;immediate?:boolean};
export function permitsWalkSave(question:string){
  return /^\s*сохрани(?:\s|[.!?,]|$)/iu.test(question)
    && !/(?:^|\s)не(?:\s|$)|ответ|сообщени|текст|заметк|наблюден/iu.test(question)
    && ( /^\s*сохрани[.!?,\s]*$/iu.test(question) || /прогулк|маршрут/iu.test(question));
}
export async function saveAgentWalk(owner:string,pet:string,actingId:string,sourceId:string){
  const acting=await ownedRun(owner,actingId);
  if(acting.pet_id!==pet||acting.status!=='running')throw new Error('RUN_STOPPED');
  if(!permitsWalkSave(acting.question))throw new Error('EXPLICIT_WALK_SAVE_REQUIRED');
  const source=await ownedRun(owner,sourceId);
  const walk=source.result?.walk;
  if(source.pet_id!==pet||source.thread_id!==acting.thread_id||source.status!=='succeeded'||!isAgentWalk(walk))throw new Error('PROPOSAL_NOT_AVAILABLE');
  const saved=await saveOwnedMapRoute(agentDatabase(),owner,{
    petId:pet,title:walk.title,path:walk.path,visibility:'private',routeSource:'planned',distanceMeters:walk.distanceMeters,
    planning:{version:1,mode:'walking',stops:walk.stops,stairs:walk.stairs,estimatedMinutes:walk.estimatedMinutes},
  },`agent-walk:${sourceId}`,{sourceRunId:sourceId,actingRunId:actingId,expectedWalk:walk});
  return {id:saved.feature.id as string,title:saved.feature.title as string,visibility:saved.feature.visibility,replayed:saved.replayed};
}

/** Called only AFTER ownedRun: a committed action is independent of model completion. */
export async function committedWalk(run:{id:string;owner_id:string;pet_id:string}){
  const db=agentDatabase();
  const mutation=await db.from('agent_mutations').select('kind,result').eq('run_id',run.id).maybeSingle();
  if(mutation.error)throw new Error('COMMITTED_ACTION_UNAVAILABLE');
  if(mutation.data?.kind!=='walk')return null;
  const id=mutation.data.result?.id;
  if(typeof id!=='string')throw new Error('COMMITTED_ACTION_UNAVAILABLE');
  const route=await db.from('map_routes').select('id,title').eq('id',id).eq('owner_id',run.owner_id).eq('pet_id',run.pet_id).maybeSingle();
  if(route.error)throw new Error('COMMITTED_ACTION_UNAVAILABLE');
  return route.data?{id:route.data.id,title:route.data.title,available:true}:{id,title:'Прогулка',available:false};
}
