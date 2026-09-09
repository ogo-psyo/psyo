-- Additive. Canonical route receipts survive deletion; old fields/links are preserved.
begin;
-- The trigger inherits callers' search_path; qualify PostGIS for the restricted RPC.
create or replace function public.sync_map_route_projection()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.path is not null then
  new.approximate_center=public.st_snaptogrid(public.st_centroid(new.path),0.01);
  new.area_label=coalesce(nullif(btrim(new.area_label),''),'примерный район маршрута');
 else new.approximate_center=null;end if;
 if new.visibility<>'shared' then new.share_token=null;end if;
 return new;
end $$;
create table public.map_route_save_receipts (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 route_id uuid references public.map_routes(id) on delete set null,
 fingerprint text not null check(length(fingerprint)=64),
 created_at timestamptz not null default now()
);
alter table public.map_route_save_receipts enable row level security;
revoke all on public.map_route_save_receipts from public,anon,authenticated;
grant all on public.map_route_save_receipts to service_role;
insert into public.map_route_save_receipts(id,owner_id,route_id,fingerprint)
 select id,owner_id,id,request_fingerprint from public.map_routes where length(request_fingerprint)=64;

create function public.map_save_route_atomic(p_owner uuid,p_id uuid,p_fingerprint text,p_route jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt public.map_route_save_receipts; saved public.map_routes; pet uuid; replay boolean:=false; shape public.geometry;
begin
 if p_owner is null then raise exception 'AUTH_REQUIRED';end if;
 if p_id is null or length(p_fingerprint)<>64 or jsonb_typeof(p_route)<>'object' or nullif(btrim(p_route->>'title'),'') is null then raise exception 'INVALID_ROUTE';end if;
 pet:=nullif(p_route->>'pet_id','')::uuid;
 if pet is not null then
  perform 1 from public.pets where id=pet and owner_id=p_owner for share;
  if not found then raise exception 'PET_NOT_FOUND';end if;
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('map-route:'||p_id::text,0));
 -- Do not lock this FK child before its route: a concurrent DELETE updates the tombstone.
 select * into receipt from public.map_route_save_receipts where id=p_id;
 if found then
  if receipt.owner_id<>p_owner or receipt.fingerprint<>p_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  if receipt.route_id is null then raise exception 'ROUTE_REMOVED';end if;
  select * into saved from public.map_routes where id=receipt.route_id and owner_id=p_owner for share;
  if not found then raise exception 'ROUTE_REMOVED';end if;
  if saved.pet_id is distinct from pet then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  replay:=true;
 else
  -- Transitional legacy writer may have committed after the receipt seed.
  select * into saved from public.map_routes where id=p_id and owner_id=p_owner for share;
  if found then
   if saved.request_fingerprint is distinct from p_fingerprint or saved.pet_id is distinct from pet then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   replay:=true;
  else
   shape:=public.st_geomfromewkt(p_route->>'path');
   if public.st_srid(shape)<>4326 or public.geometrytype(shape)<>'LINESTRING' or public.st_npoints(shape)<2 then raise exception 'INVALID_ROUTE';end if;
   insert into public.map_routes(id,owner_id,pet_id,title,description,path,color,visibility,moderation_status,share_token,route_source,planning,path_gaps,started_at,duration_seconds,distance_meters,request_fingerprint)
   values(p_id,p_owner,pet,btrim(p_route->>'title'),nullif(p_route->>'description',''),shape,p_route->>'color',p_route->>'visibility',p_route->>'moderation_status',nullif(p_route->>'share_token','')::uuid,
    p_route->>'route_source',nullif(p_route->'planning','null'::jsonb),array(select jsonb_array_elements_text(coalesce(p_route->'path_gaps','[]'::jsonb))::integer),
    nullif(p_route->>'started_at','')::timestamptz,(p_route->>'duration_seconds')::integer,(p_route->>'distance_meters')::integer,p_fingerprint)
   returning * into saved;
  end if;
  insert into public.map_route_save_receipts(id,owner_id,route_id,fingerprint) values(p_id,p_owner,saved.id,p_fingerprint);
 end if;
 return jsonb_build_object('replayed',replay,'feature',to_jsonb(saved)||jsonb_build_object('path',public.st_asgeojson(saved.path,15,0)::jsonb));
end $$;
revoke all on function public.map_save_route_atomic(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.map_save_route_atomic(uuid,uuid,text,jsonb) to service_role;

create function public.agent_save_walk_atomic(p_owner uuid,p_id uuid,p_fingerprint text,p_route jsonb,p_source uuid,p_acting uuid,p_expected_walk jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare source public.agent_runs; acting public.agent_runs; prior public.agent_mutations; epoch timestamptz; walk jsonb; saved jsonb; expected_shape public.geometry;
begin
 -- Match the memory/erasure lock order. Source context cannot race a privacy-epoch change.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('agent:'||p_owner::text,0));
 select * into acting from public.agent_runs where id=p_acting and owner_id=p_owner and status='running' for update;
 if not found then raise exception 'RUN_STOPPED';end if;
 if acting.question !~* '^\s*сохрани(\s|[.!?,]|$)' or acting.question ~* '(^|\s)не(\s|$)' or acting.question ~* '(ответ|сообщени|текст|заметк|наблюден)' then raise exception 'EXPLICIT_WALK_SAVE_REQUIRED';end if;
 if acting.question !~* '(прогулк|маршрут)' and acting.question !~* '^\s*сохрани[.!?,\s]*$' then raise exception 'EXPLICIT_WALK_SAVE_REQUIRED';end if;
 if acting.question !~* '(прогулк|маршрут)' and p_source is distinct from (select id from public.agent_runs where owner_id=p_owner and thread_id=acting.thread_id and status='succeeded' order by created_at desc limit 1) then raise exception 'PROPOSAL_NOT_AVAILABLE';end if;
 select * into source from public.agent_runs where id=p_source and owner_id=p_owner and pet_id=acting.pet_id and thread_id=acting.thread_id and status='succeeded' for share;
 if not found then raise exception 'PROPOSAL_NOT_AVAILABLE';end if;
 select privacy_epoch into epoch from public.agent_pet_state where pet_id=acting.pet_id and owner_id=p_owner;
 if source.created_at<coalesce(epoch,'-infinity'::timestamptz) then raise exception 'PROPOSAL_NOT_AVAILABLE';end if;
 walk:=source.result->'walk';
 if walk is null or walk is distinct from p_expected_walk or jsonb_typeof(walk->'path')<>'array' or jsonb_array_length(walk->'path')<2 then raise exception 'PROPOSAL_NOT_AVAILABLE';end if;
 if (p_route->>'pet_id')::uuid is distinct from acting.pet_id or p_route->>'visibility'<>'private' or p_route->>'route_source'<>'planned' or p_route->>'title' is distinct from btrim(walk->>'title') then raise exception 'PROPOSAL_NOT_AVAILABLE';end if;
 expected_shape:=public.st_setsrid(public.st_geomfromgeojson(jsonb_build_object('type','LineString','coordinates',walk->'path')::text),4326);
 if not public.st_orderingequals(public.st_geomfromewkt(p_route->>'path'),expected_shape)
  or p_route->'planning'->'stops' is distinct from walk->'stops'
  or p_route->'planning'->>'mode'<>'walking'
  or (p_route->>'distance_meters')::numeric is distinct from round((walk->>'distanceMeters')::numeric)
  or (p_route->'planning'->>'estimatedMinutes')::numeric is distinct from round((walk->>'estimatedMinutes')::numeric)
  or coalesce((p_route->'planning'->>'stairs')::boolean,false) is distinct from (walk->>'stairs')::boolean
 then raise exception 'PROPOSAL_NOT_AVAILABLE';end if;
 select * into prior from public.agent_mutations where run_id=p_acting;
 if found and (prior.kind<>'walk' or prior.result->>'sourceRunId' is distinct from p_source::text or prior.result->>'id' is distinct from p_id::text) then raise exception 'WRITE_ALREADY_PERFORMED';end if;
 saved:=public.map_save_route_atomic(p_owner,p_id,p_fingerprint,p_route);
 insert into public.agent_mutations(run_id,kind,result)
 values(p_acting,'walk',jsonb_build_object('id',saved->'feature'->>'id','title',saved->'feature'->>'title','sourceRunId',p_source))
 on conflict(run_id) do nothing;
 return saved;
end $$;
revoke all on function public.agent_save_walk_atomic(uuid,uuid,text,jsonb,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.agent_save_walk_atomic(uuid,uuid,text,jsonb,uuid,uuid,jsonb) to service_role;

-- Never mistake a committed walk for a saved text answer or memory.
create or replace function public.agent_edit_memory(p_owner uuid,p_pet uuid,p_key text,p_content text,p_acting uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.agent_memories;cached jsonb; begin
 if not exists(select 1 from pets where id=p_pet and owner_id=p_owner) then raise exception 'PET_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended('agent:'||p_owner::text,0));
 if p_acting is not null then
  perform 1 from agent_runs where id=p_acting and owner_id=p_owner and pet_id=p_pet and status='running' for update;
  if not found then raise exception 'RUN_STOPPED';end if;
  select result into cached from agent_mutations where run_id=p_acting;
  if found then
   if not exists(select 1 from agent_mutations where run_id=p_acting and kind='memory') then raise exception 'WRITE_ALREADY_PERFORMED';end if;
   return cached;end if;
 end if;
 insert into agent_memories(owner_id,pet_id,memory_key,content,source_run_id) values(p_owner,p_pet,p_key,p_content,p_acting)
 on conflict(pet_id,memory_key) do update set content=excluded.content,source_run_id=p_acting,updated_at=now()
 returning * into m;
 delete from agent_mutations where kind='memory' and result->>'id'=m.id::text and run_id is distinct from p_acting;
 -- Old conversation context cannot silently recreate a forgotten/corrected fact.
 insert into agent_pet_state(owner_id,pet_id,privacy_epoch) values(p_owner,p_pet,now())
 on conflict(pet_id) do update set privacy_epoch=excluded.privacy_epoch;
 update agent_runs set status='cancelled',updated_at=now() where pet_id=p_pet and owner_id=p_owner and status in ('queued','running') and id is distinct from p_acting;
 if p_acting is not null then insert into agent_mutations(run_id,kind,result) values(p_acting,'memory',to_jsonb(m));end if;
 return to_jsonb(m);
end $$;
revoke all on function public.agent_edit_memory(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.agent_edit_memory(uuid,uuid,text,text,uuid) to service_role;

create or replace function public.agent_save_result(p_owner uuid,p_result uuid,p_acting uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.agent_runs;a public.agent_artifacts;cached jsonb;begin
 select * into r from agent_runs where id=p_result and owner_id=p_owner and status='succeeded';
 if not found or not exists(select 1 from pets where id=r.pet_id and owner_id=p_owner) then raise exception 'RESULT_NOT_FOUND';end if;
 if p_acting is not null then
  perform 1 from agent_runs where id=p_acting and owner_id=p_owner and thread_id=r.thread_id and status='running' for update;
  if not found then raise exception 'RUN_STOPPED';end if;
  select result into cached from agent_mutations where run_id=p_acting;
  if found then
   if not exists(select 1 from agent_mutations where run_id=p_acting and kind='save' and result->>'run_id'=p_result::text) then raise exception 'WRITE_ALREADY_PERFORMED';end if;
   return cached;end if;
 end if;
 insert into agent_artifacts(owner_id,pet_id,run_id,title,content,sources,saved_at)
 values(p_owner,r.pet_id,r.id,left(r.question,200),r.result->>'answer',coalesce(r.result->'sources','[]'::jsonb),now())
 on conflict(run_id) do update set saved_at=coalesce(agent_artifacts.saved_at,excluded.saved_at)
 returning * into a;
 if p_acting is not null then insert into agent_mutations(run_id,kind,result) values(p_acting,'save',to_jsonb(a));end if;
 return to_jsonb(a);
end $$;
revoke all on function public.agent_save_result(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.agent_save_result(uuid,uuid,uuid) to service_role;

commit;
