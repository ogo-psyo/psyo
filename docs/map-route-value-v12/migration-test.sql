begin;
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

do $$ begin
 if has_table_privilege('authenticated','public.map_walk_budget','INSERT') then raise exception 'client budget write'; end if;
 if has_function_privilege('anon','public.take_map_walk_slot()','EXECUTE') then raise exception 'anon provider budget'; end if;
 if not has_function_privilege('service_role','public.take_map_walk_slot()','EXECUTE') then raise exception 'server permission absent'; end if;
 update public.map_walk_budget set next_at=now()-interval '1 second';
 if not public.take_map_walk_slot() then raise exception 'first request denied'; end if;
 if public.take_map_walk_slot() then raise exception 'parallel request allowed'; end if;
 update public.map_walk_budget set next_at=now()-interval '1 second',requests=50;
 if public.take_map_walk_slot() then raise exception 'daily budget exceeded'; end if;
 update public.map_walk_budget set next_at=now()-interval '1 second',day=current_date-1;
 if not public.take_map_walk_slot() then raise exception 'new day not reset'; end if;
 if (select requests from public.map_walk_budget)<>1 then raise exception 'new day count'; end if;
end $$;
select 'PASS: additive schema, privileges, concurrency gate, daily cap, reset';
rollback;
select not exists(select 1 from information_schema.columns where table_name='map_routes' and column_name='planning') as rollback_verified;
