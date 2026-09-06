begin;

set local lock_timeout = '5s';

set local statement_timeout = '30s';

select pg_advisory_xact_lock(hashtext('pso-map-gav-20260907'));

do $$ begin if exists(select 1 from supabase_migrations.schema_migrations where version like '20260907%') then raise exception 'Delivery already partially or fully recorded; inspect before retry'; end if; end $$;

-- Additive: old clients keep their LineString; current clients do not draw or count GPS gaps.
alter table public.map_routes add column if not exists path_gaps integer[] not null default '{}';
alter table public.map_routes add column if not exists request_fingerprint text;


insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260907010000','map_route_gaps',ARRAY[$delivery_statement$-- Additive: old clients keep their LineString; current clients do not draw or count GPS gaps.
alter table public.map_routes add column if not exists path_gaps integer[] not null default '{}';
alter table public.map_routes add column if not exists request_fingerprint text;
$delivery_statement$]);

-- Private provider-independent objects and ordered memberships. Additive, old links/tables unchanged.
create table if not exists public.map_libraries (
 pet_id uuid primary key references public.pets(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null default 0 check (revision >= 0),
 document jsonb not null,
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(document) = 'object')
);
alter table public.map_libraries enable row level security;
create policy map_library_owner_read on public.map_libraries for select using (owner_id=auth.uid());
-- Writes run only through the authenticated API and compare-and-swap; no direct client mutation.
revoke insert,update,delete on public.map_libraries from anon,authenticated;
grant select on public.map_libraries to authenticated;
grant all on public.map_libraries to service_role;
create trigger map_libraries_touch_updated_at before update on public.map_libraries for each row execute function public.touch_updated_at();


insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260907011000','map_libraries',ARRAY[$delivery_statement$-- Private provider-independent objects and ordered memberships. Additive, old links/tables unchanged.
create table if not exists public.map_libraries (
 pet_id uuid primary key references public.pets(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 revision bigint not null default 0 check (revision >= 0),
 document jsonb not null,
 updated_at timestamptz not null default now(),
 check (jsonb_typeof(document) = 'object')
);
alter table public.map_libraries enable row level security;
create policy map_library_owner_read on public.map_libraries for select using (owner_id=auth.uid());
-- Writes run only through the authenticated API and compare-and-swap; no direct client mutation.
revoke insert,update,delete on public.map_libraries from anon,authenticated;
grant select on public.map_libraries to authenticated;
grant all on public.map_libraries to service_role;
create trigger map_libraries_touch_updated_at before update on public.map_libraries for each row execute function public.touch_updated_at();
$delivery_statement$]);

create table if not exists public.social_meeting_proposals (
 id uuid primary key,
 request_id uuid not null references public.social_match_requests(id) on delete cascade,
 author_owner_id uuid not null references auth.users(id) on delete cascade,
 author_pet_id uuid not null references public.pets(id) on delete cascade,
 kind text not null check (kind in ('place','route')),
 source_id text not null,
 snapshot jsonb not null,
 fingerprint text not null,
 created_at timestamptz not null default now()
);
alter table public.social_meeting_proposals enable row level security;
-- Contact/connection state and source visibility are checked on every API read.
revoke all on public.social_meeting_proposals from anon,authenticated;
grant all on public.social_meeting_proposals to service_role;
create index if not exists social_meeting_request_created on public.social_meeting_proposals(request_id,created_at desc);

create or replace function public.validate_meeting_connection() returns trigger
language plpgsql set search_path=public as $$
declare connection public.social_match_requests%rowtype;
begin
 select * into connection from public.social_match_requests where id=new.request_id for update;
 if not found or connection.status<>'accepted' or not (
  (new.author_owner_id=connection.sender_owner_id and new.author_pet_id=connection.sender_pet_id) or
  (new.author_owner_id=connection.recipient_owner_id and new.author_pet_id=connection.recipient_pet_id)
 ) then raise exception 'CONNECTION_UNAVAILABLE'; end if;
 if exists(select 1 from public.social_blocks where
  (blocker_owner_id=connection.sender_owner_id and blocked_owner_id=connection.recipient_owner_id) or
  (blocker_owner_id=connection.recipient_owner_id and blocked_owner_id=connection.sender_owner_id)
 ) then raise exception 'CONNECTION_UNAVAILABLE'; end if;
 return new;
end $$;
create trigger social_meeting_guard before insert on public.social_meeting_proposals for each row execute function public.validate_meeting_connection();


insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260907012000','social_meeting_proposals',ARRAY[$delivery_statement$create table if not exists public.social_meeting_proposals (
 id uuid primary key,
 request_id uuid not null references public.social_match_requests(id) on delete cascade,
 author_owner_id uuid not null references auth.users(id) on delete cascade,
 author_pet_id uuid not null references public.pets(id) on delete cascade,
 kind text not null check (kind in ('place','route')),
 source_id text not null,
 snapshot jsonb not null,
 fingerprint text not null,
 created_at timestamptz not null default now()
);
alter table public.social_meeting_proposals enable row level security;
-- Contact/connection state and source visibility are checked on every API read.
revoke all on public.social_meeting_proposals from anon,authenticated;
grant all on public.social_meeting_proposals to service_role;
create index if not exists social_meeting_request_created on public.social_meeting_proposals(request_id,created_at desc);

create or replace function public.validate_meeting_connection() returns trigger
language plpgsql set search_path=public as $$
declare connection public.social_match_requests%rowtype;
begin
 select * into connection from public.social_match_requests where id=new.request_id for update;
 if not found or connection.status<>'accepted' or not (
  (new.author_owner_id=connection.sender_owner_id and new.author_pet_id=connection.sender_pet_id) or
  (new.author_owner_id=connection.recipient_owner_id and new.author_pet_id=connection.recipient_pet_id)
 ) then raise exception 'CONNECTION_UNAVAILABLE'; end if;
 if exists(select 1 from public.social_blocks where
  (blocker_owner_id=connection.sender_owner_id and blocked_owner_id=connection.recipient_owner_id) or
  (blocker_owner_id=connection.recipient_owner_id and blocked_owner_id=connection.sender_owner_id)
 ) then raise exception 'CONNECTION_UNAVAILABLE'; end if;
 return new;
end $$;
create trigger social_meeting_guard before insert on public.social_meeting_proposals for each row execute function public.validate_meeting_connection();
$delivery_statement$]);

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


insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260907013000','map_search_budget',ARRAY[$delivery_statement$create table if not exists public.map_provider_budget (
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
$delivery_statement$]);

commit;

select version,name from supabase_migrations.schema_migrations where version like '20260907%' order by version;