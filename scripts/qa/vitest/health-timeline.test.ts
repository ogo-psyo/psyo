import {test,expect,vi} from 'vitest';
import {createClient} from '@supabase/supabase-js';
import {healthTimelinePageForOwner,parseHealthCursor} from '@/lib/server/healthTimelineService';
const pet='11111111-1111-4111-8111-111111111111';
const id=(n:number)=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`;
const rows=[3,2,1].map(n=>({id:id(n),pet_id:pet,observed_at:'2026-09-09T09:00:00+00:00',created_at:'2026-09-09T09:00:00+00:00',note:'Исходный текст',type:'appetite',value:'обычный',metadata:{mood:'спокойное',energy:'ниже обычного'},pets:{owner_id:'owner-a'}}));
function client(){const urls:URL[]=[];const fetcher=vi.fn(async(input:RequestInfo|URL)=>{const url=new URL(String(input));urls.push(url);const filter=url.searchParams.get('or');const start=filter?rows.findIndex(r=>filter.includes(`id.lt.${r.id}`))+1:0;return new Response(JSON.stringify(rows.slice(start,start+Number(url.searchParams.get('limit')))),{headers:{'Content-Type':'application/json'}});});return {urls,fetcher,supabase:createClient('https://fixture.invalid','not-a-real-key',{global:{fetch:fetcher}})};}
test('bounded keyset returns every equal-time record once and preserves original metrics',async()=>{
 const c=client();let page=await healthTimelinePageForOwner({...c,ownerId:'owner-a',petId:pet,limit:2});
 expect(page.entries.map(x=>x.id)).toEqual([id(3),id(2)]);expect(page.hasMore).toBe(true);
 expect(page.entries[0]).toMatchObject({note:'Исходный текст',mood:'спокойное',appetite:'обычный',energy:'ниже обычного'});
 expect(page.entries[0]).not.toHaveProperty('pets');
 page=await healthTimelinePageForOwner({...c,ownerId:'owner-a',petId:pet,limit:2,before:parseHealthCursor(page.nextCursor)});
 expect(page.entries.map(x=>x.id)).toEqual([id(1)]);expect(page.nextCursor).toBe(null);
 for(const url of c.urls){expect(url.searchParams.get('pets.owner_id')).toBe('eq.owner-a');expect(url.searchParams.get('pet_id')).toBe(`eq.${pet}`);expect(url.searchParams.get('deleted_at')).toBe('is.null');expect(url.searchParams.get('order')).toBe('observed_at.desc,id.desc');expect(url.searchParams.get('limit')).toBe('3');}
});
test('malformed/injected cursors fail before any database request',async()=>{
 for(const value of ['not-json','{}',JSON.stringify({at:'2026-09-09T09:00:00Z),owner_id.neq.owner-a',id:id(1)}),JSON.stringify({at:'2026-09-09T09:00:00Z',id:'x),pet_id.neq.foo'})])expect(()=>parseHealthCursor(value)).toThrow('INVALID_HEALTH_CURSOR');
 const c=client();await expect(healthTimelinePageForOwner({...c,ownerId:'owner-a',petId:pet,before:{at:'invalid',id:id(1)}})).rejects.toThrow();expect(c.fetcher).not.toHaveBeenCalled();
});
test('failed source is an error, never a truthful-looking empty history',async()=>{
 const supabase=createClient('https://fixture.invalid','not-a-real-key',{global:{fetch:async()=>new Response(JSON.stringify({code:'fixture_failure',message:'unavailable'}),{status:503,headers:{'Content-Type':'application/json'}})}});
 await expect(healthTimelinePageForOwner({supabase,ownerId:'owner-a',petId:pet})).rejects.toMatchObject({code:'fixture_failure'});
});

test('microsecond timestamp stays intact in the next-page cursor',async()=>{
 const supabase=createClient('https://fixture.invalid','not-a-real-key',{global:{fetch:async()=>new Response(JSON.stringify(rows.map(row=>({...row,observed_at:'2026-09-09T09:00:00.123456+00:00'}))),{headers:{'Content-Type':'application/json'}})}});
 const result=await healthTimelinePageForOwner({supabase,ownerId:'owner-a',petId:pet,limit:2});
 expect(parseHealthCursor(result.nextCursor)?.at).toBe('2026-09-09T09:00:00.123456+00:00');
});
