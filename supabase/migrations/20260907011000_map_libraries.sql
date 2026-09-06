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
