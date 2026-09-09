import {test,expect,vi,beforeEach} from 'vitest';
import {RunContext} from '@openai/agents';
import type {MapSearchPlace} from '@/lib/mapSearchPlace';
const state=vi.hoisted(()=>({status:'running',pet:'pet-a',search:vi.fn()}));
vi.mock('@/lib/server/agent/access',()=>({agentDatabase:()=>({}),ownedRun:async()=>({status:state.status,pet_id:state.pet}),ownedPet:async()=>({id:state.pet})}));
vi.mock('@/lib/server/mapPlaceSearch',()=>({searchMapPlaces:state.search}));
import {makePrivateTools} from '@/lib/server/agent/tools';
const place:MapSearchPlace={id:'osm-way-22',title:'Парк',detail:'Город',category:'парк',kind:'organization',point:{lat:55.75,lng:37.61},sourceUrl:'https://www.openstreetmap.org/way/22',retrievedAt:'2026-09-09T07:00:00Z',pointIsCenter:true,dogAccess:'unknown'};
beforeEach(()=>{state.status='running';state.pet='pet-a';state.search.mockReset().mockResolvedValue({status:200,results:[place]});});
function setup(signal?:AbortSignal){const places:MapSearchPlace[]=[],sources:Array<{url:string;title:string}>=[];const tool=makePrivateTools('owner-a','pet-a','run-a',sources,places,signal).find(t=>t.name==='search_places')!;return {places,sources,call:()=>tool.invoke(new RunContext(),JSON.stringify({query:'парк, город'}))};}
test('actual service objects and citations form the map result; capped and deduplicated per run',async()=>{
 const t=setup();expect(await t.call()).toMatchObject({saved:false,places:[place]});await t.call();await t.call();expect(state.search).toHaveBeenCalledTimes(2);expect(t.places).toEqual([place]);expect(t.sources[0].url).toBe(place.sourceUrl);
});
test('cancelled, foreign-pet and aborted runs never search',async()=>{
 state.status='cancelled';await setup().call();state.status='running';state.pet='foreign';await setup().call();state.pet='pet-a';await setup(AbortSignal.abort()).call();expect(state.search).not.toHaveBeenCalled();
});
test('late cancellation or failed source cannot leave a displayed map result',async()=>{
 const t=setup();state.search.mockImplementation(async()=>{state.status='cancelled';return {status:200,results:[place]};});await t.call();expect(t.places).toEqual([]);
 state.status='running';state.search.mockResolvedValue({status:429,results:[],error:'search_quota'});await setup().call();expect(t.places).toEqual([]);
});
