import {describe,expect,it,vi} from 'vitest';
import {queryMapPlaceIndex} from '@/lib/server/mapPlaceIndex';
import {validateMapPlaceRegion} from '@/lib/mapPlaceIndexImport';
const bounds={south:55.7,west:37.5,north:55.8,east:37.7};
const database=(data:unknown,error:unknown=null)=>({rpc:vi.fn(async()=>({data,error}))});
describe('national map place index contract',()=>{
  it('maps a covered PostGIS viewport to the public discovery contract',async()=>{
    const db=database({covered:true,results:[{id:'osm-node-42',title:'Парк',detail:'Москва',category:'парк',group:'parks',point:{lat:55.75,lng:37.61},dogAccess:'yes'}],total:1,truncated:false,updatedAt:'2026-09-28T00:00:00Z',coverage:[{id:'central','title':'Центральный округ'}]});
    const result=await queryMapPlaceIndex(bounds,'parks',db);
    expect(result).toMatchObject({state:'covered',response:{category:'parks',total:1,source:'OpenStreetMap',coverage:[{id:'central',title:'Центральный округ'}]}});
    expect(db.rpc).toHaveBeenCalledWith('query_map_place_index',{p_south:55.7,p_west:37.5,p_north:55.8,p_east:37.7,p_group:'parks',p_limit:80});
  });
  it('distinguishes uncovered storage from an unavailable index',async()=>{
    await expect(queryMapPlaceIndex(bounds,'all',database({covered:false,coverage:[]}))).resolves.toEqual({state:'uncovered'});
    await expect(queryMapPlaceIndex(bounds,'all',database(null,{message:'missing'}))).resolves.toEqual({state:'unavailable'});
    await expect(queryMapPlaceIndex(bounds,'all',null)).resolves.toEqual({state:'unavailable'});
  });
  it('rejects malformed database rows rather than exposing them',async()=>{
    const result=await queryMapPlaceIndex(bounds,'all',database({covered:true,results:[{id:'private-1',title:'Hidden',detail:'',category:'x',group:'parks',point:{lat:55,lng:37}}],total:1,truncated:false,coverage:[]}));
    expect(result).toMatchObject({state:'covered',response:{results:[],total:1}});
  });
  it('accepts reviewed public regions and rejects duplicate or out-of-bounds places',()=>{
    const region={id:'central-1',title:'Центральный фрагмент',bounds,souceUrl:'',updatedAt:'2026-09-28T00:00:00Z',sourceUrl:'https://www.openstreetmap.org/copyright',places:[{id:'osm-node-42',title:'Парк',detail:'',category:'парк',group:'parks',point:{lat:55.75,lng:37.61}}]};
    expect(validateMapPlaceRegion(region)).toBe(true);
    expect(validateMapPlaceRegion({...region,places:[region.places[0],region.places[0]]})).toBe(false);
    expect(validateMapPlaceRegion({...region,places:[{...region.places[0],point:{lat:59,lng:37.61}}]})).toBe(false);
    expect(validateMapPlaceRegion({...region,sourceUrl:'https://user:password@example.test'})).toBe(false);
  });
});
