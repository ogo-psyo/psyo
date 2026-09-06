create table if not exists public.map_provider_budget (
 provider text primary key,
 last_request timestamptz not null default '-infinity',
 requests bigint not null default 0
);
insert into public.map_provider_budget(provider) values('osm-search') on conflict do nothing;
alter table public.map_provider_budget enable row level security;
revoke all on public.map_provider_budget from anon,authenticated;
create or replace function public.take_map_search_slot() returns boolean
language plpgsql security definer set search_path=public as $$
declare previous timestamptz;
begin
 select last_request into previous from public.map_provider_budget where provider='osm-search' for update;
 if previous>clock_timestamp()-interval '1100 milliseconds' then return false;end if;
 update public.map_provider_budget set last_request=clock_timestamp(),requests=requests+1 where provider='osm-search';
 return true;
end $$;
revoke all on function public.take_map_search_slot() from public,anon,authenticated;
grant execute on function public.take_map_search_slot() to service_role;
