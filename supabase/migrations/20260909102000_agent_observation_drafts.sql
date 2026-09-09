create table public.agent_observation_drafts (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null unique references public.agent_runs(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade,
 pet_id uuid not null references public.pets(id) on delete cascade,
 source_text text not null,
 metrics jsonb not null default '{}'::jsonb,
 observed_at timestamptz not null,
 status text not null default 'draft' check (status in ('draft','saved','discarded')),
 observation_id uuid references public.pet_observations(id) on delete set null,
 review_fingerprint text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.agent_observation_drafts enable row level security;
revoke all on public.agent_observation_drafts from anon, authenticated;
grant select on public.agent_observation_drafts to authenticated;
grant all on public.agent_observation_drafts to service_role;
create policy agent_observation_owner_read on public.agent_observation_drafts for select to authenticated using (
 owner_id=auth.uid() and exists(select 1 from public.pets p where p.id=pet_id and p.owner_id=auth.uid())
);

create function public.agent_prepare_observation(p_owner uuid,p_run uuid,p_metrics jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.agent_runs; d public.agent_observation_drafts;
begin
 select * into r from public.agent_runs where id=p_run and owner_id=p_owner for update;
 if not found then raise exception 'RUN_NOT_FOUND'; end if;
 perform 1 from public.pets where id=r.pet_id and owner_id=p_owner for share;
 if not found then raise exception 'PET_NOT_FOUND'; end if;
 if r.status<>'running' then raise exception 'RUN_STOPPED'; end if;
 if p_metrics is null or jsonb_typeof(p_metrics)<>'object' or length(p_metrics::text)>1000 then raise exception 'INVALID_DRAFT'; end if;
 insert into public.agent_observation_drafts(run_id,owner_id,pet_id,source_text,metrics,observed_at)
 values(r.id,p_owner,r.pet_id,r.question,p_metrics,r.created_at) on conflict(run_id) do nothing;
 select * into d from public.agent_observation_drafts where run_id=r.id;
 return to_jsonb(d);
end $$;

create function public.agent_confirm_observation(p_owner uuid,p_draft uuid,p_review jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.agent_observation_drafts; r public.agent_runs; o public.pet_observations;
 fingerprint text; response jsonb; metrics jsonb;
begin
 select * into d from public.agent_observation_drafts where id=p_draft and owner_id=p_owner;
 if not found then raise exception 'DRAFT_NOT_FOUND'; end if;
 -- All draft mutations lock run before draft, including preparation/cancellation.
 select * into r from public.agent_runs where id=d.run_id and owner_id=p_owner and pet_id=d.pet_id for update;
 if not found then raise exception 'RUN_NOT_FOUND'; end if;
 perform 1 from public.pets where id=d.pet_id and owner_id=p_owner for share;
 if not found then raise exception 'PET_NOT_FOUND'; end if;
 if r.status<>'succeeded' then raise exception 'RUN_NOT_READY'; end if;
 select * into d from public.agent_observation_drafts where id=p_draft for update;
 if p_review is null then
  if d.status='saved' then raise exception 'DRAFT_ALREADY_SAVED'; end if;
  update public.agent_observation_drafts set status='discarded',updated_at=now() where id=d.id returning * into d;
  return jsonb_build_object('draft',to_jsonb(d));
 end if;
 if d.status='discarded' then raise exception 'DRAFT_DISCARDED'; end if;
 if jsonb_typeof(p_review)<>'object' or jsonb_typeof(p_review->'note') is distinct from 'string'
  or length(btrim(p_review->>'note')) not between 1 and 8000
  or jsonb_typeof(p_review->'metrics') is distinct from 'object'
  or length((p_review->'metrics')::text)>1000
  or nullif(p_review->>'observedAt','') is null then raise exception 'INVALID_DRAFT'; end if;
 fingerprint:=encode(extensions.digest(p_review::text,'sha256'),'hex');
 if d.status='saved' then
  if d.review_fingerprint is distinct from fingerprint then raise exception 'DRAFT_ALREADY_SAVED'; end if;
 else
  metrics:=p_review->'metrics';
  response:=public.care_observation_atomic(p_owner,'agent-observation:'||d.run_id::text,fingerprint,'create',d.pet_id,
   jsonb_build_object('type','note','value',btrim(p_review->>'note'),'note',btrim(p_review->>'note'),
    'observed_at',p_review->>'observedAt','source','assistant',
    'metadata',metrics||jsonb_build_object('agent_run_id',d.run_id,'source_text',d.source_text)));
  update public.agent_observation_drafts set status='saved',observation_id=(response->'observation'->>'id')::uuid,
   review_fingerprint=fingerprint,updated_at=now() where id=d.id returning * into d;
 end if;
 select * into o from public.pet_observations where id=d.observation_id and pet_id=d.pet_id and deleted_at is null;
 if not found then raise exception 'OBSERVATION_NOT_FOUND'; end if;
 return jsonb_build_object('draft',to_jsonb(d),'observation',to_jsonb(o));
end $$;
revoke all on function public.agent_prepare_observation(uuid,uuid,jsonb),public.agent_confirm_observation(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.agent_prepare_observation(uuid,uuid,jsonb),public.agent_confirm_observation(uuid,uuid,jsonb) to service_role;
