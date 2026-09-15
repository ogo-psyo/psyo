import {test,expect,vi,beforeEach} from 'vitest';
import {RunContext} from '@openai/agents';
import {isAgentWalk,recentAgentPlaces,type AgentWalk} from '@/lib/agentWalk';
import type {MapSearchPlace} from '@/lib/mapSearchPlace';
const state=vi.hoisted(()=>({status:'running',pet:'pet-a',route:vi.fn()}));
vi.mock('@/lib/server/agent/access',()=>({agentDatabase:()=>({}),ownedRun:async()=>({status:state.status,pet_id:state.pet})}));
vi.mock('@/lib/server/walkingRoute',()=>({calculateWalkingPath:state.route}));
import {makePrivateTools} from '@/lib/server/agent/tools';
const places:MapSearchPlace[]=[0,1].map((i)=>({id:`osm-way-${i+1}`,title:`Парк ${i}`,detail:'Тестовый район',category:'парк',kind:'organization',point:{lat:55.75,lng:37.61+i/100},sourceUrl:`https://www.openstreetmap.org/way/${i+1}`,retrievedAt:'2026-09-09T07:00:00Z',pointIsCenter:true,dogAccess:'unknown'}));
beforeEach(()=>{state.status='running';state.pet='pet-a';state.route.mockReset().mockImplementation(async(points)=>({status:200,result:{path:points,source:'OpenStreetMap',calculatedAt:'2026-09-09T08:00:00Z',distanceMeters:1200,estimatedMinutes:16,stairs:false,snaps:points.map((point:number[])=>({point,distanceMeters:5}))}}));});
function setup(previousPlaces=places,signal?:AbortSignal){
 const walkState:{previousPlaces:MapSearchPlace[];preview?:AgentWalk}={previousPlaces};
 const tool=makePrivateTools('owner-a','pet-a','run-a',[],[],signal,walkState).find(t=>t.name==='calculate_walk')!;
 return {walkState,call:(placeIds=places.map(p=>p.id),roundTrip=false)=>tool.invoke(new RunContext(),JSON.stringify({placeIds,roundTrip,title:'К пруду'}))};
}
test('only known references reach routing; original stops, snaps and actual geometry are retained',async()=>{
 const t=setup();expect(await t.call(undefined,true)).toMatchObject({saved:false,estimatedMinutes:16});
 const expected=[[37.61,55.75],[37.62,55.75],[37.61,55.75]];
 expect(state.route).toHaveBeenCalledWith(expected,undefined);expect(t.walkState.preview?.path).toEqual(expected);
 expect(t.walkState.preview?.stops[0].placeId).toBe(places[0].id);expect(isAgentWalk(t.walkState.preview)).toBe(true);
 await t.call();expect(await t.call()).toContain('WALK_CALCULATION_LIMIT');expect(state.route).toHaveBeenCalledTimes(2);
});
test('arbitrary, absent or duplicate references never route',async()=>{
 await setup([]).call();await setup().call([places[0].id,'invented']);await setup().call([places[0].id,places[0].id]);expect(state.route).not.toHaveBeenCalled();
});
test('foreign, cancelled and aborted tasks never route or create a proposal',async()=>{
 state.pet='other';await setup().call();state.pet='pet-a';state.status='cancelled';await setup().call();state.status='running';await setup(places,AbortSignal.abort()).call();expect(state.route).not.toHaveBeenCalled();
});
test('late cancellation and quota cannot publish a new proposal; failed revision preserves last computed path',async()=>{
 const t=setup();await t.call();const previous=t.walkState.preview;
 state.route.mockResolvedValue({status:429,error:'ROUTING_QUOTA'});expect(await t.call()).toContain('ROUTING_QUOTA');expect(t.walkState.preview).toBe(previous);
 const late=setup();state.route.mockImplementation(async()=>{state.status='cancelled';return {status:200,result:previous};});await late.call();expect(late.walkState.preview).toBeUndefined();
});
test('recent-place recall ignores malformed records and keeps newest server objects',()=>{
 expect(recentAgentPlaces([{result:{places:[places[0],{id:'invented'}]}},{result:{places:[{...places[0],title:'старое'},places[1]]}}])).toEqual(places);
 expect(isAgentWalk({path:[[0,0],[1,1]]})).toBe(false);
});
