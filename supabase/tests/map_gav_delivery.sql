-- Run inside an outer transaction that applies this delivery's additive migrations. Fixtures roll back.
create extension if not exists pgtap with schema extensions;
select plan(11);
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at) values
 ('57111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','map-gav-a@example.test','',now(),now()),
 ('57222222-2222-4222-8222-222222222222','00000000-0000-0000-0000-000000000000','authenticated','authenticated','map-gav-b@example.test','',now(),now());
insert into public.pets(id,owner_id,name) values
 ('57aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','57111111-1111-4111-8111-111111111111','Тест А'),
 ('57bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','57222222-2222-4222-8222-222222222222','Тест Б');
select lives_ok($$insert into public.map_libraries(pet_id,owner_id,revision,document) values('57aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','57111111-1111-4111-8111-111111111111',1,'{"version":1,"places":[],"collections":[],"applied":[]}')$$,'create private library');
with updated as (update public.map_libraries set revision=2 where pet_id='57aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and revision=1 returning revision) select is(count(*),1::bigint,'current revision updates') from updated;
with updated as (update public.map_libraries set revision=3 where pet_id='57aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and revision=1 returning revision) select is(count(*),0::bigint,'stale revision cannot overwrite') from updated;
set local role authenticated;
select set_config('request.jwt.claim.sub','57222222-2222-4222-8222-222222222222',true);
select is((select count(*) from public.map_libraries where pet_id='57aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),0::bigint,'other owner cannot read library');
select throws_ok($$update public.map_libraries set revision=4$$,'42501',null,'direct client writes denied');
reset role;
insert into public.social_match_requests(id,sender_owner_id,recipient_owner_id,sender_pet_id,recipient_pet_id,scenario,status,source,idempotency_key,request_fingerprint) values
 ('57cccccc-cccc-4ccc-8ccc-cccccccccccc','57111111-1111-4111-8111-111111111111','57222222-2222-4222-8222-222222222222','57aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','57bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','walk','accepted','organic','map-gav-test-request',repeat('a',64));
select lives_ok($$insert into public.social_meeting_proposals(id,request_id,author_owner_id,author_pet_id,kind,source_id,snapshot,fingerprint) values('57dddddd-dddd-4ddd-8ddd-dddddddddddd','57cccccc-cccc-4ccc-8ccc-cccccccccccc','57111111-1111-4111-8111-111111111111','57aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','place','p','{}','test')$$,'accepted participant may propose');
update public.social_match_requests set status='cancelled' where id='57cccccc-cccc-4ccc-8ccc-cccccccccccc';
select throws_ok($$insert into public.social_meeting_proposals(id,request_id,author_owner_id,author_pet_id,kind,source_id,snapshot,fingerprint) values('57eeeeee-eeee-4eee-8eee-eeeeeeeeeeee','57cccccc-cccc-4ccc-8ccc-cccccccccccc','57111111-1111-4111-8111-111111111111','57aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','place','p','{}','test')$$,'P0001','CONNECTION_UNAVAILABLE','closed connection rejects publication');
select has_column('public','map_routes','path_gaps','GPS breaks persist separately from geometry');
select is(public.take_map_search_slot(),true,'first provider request fits budget');
select is(public.take_map_search_slot(),false,'second concurrent provider request is refused');
select is((select requests from public.map_provider_budget where provider='osm-search'),1::bigint,'provider budget counts only allowed request');
select * from finish();
