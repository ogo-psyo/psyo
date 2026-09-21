-- Run only against an isolated database; all synthetic records roll back.
begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();p uuid:=gen_random_uuid();r jsonb;again jsonb;rid uuid;at timestamptz:=now()-interval '2 days';n integer;
begin
 insert into auth.users(id,aud,role,email,created_at,updated_at) values(a,'authenticated','authenticated','care-domain-a@example.test',now(),now()),(b,'authenticated','authenticated','care-domain-b@example.test',now(),now());
 insert into public.pets(id,owner_id,name) values(p,a,'Тест');
 r:=public.care_create_reminder_v3(a,'test-domain-new',repeat('a',64),p,'custom','Без категории',now(),'none','test','flexible','{"careDomain":null,"note":"Записано","reminderPreference":"off"}',null);
 rid:=(r->'reminder'->>'id')::uuid;
 again:=public.care_create_reminder_v3(a,'test-domain-new',repeat('a',64),p,'custom','Без категории',now(),'none','test','flexible','{"careDomain":null,"note":"Записано","reminderPreference":"off"}',null);
 assert r=again,'retry differs';
 select count(*) into n from public.reminders where pet_id=p; assert n=1,'duplicate';
 assert r->'reminder'->'metadata'->'careDomain'='null'::jsonb,'null category lost';
 begin
  perform public.care_update_reminder_atomic(b,'test-domain-foreign',repeat('b',64),rid,'{"title":"Stolen"}');
  raise exception 'OWNER_TEST_FAILED';
 exception when others then if SQLERRM='OWNER_TEST_FAILED' then raise;end if;end;
 r:=public.care_update_reminder_atomic(a,'test-domain-update',repeat('c',64),rid,'{"recurrence":"monthly","care_details":{"careDomain":"care","recurrenceBasis":"completed"}}');
 r:=public.care_complete_reminder_atomic(a,'test-domain-complete',repeat('d',64),rid,at);
 assert (r->'reminder'->>'due_at')::timestamptz=public.care_next_due_at_atomic(at,'monthly'),'wrong recurrence basis';
 assert (r->'historyOccurrence'->>'completedAt')::timestamptz=at,'actual date lost';
 again:=public.care_complete_reminder_atomic(a,'test-domain-complete',repeat('d',64),rid,at);assert r=again,'complete replay differs';
 r:=public.care_create_reminder_v3(a,'test-domain-past',repeat('e',64),p,'custom','Было сделано',at,'none','test','flexible','{"careDomain":"health"}',at);
 assert r->'reminder'->>'status'='done','past fact left active';
 assert (r->'reminder'->>'completed_at')::timestamptz=at,'past fact date lost';
 assert not has_function_privilege('anon','public.care_create_reminder_v3(uuid,text,text,uuid,text,text,timestamptz,text,text,text,jsonb,timestamptz)','execute'),'public execution';
 raise notice 'PASS free/metadata/past fact/recurrence/ownership/idempotency/privileges';
end $$;
rollback;
