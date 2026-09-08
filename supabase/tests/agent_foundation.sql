\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values('eeeeeeee-0000-4000-8000-000000000001'),('eeeeeeee-0000-4000-8000-000000000002');
insert into public.profiles(id) values('eeeeeeee-0000-4000-8000-000000000001'),('eeeeeeee-0000-4000-8000-000000000002');
insert into public.pets(id,owner_id,name) values('eeeeeeee-0000-4000-8000-000000000003','eeeeeeee-0000-4000-8000-000000000001','Agent QA');
do $$
declare a jsonb;b jsonb;c jsonb;d jsonb;begin
 a:=public.agent_admit_run('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003',null,'eeeeeeee-0000-4000-8000-000000000004','Помоги подготовить поездку');
 b:=public.agent_admit_run('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003',null,'eeeeeeee-0000-4000-8000-000000000004','Помоги подготовить поездку');
 if a->>'id'<>b->>'id' then raise exception 'duplicate run'; end if;
 begin
  perform public.agent_admit_run('eeeeeeee-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000003',null,gen_random_uuid(),'foreign');
  raise exception 'cross-owner admission allowed';
 exception when others then if sqlerrm<>'PET_NOT_FOUND' then raise;end if;end;
 begin
  perform public.agent_admit_run('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003',null,'eeeeeeee-0000-4000-8000-000000000004','different request');
  raise exception 'request conflict allowed';
 exception when others then if sqlerrm<>'REQUEST_CONFLICT' then raise;end if;end;
 perform public.agent_edit_memory('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003','прогулки','Боится велосипедов');
 if (select status from public.agent_runs where id=(a->>'id')::uuid)<>'cancelled' then raise exception 'memory change did not stop stale run';end if;
 perform public.agent_edit_memory('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003','прогулки','Любит спокойные дорожки');
 if (select count(*) from public.agent_memories where pet_id='eeeeeeee-0000-4000-8000-000000000003')<>1 then raise exception 'memory correction duplicated';end if;
 perform public.agent_edit_memory('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003','прогулки',null);
 if exists(select 1 from public.agent_memories where pet_id='eeeeeeee-0000-4000-8000-000000000003' and content is not null) then raise exception 'memory not forgotten';end if;
 if not exists(select 1 from public.agent_pet_state where pet_id='eeeeeeee-0000-4000-8000-000000000003') then raise exception 'privacy epoch missing';end if;
 if has_table_privilege('anon','public.agent_runs','SELECT') or has_table_privilege('authenticated','public.agent_runs','INSERT') then raise exception 'unsafe client grants';end if;
 if has_function_privilege('authenticated','public.agent_admit_run(uuid,uuid,uuid,uuid,text)','EXECUTE') then raise exception 'unsafe admission RPC grant';end if;
 update public.agent_runs set status='succeeded',result='{"answer":"Verified plan","sources":[]}'::jsonb where id=(a->>'id')::uuid;
 b:=public.agent_admit_run('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003',(a->>'thread_id')::uuid,gen_random_uuid(),'сохрани');
 update public.agent_runs set status='running' where id=(b->>'id')::uuid;
 c:=public.agent_save_result('eeeeeeee-0000-4000-8000-000000000001',(a->>'id')::uuid,(b->>'id')::uuid);
 d:=public.agent_save_result('eeeeeeee-0000-4000-8000-000000000001',(a->>'id')::uuid,(b->>'id')::uuid);
 if c->>'id'<>d->>'id' then raise exception 'save replay duplicated artifact';end if;
 update public.agent_runs set status='cancelled' where id=(b->>'id')::uuid;
 begin
  perform public.agent_save_result('eeeeeeee-0000-4000-8000-000000000001',(a->>'id')::uuid,(b->>'id')::uuid);
  raise exception 'cancelled run could save';
 exception when others then if sqlerrm<>'RUN_STOPPED' then raise;end if;end;
 b:=public.agent_admit_run('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003',(a->>'thread_id')::uuid,gen_random_uuid(),'запомни: предпочитает лес');
 update public.agent_runs set status='running' where id=(b->>'id')::uuid;
 c:=public.agent_edit_memory('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003','места','предпочитает лес',(b->>'id')::uuid);
 d:=public.agent_edit_memory('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003','другое имя','предпочитает лес',(b->>'id')::uuid);
 if c->>'id'<>d->>'id' then raise exception 'memory replay duplicated fact';end if;
 if (select status from public.agent_runs where id=(b->>'id')::uuid)<>'running' then raise exception 'memory tool cancelled itself';end if;
 perform public.agent_edit_memory('eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000003','места',null);
 if exists(select 1 from public.agent_mutations where run_id=(b->>'id')::uuid) then raise exception 'forget left derived memory payload';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','eeeeeeee-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.agent_runs where pet_id='eeeeeeee-0000-4000-8000-000000000003') then raise exception 'RLS leaked other owner';end if;
end $$;
select set_config('request.jwt.claim.sub','eeeeeeee-0000-4000-8000-000000000001',true);
do $$ begin
 if not exists(select 1 from public.agent_runs where pet_id='eeeeeeee-0000-4000-8000-000000000003') then raise exception 'RLS hid own run';end if;
end $$;
reset role;
rollback;
