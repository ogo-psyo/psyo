-- Additive only. The legacy assistant and all existing product tables remain intact.
begin;

create table public.agent_runs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 pet_id uuid not null references public.pets(id) on delete cascade,
 thread_id uuid not null references public.assistant_threads(id) on delete cascade,
 request_id uuid not null,
 question text not null check (length(question) between 1 and 8000),
 status text not null default 'queued' check(status in ('queued','running','succeeded','failed','cancelled')),
 workflow_id text,
 attempts integer not null default 0 check(attempts between 0 and 3),
 result jsonb,
 error_code text,
 usage jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(owner_id,request_id)
);
create index agent_runs_pet_created on public.agent_runs(pet_id,created_at desc);
create unique index agent_one_active_thread on public.agent_runs(thread_id) where status in ('queued','running');
create table public.agent_mutations (
 run_id uuid primary key references public.agent_runs(id) on delete cascade,
 kind text not null,
 result jsonb not null
);
alter table public.agent_mutations enable row level security;
revoke all on public.agent_mutations from anon,authenticated;
grant all on public.agent_mutations to service_role;
create table public.agent_events (
 id bigint generated always as identity primary key,
 run_id uuid not null references public.agent_runs(id) on delete cascade,
 tool_name text not null,
 event text not null check(event in ('started','finished')),
 created_at timestamptz not null default now()
);
alter table public.agent_events enable row level security;
revoke all on public.agent_events from anon,authenticated;
grant all on public.agent_events to service_role;
grant usage on sequence public.agent_events_id_seq to service_role;

create table public.agent_pet_state (
 pet_id uuid primary key references public.pets(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 privacy_epoch timestamptz not null default now()
);
create table public.agent_memories (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 pet_id uuid not null references public.pets(id) on delete cascade,
 memory_key text not null check(length(memory_key) between 1 and 120),
 content text check(length(content) <= 2000),
 source_run_id uuid references public.agent_runs(id) on delete set null,
 updated_at timestamptz not null default now(),
 unique(pet_id,memory_key)
);
create table public.agent_artifacts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 pet_id uuid not null references public.pets(id) on delete cascade,
 run_id uuid not null references public.agent_runs(id) on delete cascade,
 title text not null check(length(title) between 1 and 200),
 content text not null check(length(content) <= 24000),
 sources jsonb not null default '[]'::jsonb,
 saved_at timestamptz,
 created_at timestamptz not null default now(),
 unique(run_id)
);

create table public.knowledge_sources (
 id text primary key,
 title text not null,
 url text not null,
 allowed_host text not null,
 topic text not null,
 jurisdiction text,
 language text not null default 'en',
 enabled boolean not null default false,
 refresh_hours integer not null default 168 check(refresh_hours >= 24),
 last_checked_at timestamptz,
 last_error text,
 active_document_id uuid,
 next_check_at timestamptz not null default now()
);
create table public.knowledge_documents (
 id uuid primary key default gen_random_uuid(),
 source_id text not null references public.knowledge_sources(id) on delete cascade,
 source_url text not null,
 content_hash text not null,
 content text not null check(length(content) <= 200000),
 retrieved_at timestamptz not null default now(),
 search_vector tsvector generated always as (to_tsvector('simple',content)) stored,
 unique(source_id,content_hash)
);
alter table public.knowledge_sources add constraint knowledge_active_document_fk foreign key(active_document_id) references public.knowledge_documents(id);
create index knowledge_document_search on public.knowledge_documents using gin(search_vector);

do $$ declare t text; begin
 foreach t in array array['agent_runs','agent_pet_state','agent_memories','agent_artifacts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy owner_read on public.%I for select to authenticated using (owner_id = auth.uid() and exists(select 1 from public.pets p where p.id = pet_id and p.owner_id = auth.uid()))',t);
 end loop;
 foreach t in array array['knowledge_sources','knowledge_documents'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

-- Disabled until reviewed source ingestion and production gate pass.
insert into public.knowledge_sources(id,title,url,allowed_host,topic,jurisdiction)
values ('gov-uk-pet-entry','GOV.UK: bringing a pet to Great Britain',
 'https://www.gov.uk/bring-pet-to-great-britain','www.gov.uk','travel','GB');

create function public.agent_admit_run(p_owner uuid,p_pet uuid,p_thread uuid,p_request uuid,p_question text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.agent_runs; t uuid; begin
 if not exists(select 1 from pets where id=p_pet and owner_id=p_owner) then raise exception 'PET_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended('agent:'||p_owner::text,0));
 select * into r from agent_runs where owner_id=p_owner and request_id=p_request;
 if found then
  if r.pet_id<>p_pet or r.question<>p_question then raise exception 'REQUEST_CONFLICT'; end if;
  return to_jsonb(r);
 end if;
 if (select count(*) from agent_runs where owner_id=p_owner and created_at>now()-interval '24 hours')>=20 then raise exception 'AGENT_DAILY_LIMIT'; end if;
 if p_thread is not null then
  select id into t from assistant_threads where id=p_thread and pet_id=p_pet;
  if t is null then raise exception 'THREAD_NOT_FOUND'; end if;
 else
  insert into assistant_threads(pet_id,kind,title) values(p_pet,'general',left(p_question,80)) returning id into t;
 end if;
 insert into agent_runs(owner_id,pet_id,thread_id,request_id,question) values(p_owner,p_pet,t,p_request,p_question) returning * into r;
 return to_jsonb(r);
end $$;
revoke all on function public.agent_admit_run(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.agent_admit_run(uuid,uuid,uuid,uuid,text) to service_role;

create function public.agent_edit_memory(p_owner uuid,p_pet uuid,p_key text,p_content text,p_acting uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare m public.agent_memories;cached jsonb; begin
 if not exists(select 1 from pets where id=p_pet and owner_id=p_owner) then raise exception 'PET_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended('agent:'||p_owner::text,0));
 if p_acting is not null then
  perform 1 from agent_runs where id=p_acting and owner_id=p_owner and pet_id=p_pet and status='running' for update;
  if not found then raise exception 'RUN_STOPPED';end if;
  select result into cached from agent_mutations where run_id=p_acting;
  if found then return cached;end if;
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

create function public.agent_save_result(p_owner uuid,p_result uuid,p_acting uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.agent_runs;a public.agent_artifacts;cached jsonb;begin
 select * into r from agent_runs where id=p_result and owner_id=p_owner and status='succeeded';
 if not found or not exists(select 1 from pets where id=r.pet_id and owner_id=p_owner) then raise exception 'RESULT_NOT_FOUND';end if;
 if p_acting is not null then
  perform 1 from agent_runs where id=p_acting and owner_id=p_owner and thread_id=r.thread_id and status='running' for update;
  if not found then raise exception 'RUN_STOPPED';end if;
  select result into cached from agent_mutations where run_id=p_acting;
  if found then return cached;end if;
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
