import { z } from 'zod';
import { isMapSearchPlace, type MapSearchPlace } from './mapSearchPlace';
const point=z.tuple([z.number().finite().min(-180).max(180),z.number().finite().min(-85).max(85)]);
const schema=z.object({
  title:z.string().trim().min(1).max(160),
  path:z.array(point).min(2).max(10000),
  stops:z.array(z.object({point,title:z.string().max(160),placeId:z.string().max(180)})).min(2).max(9),
  snaps:z.array(z.object({point,distanceMeters:z.number().finite().nonnegative()})).min(2).max(9),
  distanceMeters:z.number().finite().nonnegative(),estimatedMinutes:z.number().finite().nonnegative(),
  stairs:z.boolean(),source:z.literal('OpenStreetMap'),calculatedAt:z.string().datetime(),
}).refine(v=>v.stops.length===v.snaps.length);
export type AgentWalk=z.infer<typeof schema>;
export const isAgentWalk=(value:unknown):value is AgentWalk=>schema.safeParse(value).success;
// Caller supplies only owned, completed, same-thread results after privacy_epoch.
export function recentAgentPlaces(rows:Array<{result?:{places?:unknown}}>):MapSearchPlace[]{
  const found=new Map<string,MapSearchPlace>();
  for(const row of rows)if(Array.isArray(row.result?.places))for(const place of row.result.places)
    if(isMapSearchPlace(place)&&!found.has(place.id)&&found.size<48)found.set(place.id,place);
  return [...found.values()];
}
