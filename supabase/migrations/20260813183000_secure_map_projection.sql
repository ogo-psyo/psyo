-- Restore owner routes for signed Telegram sessions while keeping external map
-- projections approximate and revocable.

alter table public.map_zones
  add column if not exists share_token uuid unique,
  add column if not exists area_label text;

alter table public.map_routes
  add column if not exists share_token uuid unique,
  add column if not exists area_label text,
  add column if not exists approximate_center geometry(Point, 4326);

update public.map_zones
set share_token = gen_random_uuid()
where visibility = 'shared' and share_token is null;

update public.map_routes
set
  share_token = case when visibility = 'shared' then coalesce(share_token, gen_random_uuid()) else null end,
  area_label = coalesce(nullif(btrim(area_label), ''), 'примерный район маршрута'),
  approximate_center = st_snaptogrid(st_centroid(path), 0.01)
where path is not null;

create index if not exists idx_map_routes_approximate_center
  on public.map_routes using gist(approximate_center);

create or replace function public.sync_map_route_projection()
returns trigger
language plpgsql
as $$
begin
  if new.path is not null then
    new.approximate_center = st_snaptogrid(st_centroid(new.path), 0.01);
    new.area_label = coalesce(nullif(btrim(new.area_label), ''), 'примерный район маршрута');
  else
    new.approximate_center = null;
  end if;

  if new.visibility <> 'shared' then
    new.share_token = null;
  end if;
  return new;
end;
$$;

drop trigger if exists map_routes_sync_projection on public.map_routes;
create trigger map_routes_sync_projection
  before insert or update of path, area_label, visibility
  on public.map_routes
  for each row execute function public.sync_map_route_projection();

drop function if exists public.get_map_features_in_bounds(double precision, double precision, double precision, double precision);
drop function if exists public.get_map_features_in_bounds(double precision, double precision, double precision, double precision, uuid);

create function public.get_map_features_in_bounds(
  min_lat double precision,
  max_lat double precision,
  min_lng double precision,
  max_lng double precision,
  requesting_owner_id uuid default null
) returns table (
  id uuid,
  type text,
  title text,
  lat double precision,
  lng double precision,
  zone_type text,
  path json,
  visibility text,
  area_label text
)
language sql
security definer
set search_path = public
as $$
  with caller as (
    select case
      when auth.uid() is not null then auth.uid()
      when coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then requesting_owner_id
      else null
    end as owner_id
  )
  select
    z.id,
    'point'::text,
    z.title,
    st_y(z.geom)::double precision,
    st_x(z.geom)::double precision,
    z.type,
    null::json,
    z.visibility,
    z.area_label
  from public.map_zones z
  cross join caller c
  where z.geom && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and (
      (z.visibility = 'public' and z.moderation_status = 'approved')
      or exists (
        select 1 from public.pets p
        where p.id = z.pet_id and p.owner_id = c.owner_id
      )
    )

  union all

  select
    r.id,
    'route'::text,
    r.title,
    st_y(coalesce(r.approximate_center, st_snaptogrid(st_centroid(r.path), 0.01)))::double precision,
    st_x(coalesce(r.approximate_center, st_snaptogrid(st_centroid(r.path), 0.01)))::double precision,
    null::text,
    case when r.owner_id = c.owner_id then st_asgeojson(r.path)::json else null::json end,
    r.visibility,
    r.area_label
  from public.map_routes r
  cross join caller c
  where coalesce(r.approximate_center, st_centroid(r.path))
      && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and (
      (r.visibility = 'public' and r.moderation_status = 'approved')
      or r.owner_id = c.owner_id
    );
$$;

revoke all on function public.get_map_features_in_bounds(
  double precision, double precision, double precision, double precision, uuid
) from public;
grant execute on function public.get_map_features_in_bounds(
  double precision, double precision, double precision, double precision, uuid
) to authenticated, service_role;
