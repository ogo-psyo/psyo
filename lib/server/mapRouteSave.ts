import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {parseRoutePlanning} from '@/lib/routePlanning';
import {routeEwkt,storedRoutePoints,validRouteGaps} from '@/lib/routeGeometry';

export class RouteSaveError extends Error {
  constructor(public code:string,public status=400){super(code);}
}
function nonNegativeInteger(value:unknown,maximum:number){
  const number=Number(value);
  return Number.isFinite(number)&&number>=0?Math.min(maximum,Math.round(number)):null;
}

/** The Map and agent use this one canonical normalization and persistence contract. */
export function buildRouteSave(owner:string,body:Record<string,unknown>,retryKey?:string|null){
  if(typeof body.title!=='string'||!body.title.trim())throw new RouteSaveError('TITLE_REQUIRED');
  const path=routeEwkt(body.path);
  if(!path)throw new RouteSaveError('INVALID_ROUTE_PATH');
  if(body.petId!=null&&typeof body.petId!=='string')throw new RouteSaveError('PET_NOT_FOUND',404);
  const visibility=['private','shared','public'].includes(String(body.visibility))?String(body.visibility):'private';
  const planning=body.planning==null?null:parseRoutePlanning(body.planning);
  if(body.planning!=null&&!planning)throw new RouteSaveError('INVALID_PLANNING');
  const routeSource=body.routeSource==='recorded'?'recorded':'planned';
  const startedAt=routeSource==='recorded'&&typeof body.startedAt==='string'&&Number.isFinite(Date.parse(body.startedAt))?new Date(body.startedAt).toISOString():null;
  const durationSeconds=nonNegativeInteger(body.durationSeconds,60*60*24);
  const distanceMeters=nonNegativeInteger(body.distanceMeters,500_000);
  if(retryKey&&retryKey.length>128)throw new RouteSaveError('INVALID_IDEMPOTENCY_KEY');
  // Keep pre-migration request identities/fingerprints compatible with the existing Map API.
  const hex=retryKey?createHash('sha256').update(`${owner}:${retryKey}`).digest('hex'):null;
  const id=hex?`${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`:crypto.randomUUID();
  const fingerprint=createHash('sha256').update(JSON.stringify({petId:body.petId,title:body.title.trim(),path:body.path,visibility,description:body.description,routeSource,startedAt,durationSeconds,distanceMeters,pathGaps:body.pathGaps,planning})).digest('hex');
  return {id,fingerprint,row:{
    pet_id:body.petId||null,title:body.title.trim(),description:typeof body.description==='string'?body.description.trim()||null:null,
    visibility,moderation_status:visibility==='public'?'pending':'approved',color:typeof body.color==='string'?body.color:'#3b82f6',
    path,share_token:visibility==='shared'?crypto.randomUUID():null,route_source:routeSource,planning,
    path_gaps:validRouteGaps(body.pathGaps,(body.path as unknown[]).length),started_at:startedAt,duration_seconds:durationSeconds,distance_meters:distanceMeters,
  }};
}

type AgentGuard={sourceRunId:string;actingRunId:string;expectedWalk:unknown};
export async function saveOwnedMapRoute(db:SupabaseClient,owner:string,body:Record<string,unknown>,retryKey?:string|null,agent?:AgentGuard){
  const prepared=buildRouteSave(owner,body,retryKey);
  const args={p_owner:owner,p_id:prepared.id,p_fingerprint:prepared.fingerprint,p_route:prepared.row};
  const result=agent?await db.rpc('agent_save_walk_atomic',{...args,p_source:agent.sourceRunId,p_acting:agent.actingRunId,p_expected_walk:agent.expectedWalk}):await db.rpc('map_save_route_atomic',args);
  if(result.error){
    const code=String(result.error.message??'');
    if(code.includes('ROUTE_REMOVED'))throw new RouteSaveError('ROUTE_REMOVED',410);
    if(code.includes('IDEMPOTENCY_CONFLICT'))throw new RouteSaveError('IDEMPOTENCY_CONFLICT',409);
    if(code.includes('PET_NOT_FOUND'))throw new RouteSaveError('PET_NOT_FOUND',404);
    if(code.includes('RUN_STOPPED'))throw new RouteSaveError('RUN_STOPPED',409);
    if(code.includes('PROPOSAL_NOT_AVAILABLE'))throw new RouteSaveError('PROPOSAL_NOT_AVAILABLE',404);
    if(code.includes('EXPLICIT_WALK_SAVE_REQUIRED'))throw new RouteSaveError('EXPLICIT_WALK_SAVE_REQUIRED',409);
    if(code.includes('WRITE_ALREADY_PERFORMED'))throw new RouteSaveError('WRITE_ALREADY_PERFORMED',409);
    throw new RouteSaveError('ROUTE_SAVE_FAILED',503);
  }
  const row=result.data?.feature;
  const points=storedRoutePoints(row?.path);
  if(!row||row.id!==prepared.id||row.owner_id!==owner||!points)throw new RouteSaveError('ROUTE_SAVE_FAILED',503);
  return {replayed:result.data.replayed===true,feature:{...row,path:{type:'LineString' as const,coordinates:points}}};
}
