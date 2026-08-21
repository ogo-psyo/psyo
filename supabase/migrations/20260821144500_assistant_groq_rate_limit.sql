create table if not exists public.assistant_usage_events (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists assistant_usage_events_owner_created_idx
  on public.assistant_usage_events(owner_id, created_at desc);

alter table public.assistant_usage_events enable row level security;
revoke all on table public.assistant_usage_events from public, anon, authenticated;
grant select, insert, delete on table public.assistant_usage_events to service_role;
grant usage, select on sequence public.assistant_usage_events_id_seq to service_role;

create or replace function public.claim_assistant_request(p_owner_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit constant integer := 20;
  v_used integer;
begin
  if p_owner_id is null or not exists (select 1 from auth.users where id = p_owner_id) then
    raise exception 'AUTH_REQUIRED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('assistant:' || p_owner_id::text, 0));
  delete from public.assistant_usage_events where created_at < now() - interval '24 hours';
  select count(*)::integer into v_used
  from public.assistant_usage_events
  where owner_id = p_owner_id and created_at >= now() - interval '1 hour';
  if v_used >= v_limit then raise exception 'ASSISTANT_RATE_LIMITED'; end if;
  insert into public.assistant_usage_events(owner_id) values (p_owner_id);
  return v_limit - v_used - 1;
end;
$$;

revoke all on function public.claim_assistant_request(uuid) from public, anon, authenticated;
grant execute on function public.claim_assistant_request(uuid) to service_role;
