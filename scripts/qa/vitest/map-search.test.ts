import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const gate=vi.hoisted(()=>vi.fn());vi.mock('@/lib/server/mapSearchBudget',()=>({takeMapSearchSlot:gate}));
import {GET} from '../../../app/api/map/search/route';
beforeEach(()=>{gate.mockResolvedValue(true);});afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it('search uses explicit bounds and stable provider identity; missing coordinates never become zero',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json([{osm_type:'way',osm_id:100,name:'Парк',display_name:'Парк, Москва',lat:'55.75',lon:'37.61',type:'park'},{osm_id:101,name:'Нет координат',lat:null,lon:null},{osm_id:102,name:'Вне области',lat:'59.94',lon:'30.31'}]));vi.stubGlobal('fetch',fetch);
 const response=await GET(new Request('http://localhost/api/map/search?q=парк&lat=55.75&lng=37.61&bounds=55.70,37.5,55.8,37.7'));const body=await response.json();expect(body.results).toHaveLength(1);expect(body.results[0].id).toBe('osm-way-100');const url=new URL(fetch.mock.calls[0][0]);expect(url.searchParams.get('bounded')).toBe('1');expect(url.searchParams.get('viewbox')).toBe('37.5,55.8,37.7,55.7');
});
it('exhausted shared budget makes no provider call and is distinct from an empty result',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);gate.mockResolvedValue(false);const response=await GET(new Request('http://localhost/api/map/search?q=парк'));expect(response.status).toBe(429);expect(response.headers.get('Retry-After')).toBe('2');expect(fetch).not.toHaveBeenCalled();});
it('provider failure does not claim there are no places',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('network')));const response=await GET(new Request('http://localhost/api/map/search?q=парк'));expect(response.status).toBe(503);expect((await response.json()).error).toBe('search_unavailable');});

it('untrusted provider shapes and invalid coordinates are rejected without made-up map points',async()=>{
 const fetch=vi.fn().mockResolvedValue(Response.json({error:'unexpected object'}));vi.stubGlobal('fetch',fetch);
 expect((await GET(new Request('http://localhost/api/map/search?q=парк'))).status).toBe(503);
 fetch.mockResolvedValue(Response.json([{name:'Place',lat:'Infinity',lon:'12'},{name:'Bad',lat:'10',lon:[]},{name:'Blank',lat:' ',lon:' '},{name:'Valid',lat:'55.75',lon:'37.61',osm_type:'way',osm_id:22}]));
 const body=await (await GET(new Request('http://localhost/api/map/search?q=парк'))).json();
 expect(body.results).toHaveLength(1);expect(body.results[0]).toMatchObject({sourceUrl:'https://www.openstreetmap.org/way/22',pointIsCenter:true,dogAccess:'unknown'});
});
it('provider throttling keeps its retry signal and does not fall back to invented places',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('',{status:429}));vi.stubGlobal('fetch',fetch);
 const result=await GET(new Request('http://localhost/api/map/search?q=парк'));expect(result.status).toBe(429);expect(result.headers.get('Retry-After')).toBe('60');expect(fetch).toHaveBeenCalledTimes(1);
});
