import { getRequestAuth } from '@/lib/server/auth';
import { getAppSessionFromRequest } from '@/lib/server/appSession';
import { principalsAgree } from '@/lib/socialCore';
import { measuredMapOperation } from '@/lib/server/mapMetrics';
import { calculateWalkingPath } from '@/lib/server/walkingRoute';
export const runtime = 'nodejs';
export const maxDuration = 40;
export async function POST(request: Request) {
  return measuredMapOperation('walking_route', request, async () => {
    const auth=await getRequestAuth(request),session=getAppSessionFromRequest(request);
    if(!principalsAgree({bearerOwnerId:auth.user?.id,sessionOwnerId:session?.ownerId}))
      return Response.json({error:'IDENTITY_PRINCIPAL_MISMATCH'},{status:401});
    if(!auth.user?.id&&!session?.ownerId)return Response.json({error:'AUTH_REQUIRED'},{status:401});
    const text=await request.text();
    if(text.length>50000)return Response.json({error:'POINT_LIMIT'},{status:413});
    let body;try{body=JSON.parse(text);}catch{return Response.json({error:'INVALID_POINTS'},{status:400});}
    const outcome=await calculateWalkingPath(body?.points,request.signal);
    return Response.json(outcome.status===200?outcome.result:{error:outcome.error},{status:outcome.status,
      headers:{'Cache-Control':'private, no-store',...(outcome.status!==200&&outcome.retryAfter?{'Retry-After':outcome.retryAfter}:{})}});
  });
}
