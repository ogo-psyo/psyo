\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values('dddddddd-0000-4000-8000-000000000001'),('dddddddd-0000-4000-8000-000000000002');
insert into public.profiles(id) values('dddddddd-0000-4000-8000-000000000001'),('dddddddd-0000-4000-8000-000000000002');
insert into public.pets(id,owner_id,name) values('dddddddd-0000-4000-8000-000000000003','dddddddd-0000-4000-8000-000000000001','Observation QA');
create function public.qa_draft_fault() returns trigger language plpgsql as $$ begin if new.status='saved' then raise exception 'INJECT_DRAFT_FAILURE';end if;return new;end $$;
create trigger qa_draft_fault before update on public.agent_observation_drafts for each row execute function public.qa_draft_fault();
do $$
declare owner uuid:='dddddddd-0000-4000-8000-000000000001';pet uuid:='dddddddd-0000-4000-8000-000000000003';
 r jsonb;d jsonb;repeat_d jsonb;a jsonb;b jsonb;review jsonb;
begin
 r:=public.agent_admit_run(owner,pet,null,gen_random_uuid(),'После прогулки заметил вялость. Съела половину порции.');
 update public.agent_runs set status='running' where id=(r->>'id')::uuid;
 d:=public.agent_prepare_observation(owner,(r->>'id')::uuid,'{"mood":"вялое","appetite":"ниже обычного","stool":"","energy":""}');
 repeat_d:=public.agent_prepare_observation(owner,(r->>'id')::uuid,'{}');
 if d->>'id'<>repeat_d->>'id' or d->'metrics'<>repeat_d->'metrics' then raise exception 'prepare overwrote or duplicated';end if;
 if d->>'source_text'<>r->>'question' then raise exception 'source text lost';end if;
 if exists(select 1 from public.pet_observations where pet_id=pet) then raise exception 'prepared persisted fact';end if;
 review:=jsonb_build_object('note','Уточнённая запись','observedAt','2026-09-09T07:00:00Z','metrics','{"mood":"вялое","appetite":"","stool":"","energy":""}'::jsonb);
 begin
  perform public.agent_confirm_observation('dddddddd-0000-4000-8000-000000000002',(d->>'id')::uuid,review);
  raise exception 'foreign save allowed';
 exception when others then if sqlerrm<>'DRAFT_NOT_FOUND' then raise;end if;end;
 update public.agent_runs set status='cancelled' where id=(r->>'id')::uuid;
 begin
  perform public.agent_confirm_observation(owner,(d->>'id')::uuid,review);raise exception 'cancelled save allowed';
 exception when others then if sqlerrm<>'RUN_NOT_READY' then raise;end if;end;
 begin
  perform public.agent_prepare_observation(owner,(r->>'id')::uuid,'{}');raise exception 'cancelled prepare allowed';
 exception when others then if sqlerrm<>'RUN_STOPPED' then raise;end if;end;
 update public.agent_runs set status='succeeded' where id=(r->>'id')::uuid;
 begin
  perform public.agent_confirm_observation(owner,(d->>'id')::uuid,review);raise exception 'fault absent';
 exception when others then if sqlerrm<>'INJECT_DRAFT_FAILURE' then raise;end if;end;
 if exists(select 1 from public.pet_observations where pet_id=pet) then raise exception 'partial observation commit';end if;
 if exists(select 1 from public.care_mutations where owner_id=owner) then raise exception 'partial receipt commit';end if;
 alter table public.agent_observation_drafts disable trigger qa_draft_fault;
 a:=public.agent_confirm_observation(owner,(d->>'id')::uuid,review);
 b:=public.agent_confirm_observation(owner,(d->>'id')::uuid,review);
 if a->'observation'->>'id'<>b->'observation'->>'id' or (select count(*) from public.pet_observations where pet_id=pet)<>1 then raise exception 'duplicate save';end if;
 if a->'observation'->'metadata'->>'source_text'<>r->>'question' then raise exception 'saved source lost';end if;
 begin
  perform public.agent_confirm_observation(owner,(d->>'id')::uuid,review||'{"note":"other device"}');raise exception 'changed replay allowed';
 exception when others then if sqlerrm<>'DRAFT_ALREADY_SAVED' then raise;end if;end;
 update public.pet_observations set deleted_at=now() where id=(a->'observation'->>'id')::uuid;
 begin
  perform public.agent_confirm_observation(owner,(d->>'id')::uuid,review);raise exception 'deleted result replay accepted';
 exception when others then if sqlerrm<>'OBSERVATION_NOT_FOUND' then raise;end if;end;
 if (select count(*) from public.pet_observations where pet_id=pet)<>1 then raise exception 'deleted result resurrected';end if;
 r:=public.agent_admit_run(owner,pet,null,gen_random_uuid(),'Обычная текстовая заметка');
 update public.agent_runs set status='running' where id=(r->>'id')::uuid;
 d:=public.agent_prepare_observation(owner,(r->>'id')::uuid,'{}');
 update public.agent_runs set status='succeeded' where id=(r->>'id')::uuid;
 a:=public.agent_confirm_observation(owner,(d->>'id')::uuid,null);
 b:=public.agent_confirm_observation(owner,(d->>'id')::uuid,null);
 if a->'draft'->>'status'<>'discarded' or a<>b then raise exception 'discard not idempotent';end if;
 begin
  perform public.agent_confirm_observation(owner,(d->>'id')::uuid,review);raise exception 'discarded save allowed';
 exception when others then if sqlerrm<>'DRAFT_DISCARDED' then raise;end if;end;
 if has_function_privilege('authenticated','public.agent_confirm_observation(uuid,uuid,jsonb)','EXECUTE') or has_table_privilege('authenticated','public.agent_observation_drafts','INSERT') then raise exception 'unsafe grants';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','dddddddd-0000-4000-8000-000000000002',true);
do $$ begin if exists(select 1 from public.agent_observation_drafts) then raise exception 'foreign RLS read';end if;end $$;
select set_config('request.jwt.claim.sub','dddddddd-0000-4000-8000-000000000001',true);
do $$ begin if (select count(*) from public.agent_observation_drafts)<>2 then raise exception 'own RLS read blocked';end if;end $$;
reset role;
rollback;
