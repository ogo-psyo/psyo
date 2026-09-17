import {createHash} from 'node:crypto';
import {socialRequestContext} from '@/lib/server/socialHttp';
import {requireOwnedPet,excludedOwnerIds,mapWalkSignal} from '@/lib/server/socialService';
import {isValidGeoPoint} from '@/lib/geo';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 const ctx=await socialRequestContext(request);if('response'in ctx)return ctx.response!;
 const u=new URL(request.url),lat=Number(u.searchParams.get('lat')),lng=Number(u.searchParams.get('lng')),petId=u.searchParams.get('petId')||'';
 if(!u.searchParams.has('lat')||!u.searchParams.has('lng')||!isValidGeoPoint({lat,lng})||Math.abs(lat)>85)return response({error:'INVALID_POINT'},400);
 try{
 if(!await requireOwnedPet(ctx.supabase,ctx.ownerId,petId))return response({error:'PET_NOT_FOUND'},404);
 const now=new Date().toISOString(),delta=.055/Math.max(.09,Math.cos(lat*Math.PI/180));
 const [signals,hazards,excluded,own]=await Promise.all([
 ctx.supabase.from('social_walk_signals').select('*,pets!inner(id,name,avatar_url,avatar_source,active_avatar_asset_id,social_profiles(temperament,dog_friendly))').eq('status','active').gt('expires_at',now).gte('coarse_lat',lat-.055).lte('coarse_lat',lat+.055).gte('coarse_lng',lng-delta).lte('coarse_lng',lng+delta).limit(100),
 ctx.supabase.from('map_hazards').select('*').gt('expires_at',now).gte('lat',lat-.055).lte('lat',lat+.055).gte('lng',lng-delta).lte('lng',lng+delta).limit(100),
 excludedOwnerIds(ctx.supabase,ctx.ownerId),
 ctx.supabase.from('social_walk_signals').select('*,pets!inner(id,name,avatar_url,avatar_source,active_avatar_asset_id,social_profiles(temperament,dog_friendly))').eq('owner_id',ctx.ownerId).eq('pet_id',petId).eq('status','active').gt('expires_at',now).limit(1)]);
 if(signals.error||hazards.error||own.error)return response({error:'MAP_UNAVAILABLE'},503);
 const rows=[...new Map([...(signals.data||[]),...(own.data||[])].map(row=>[row.id,row])).values()].filter(r=>!excluded.has(r.owner_id));
 // Only the active photo of an explicitly published map pin; never documents or archived/draft assets.
 const publicAssets=new Map<string,string>();
 const activePhotos=rows.flatMap(row=>{const pet=Array.isArray(row.pets)?row.pets[0]:row.pets;return row.city==='world'&&pet.active_avatar_asset_id&&pet.avatar_source!=='none'?[{id:pet.active_avatar_asset_id,petId:row.pet_id,ownerId:row.owner_id}]:[];});
 if(activePhotos.length){
  const assets=await ctx.supabase.from('avatar_assets').select('id,owner_id,pet_id,storage_bucket,storage_path').in('id',activePhotos.map(a=>a.id)).eq('status','active').in('moderation_status',['approved','not_required']).is('deleted_at',null);
  const eligible=(assets.data||[]).filter(asset=>activePhotos.some(a=>a.id===asset.id&&a.ownerId===asset.owner_id&&a.petId===asset.pet_id));
  for(const bucket of new Set(eligible.map(a=>a.storage_bucket))){
   const group=eligible.filter(a=>a.storage_bucket===bucket);
   const signed=await ctx.supabase.storage.from(bucket).createSignedUrls(group.map(a=>a.storage_path),60);
   signed.data?.forEach((url,index)=>{if(url.signedUrl)publicAssets.set(group[index].id,url.signedUrl);});
  }
 }
 const projected=rows.map(row=>{const result=mapWalkSignal(row,ctx.ownerId);if(!result)return null;const pet=Array.isArray(row.pets)?row.pets[0]:row.pets;const photo=publicAssets.get(pet.active_avatar_asset_id);if(photo)result.avatarUrl=photo;return result;});
 return response({signals:projected.filter(Boolean),hazards:(hazards.data||[]).filter(r=>!excluded.has(r.owner_id)).map(r=>({id:r.id,title:r.title,point:{lat:r.lat,lng:r.lng},radius:r.radius,expiresAt:r.expires_at,isMine:r.owner_id===ctx.ownerId}))});
 }catch{return response({error:'MAP_UNAVAILABLE'},503);}
}
export async function PUT(request:Request){
 const ctx=await socialRequestContext(request);if('response'in ctx)return ctx.response!;
 const body=await request.json().catch(()=>null);if(!body||typeof body.petId!=='string')return response({error:'INVALID_MARK'},400);
 try{
 if(!await requireOwnedPet(ctx.supabase,ctx.ownerId,body.petId))return response({error:'PET_NOT_FOUND'},404);
 const point={lat:body.lat,lng:body.lng};if(!isValidGeoPoint(point)||Math.abs(point.lat)>85)return response({error:'INVALID_POINT'},400);
 if(body.kind==='presence'){
 const key=request.headers.get('idempotency-key')||'';if(key.length<8||key.length>128||![30,45,60].includes(body.minutes))return response({error:'INVALID_SIGNAL'},400);
 // Same coarse grid as existing signals: never store raw device coordinates.
 const lat=Math.round(point.lat*100)/100,lng=Math.round(point.lng*100)/100;
 const fingerprint=createHash('sha256').update(JSON.stringify({kind:'presence',petId:body.petId,lat,lng,minutes:body.minutes})).digest('hex');
 const result=await ctx.supabase.rpc('map_publish_signal',{p_owner:ctx.ownerId,p_pet:body.petId,p_key:key,p_fingerprint:fingerprint,p_lat:lat,p_lng:lng,p_minutes:body.minutes});
 if(result.error)return response({error:result.error.message.includes('IDEMPOTENCY_CONFLICT')?'IDEMPOTENCY_CONFLICT':'SAVE_FAILED'},409);
 return response({ok:true});
 }
 if(body.kind!=='hazard'||typeof body.title!=='string'||!body.title.trim()||body.title.length>120||![1,3,24].includes(body.hours)||!Number.isInteger(body.radius)||body.radius<20||body.radius>500||typeof body.id!=='string'||! /^[0-9a-f-]{36}$/i.test(body.id))return response({error:'INVALID_HAZARD'},400);
 const key=request.headers.get('idempotency-key')||'';if(key.length<8||key.length>128)return response({error:'INVALID_KEY'},400);
 const fingerprint=createHash('sha256').update(JSON.stringify({kind:'hazard',petId:body.petId,id:body.id,...point,title:body.title.trim(),radius:body.radius,hours:body.hours})).digest('hex');
 const saved=await ctx.supabase.rpc('map_save_hazard',{p_owner:ctx.ownerId,p_pet:body.petId,p_key:key,p_fingerprint:fingerprint,p_id:body.id,p_lat:point.lat,p_lng:point.lng,p_title:body.title.trim(),p_radius:body.radius,p_hours:body.hours});
 if(saved.error)return response({error:'SAVE_FAILED'},saved.error.message.includes('RATE_LIMIT')?429:409);return response({ok:true});
 }catch{return response({error:'SAVE_FAILED'},503);}
}
export async function DELETE(request:Request){
 const ctx=await socialRequestContext(request);if('response'in ctx)return ctx.response!;
 const body=await request.json().catch(()=>null);if(!body||typeof body.id!=='string'||!['presence','hazard'].includes(body.kind))return response({error:'INVALID_MARK'},400);
 const result=body.kind==='presence'?await ctx.supabase.from('social_walk_signals').update({status:'completed'}).eq('id',body.id).eq('owner_id',ctx.ownerId).select('id'):await ctx.supabase.from('map_hazards').delete().eq('id',body.id).eq('owner_id',ctx.ownerId).select('id');
 if(result.error)return response({error:'SAVE_FAILED'},503);return response({ok:true});
}
