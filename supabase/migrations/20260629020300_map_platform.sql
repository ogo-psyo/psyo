-- Map platform foundation: PostGIS, public/private zones, routes and viewport reads.

create extension if not exists postgis;

alter table public.map_zones
  add column if not exists visibility text not null default 'private' check (visibility in ('private', 'shared', 'public')),
  add column if not exists moderation_status text not null default 'approved' check (moderation_status in ('pending', 'approved', 'rejected')),
  add column if not exists geom geometry(Point, 4326);

update public.map_zones
set geom = st_setsrid(st_makepoint(approximate_lng::float, approximate_lat::float), 4326)
where geom is null
  and approximate_lat is not null
  and approximate_lng is not null;

create table if not exists public.map_routes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete cascade,
  title text not null,
  description text,
  path geometry(LineString, 4326),
  color text default '#3b82f6',
  visibility text not null default 'private' check (visibility in ('private', 'shared', 'public')),
  moderation_status text not null default 'approved' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_map_zones_geom on public.map_zones using gist(geom);
create index if not exists idx_map_routes_path on public.map_routes using gist(path);
create index if not exists idx_map_routes_owner_created on public.map_routes(owner_id, created_at desc);

alter table public.map_routes enable row level security;

drop policy if exists "Read map routes" on public.map_routes;
create policy "Read map routes"
  on public.map_routes for select
  using (
    owner_id = auth.uid()
    or (visibility = 'public' and moderation_status = 'approved')
  );

drop policy if exists "Manage own map routes" on public.map_routes;
create policy "Manage own map routes"
  on public.map_routes for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop trigger if exists map_routes_touch_updated_at on public.map_routes;
create trigger map_routes_touch_updated_at
  before update on public.map_routes
  for each row execute function public.touch_updated_at();

create or replace function public.sync_map_zone_geom()
returns trigger
language plpgsql
as $$
begin
  if new.approximate_lat is not null and new.approximate_lng is not null then
    new.geom = st_setsrid(st_makepoint(new.approximate_lng::float, new.approximate_lat::float), 4326);
  else
    new.geom = null;
  end if;
  return new;
end;
$$;

drop trigger if exists map_zones_sync_geom on public.map_zones;
create trigger map_zones_sync_geom
  before insert or update of approximate_lat, approximate_lng
  on public.map_zones
  for each row execute function public.sync_map_zone_geom();

create or replace function public.get_map_features_in_bounds(
  min_lat float,
  max_lat float,
  min_lng float,
  max_lng float
) returns table (
  id uuid,
  type text,
  title text,
  lat float,
  lng float,
  zone_type text,
  path json,
  visibility text
)
language sql
security definer
set search_path = public
as $$
  select
    z.id,
    'point'::text as type,
    z.title,
    st_y(z.geom)::float as lat,
    st_x(z.geom)::float as lng,
    z.type as zone_type,
    null::json as path,
    z.visibility
  from public.map_zones z
  where z.geom && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and (
      (z.visibility = 'public' and z.moderation_status = 'approved')
      or exists (
        select 1
        from public.pets p
        where p.id = z.pet_id
          and p.owner_id = auth.uid()
      )
    )

  union all

  select
    r.id,
    'route'::text as type,
    r.title,
    null::float as lat,
    null::float as lng,
    null::text as zone_type,
    st_asgeojson(r.path)::json as path,
    r.visibility
  from public.map_routes r
  where r.path && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and (
      (r.visibility = 'public' and r.moderation_status = 'approved')
      or r.owner_id = auth.uid()
    );
$$;
