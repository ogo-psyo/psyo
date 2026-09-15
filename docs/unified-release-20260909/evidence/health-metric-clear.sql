-- Actual canonical RPC in the isolated fixture DB; all generated rows rolled back.
begin;
do $$
declare owner uuid:=gen_random_uuid();pet uuid:=gen_random_uuid();record_id uuid;result jsonb;replay jsonb;key text:=gen_random_uuid()::text;
begin
 insert into auth.users(id) values(owner);
 insert into public.pets(id,owner_id,name) values(pet,owner,'QA temporary dog');
 result:=public.care_observation_atomic(owner,key||':create',repeat('a',64),'create',pet,
 jsonb_build_object('type','mood','value','спокойное','note','Исходный текст','metadata',jsonb_build_object('mood','спокойное','energy','ниже обычного','provenance','keep')));
 record_id:=(result->'observation'->>'id')::uuid;
 result:=public.care_observation_atomic(owner,key||':clear',repeat('b',64),'update',record_id,
 '{"type":"energy","value":"ниже обычного","note":"Исходный текст","metadata":{"mood":"","appetite":"","stool":"","energy":"ниже обычного"}}');
 replay:=public.care_observation_atomic(owner,key||':clear',repeat('b',64),'update',record_id,
 '{"type":"energy","value":"ниже обычного","note":"Исходный текст","metadata":{"mood":"","appetite":"","stool":"","energy":"ниже обычного"}}');
 if result<>replay or result->'observation'->'metadata'->>'mood'<>'' or result->'observation'->'metadata'->>'energy'<>'ниже обычного' or result->'observation'->'metadata'->>'provenance'<>'keep' then raise exception 'clear/replay/metadata preservation failed';end if;
 result:=public.care_observation_atomic(owner,key||':plain',repeat('c',64),'update',record_id,
 '{"type":"note","value":"Только текст","note":"Только текст","metadata":{"mood":"","appetite":"","stool":"","energy":""}}');
 if result->'observation'->>'type'<>'note' or result->'observation'->>'note'<>'Только текст' or result->'observation'->'metadata'->>'energy'<>'' then raise exception 'plain note conversion failed';end if;
 raise notice 'PASS canonical observation RPC: clear metric, preserve unrelated metadata, replay, convert to plain note';
end $$;
rollback;
