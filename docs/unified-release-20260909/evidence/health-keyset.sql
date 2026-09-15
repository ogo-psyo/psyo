-- Synthetic, temporary rows only; run in pso_release_atomic_test, never production.
begin;
create temporary table health_page_fixture (id uuid, pet_id uuid, owner_id text, observed_at timestamptz, deleted_at timestamptz, metadata jsonb);
insert into health_page_fixture values
 ('22222222-2222-4222-8222-000000000003','11111111-1111-4111-8111-111111111111','qa-a','2026-09-09T09:00:00.123456Z',null,'{"mood":"спокойное","energy":"обычная"}'),
 ('22222222-2222-4222-8222-000000000002','11111111-1111-4111-8111-111111111111','qa-a','2026-09-09T09:00:00.123456Z',null,'{}'),
 ('22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-111111111111','qa-a','2026-09-09T09:00:00.123456Z',null,'{}'),
 ('22222222-2222-4222-8222-000000000004','11111111-1111-4111-8111-111111111111','qa-a','2026-09-09T08:00:00Z',now(),'{}'),
 ('22222222-2222-4222-8222-000000000005','11111111-1111-4111-8111-111111111111','qa-b','2026-09-09T08:00:00Z',null,'{}');
do $$ declare count_rows int; found_id uuid; begin
 select count(*),min(id::text)::uuid into count_rows,found_id from health_page_fixture
 where pet_id='11111111-1111-4111-8111-111111111111' and owner_id='qa-a' and deleted_at is null
 and (observed_at < '2026-09-09T09:00:00.123456+00:00' or (observed_at='2026-09-09T09:00:00.123456+00:00' and id<'22222222-2222-4222-8222-000000000002'));
 if count_rows<>1 or found_id<>'22222222-2222-4222-8222-000000000001' then raise exception 'keyset/owner/deleted contract failed';end if;
 raise notice 'PASS synthetic Postgres keyset: equal microsecond timestamps, owner and deleted filters';
end $$;
rollback;
