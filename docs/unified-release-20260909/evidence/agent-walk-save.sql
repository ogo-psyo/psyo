-- Only pso_release_atomic_test. All generated rows and injected triggers roll back.
begin;
create function public.qa_agent_walk_fail() returns trigger language plpgsql as $fault$ begin if new.kind='walk' then raise exception 'QA_AFTER_ROUTE_WRITE';end if;return new;end $fault$;
create trigger qa_agent_walk_fail before insert on public.agent_mutations for each row execute function public.qa_agent_walk_fail();
do $$
declare own uuid:=gen_random_uuid();pet uuid:=gen_random_uuid();thread uuid:=gen_random_uuid();source uuid:=gen_random_uuid();acting uuid:=gen_random_uuid();acting2 uuid:=gen_random_uuid();route uuid:=gen_random_uuid();walk jsonb;row_data jsonb;saved jsonb;replay jsonb;
begin
 insert into auth.users(id) values(own);
 insert into public.profiles(id) values(own);
 insert into public.pets(id,owner_id,name) values(pet,own,'Agent route QA');
 insert into public.assistant_threads(id,pet_id,kind,title) values(thread,pet,'general','QA walk');
 walk:='{"title":"QA walk","path":[[37.6,55.75],[37.601,55.751]],"stops":[{"point":[37.6,55.75],"title":"Start","placeId":"qa-start"},{"point":[37.601,55.751],"title":"Finish","placeId":"qa-finish"}],"snaps":[{"point":[37.6,55.75],"distanceMeters":0},{"point":[37.601,55.751],"distanceMeters":0}],"distanceMeters":150,"estimatedMinutes":2,"stairs":false,"source":"OpenStreetMap","calculatedAt":"2026-09-09T10:00:00Z"}';
 row_data:=jsonb_build_object('pet_id',pet,'title','QA walk','path','SRID=4326;LINESTRING(37.6 55.75, 37.601 55.751)','visibility','private','moderation_status','approved','route_source','planned','color','#3b82f6','planning',jsonb_build_object('version',1,'mode','walking','stops',walk->'stops','estimatedMinutes',2),'path_gaps','[]'::jsonb,'distance_meters',150);
 insert into public.agent_runs(id,owner_id,pet_id,thread_id,request_id,question,status,result) values(source,own,pet,thread,gen_random_uuid(),'Покажи прогулку','succeeded',jsonb_build_object('walk',walk));
 insert into public.agent_runs(id,owner_id,pet_id,thread_id,request_id,question,status) values(acting,own,pet,thread,gen_random_uuid(),'Сохрани прогулку','running');
 begin
  perform public.agent_save_walk_atomic(own,route,repeat('a',64),row_data,source,acting,walk);raise exception 'FAULT_NOT_INJECTED';
 exception when others then if sqlerrm<>'QA_AFTER_ROUTE_WRITE' then raise;end if;end;
 if exists(select 1 from public.map_routes where id=route) or exists(select 1 from public.map_route_save_receipts where id=route) or exists(select 1 from public.agent_mutations where run_id=acting) then raise exception 'PARTIAL_COMMIT';end if;
 execute 'drop trigger qa_agent_walk_fail on public.agent_mutations';
 saved:=public.agent_save_walk_atomic(own,route,repeat('a',64),row_data,source,acting,walk);
 if saved->'feature'->>'id'<>route::text or saved->'feature'->>'visibility'<>'private' or saved->'feature'->'path'->'coordinates'<>walk->'path' or saved->'feature'->'planning'->'stops'<>walk->'stops' then raise exception 'CANONICAL_ROUTE_MISMATCH';end if;
 replay:=public.agent_save_walk_atomic(own,route,repeat('a',64),row_data,source,acting,walk);
 if replay->>'replayed'<>'true' or (select count(*) from public.map_routes where id=route)<>1 then raise exception 'REPLAY_FAILED';end if;
 begin
  perform public.agent_save_result(own,source,acting);raise exception 'WALK_CONFUSED_WITH_TEXT';
 exception when others then if sqlerrm<>'WRITE_ALREADY_PERFORMED' then raise;end if;end;
 begin
  perform public.agent_edit_memory(own,pet,'qa','unwanted',acting);raise exception 'WALK_CONFUSED_WITH_MEMORY';
 exception when others then if sqlerrm<>'WRITE_ALREADY_PERFORMED' then raise;end if;end;
 if has_function_privilege('authenticated','public.agent_save_walk_atomic(uuid,uuid,text,jsonb,uuid,uuid,jsonb)','EXECUTE') or has_table_privilege('anon','public.map_route_save_receipts','SELECT') then raise exception 'PRIVILEGE_LEAK';end if;
 -- Terminal failure/cancel cannot erase an already committed action.
 update public.agent_runs set status='cancelled' where id=acting;
 if not exists(select 1 from public.agent_mutations where run_id=acting and kind='walk' and result->>'id'=route::text) then raise exception 'COMMITTED_ACTION_LOST';end if;
 begin
  perform public.agent_save_walk_atomic(own,route,repeat('a',64),row_data,source,acting,walk);raise exception 'CANCEL_ACCEPTED';
 exception when others then if sqlerrm<>'RUN_STOPPED' then raise;end if;end;
 insert into public.agent_runs(id,owner_id,pet_id,thread_id,request_id,question,status) values(acting2,own,pet,thread,gen_random_uuid(),'Сохрани','running');
 replay:=public.agent_save_walk_atomic(own,route,repeat('a',64),row_data,source,acting2,walk);
 if replay->>'replayed'<>'true' then raise exception 'SECOND_RUN_DUPLICATED_ROUTE';end if;
 begin
  perform public.agent_save_walk_atomic(gen_random_uuid(),gen_random_uuid(),repeat('a',64),row_data,source,acting2,walk);raise exception 'FOREIGN_OWNER_ACCEPTED';
 exception when others then if sqlerrm<>'RUN_STOPPED' then raise;end if;end;
 begin
  perform public.agent_save_walk_atomic(own,gen_random_uuid(),repeat('b',64),jsonb_set(row_data,'{visibility}','"public"'),source,acting2,walk);raise exception 'PUBLIC_ACCEPTED';
 exception when others then if sqlerrm<>'PROPOSAL_NOT_AVAILABLE' then raise;end if;end;
 begin
  perform public.agent_save_walk_atomic(own,gen_random_uuid(),repeat('b',64),jsonb_set(row_data,'{path}','"SRID=4326;LINESTRING(37.6 55.75, 37.9 55.9)"'),source,acting2,walk);raise exception 'INVENTED_PATH_ACCEPTED';
 exception when others then if sqlerrm<>'PROPOSAL_NOT_AVAILABLE' then raise;end if;end;
 update public.agent_runs set question='Сохрани ответ, не прогулку' where id=acting2;
 begin
  perform public.agent_save_walk_atomic(own,route,repeat('a',64),row_data,source,acting2,walk);raise exception 'UNRELATED_COMMAND_ACCEPTED';
 exception when others then if sqlerrm<>'EXPLICIT_WALK_SAVE_REQUIRED' then raise;end if;end;
 update public.agent_runs set question='Сохрани прогулку' where id=acting2;
 delete from public.map_routes where id=route;
 if (select route_id from public.map_route_save_receipts where id=route) is not null then raise exception 'TOMBSTONE_LOST';end if;
 begin
  perform public.agent_save_walk_atomic(own,route,repeat('a',64),row_data,source,acting2,walk);raise exception 'DELETED_ROUTE_RECREATED';
 exception when others then if sqlerrm<>'ROUTE_REMOVED' then raise;end if;end;
 insert into public.agent_pet_state(owner_id,pet_id,privacy_epoch) values(own,pet,now()+interval '1 second');
 begin
  perform public.agent_save_walk_atomic(own,route,repeat('a',64),row_data,source,acting2,walk);raise exception 'ERASED_CONTEXT_ACCEPTED';
 exception when others then if sqlerrm<>'PROPOSAL_NOT_AVAILABLE' then raise;end if;end;
 raise notice 'PASS injected mid-transaction rollback, mutation-kind isolation, service-only grants; canonical geometry/stops; same/new-run retry; committed action survives cancellation; owner, public/path, negative intent, deletion and privacy-era guards';
end $$;
rollback;
