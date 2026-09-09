import {getSupabaseAdmin} from './supabase';
import {normalizeOwnerRoutes} from '@/lib/mapUi';
export async function readOwnedMapRoute(owner:string,pet:string,id:string){
  const db=getSupabaseAdmin();if(!db)throw new Error('ROUTE_READ_FAILED');
  const owned=await db.from('pets').select('id').eq('id',pet).eq('owner_id',owner).maybeSingle();
  if(owned.error)throw new Error('ROUTE_READ_FAILED');if(!owned.data)throw new Error('ROUTE_NOT_FOUND');
  const result=await db.from('map_routes').select('id,owner_id,pet_id,title,description,path,visibility,route_source,planning,path_gaps,started_at,duration_seconds,distance_meters')
    .eq('id',id).eq('owner_id',owner).eq('pet_id',pet).maybeSingle();
  if(result.error)throw new Error('ROUTE_READ_FAILED');if(!result.data)throw new Error('ROUTE_NOT_FOUND');
  const route=normalizeOwnerRoutes([result.data])[0];if(!route)throw new Error('ROUTE_READ_FAILED');return route;
}
