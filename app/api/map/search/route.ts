import {measuredMapOperation} from '@/lib/server/mapMetrics';
import {searchMapPlaces} from '@/lib/server/mapPlaceSearch';
export async function GET(request:Request){return measuredMapOperation('map_search',request,async()=>{
 const url=new URL(request.url),result=await searchMapPlaces(url.searchParams.get('q')||'',{bounds:url.searchParams.get('bounds'),lat:url.searchParams.get('lat'),lng:url.searchParams.get('lng'),signal:request.signal});
 return Response.json({results:result.results,...(result.error?{error:result.error}:{})},{status:result.status,headers:result.retryAfter?{'Retry-After':result.retryAfter}:result.status===200?{'Cache-Control':'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400'}:{}});
});}
