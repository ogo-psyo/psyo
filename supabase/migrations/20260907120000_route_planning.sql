-- Additive. Existing paths/links untouched. Old application ignores planning.
alter table public.map_routes add column if not exists planning jsonb;
alter table public.map_routes add constraint map_routes_planning_object check (planning is null or jsonb_typeof(planning)='object') not valid;
create table if not exists public.map_walk_budget (id boolean primary key default true check(id), next_at timestamptz not null default now(), day date not null default current_date, requests integer not null default 0);
insert into public.map_walk_budget(id) values(true) on conflict do nothing;
alter table public.map_walk_budget enable row level security;
revoke all on table public.map_walk_budget from public,anon,authenticated;
create or replace function public.take_map_walk_slot() returns boolean language plpgsql security definer set search_path=public as $$
begin
 update public.map_walk_budget set next_at=clock_timestamp()+interval '5 seconds',requests=case when day=current_date then requests+1 else 1 end,day=current_date where id=true and next_at<=clock_timestamp() and (day<>current_date or requests<50);
 return found;
end;$$;
revoke all on function public.take_map_walk_slot() from public,anon,authenticated;
grant execute on function public.take_map_walk_slot() to service_role;
