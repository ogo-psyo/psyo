-- Public map data is readable only through an approximate projection.
-- Existing non-private points predate that invariant, so quarantine them.

update public.map_zones
set visibility = 'private', moderation_status = 'approved', share_token = null
where visibility <> 'private';

drop policy if exists "Read map routes" on public.map_routes;
drop policy if exists "Owners read map routes" on public.map_routes;
create policy "Owners read map routes"
  on public.map_routes for select
  using (owner_id = auth.uid());

create or replace function public.enforce_private_home_area()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type = 'home_area' then
    new.visibility = 'private';
    new.moderation_status = 'approved';
    new.share_token = null;
  end if;
  return new;
end;
$$;

drop trigger if exists map_zones_private_home_area on public.map_zones;
create trigger map_zones_private_home_area
  before insert or update of type, visibility, moderation_status, share_token
  on public.map_zones
  for each row execute function public.enforce_private_home_area();

create or replace function public.get_map_features_in_bounds(
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
set search_path = ''
as $$
  with caller as (
    select case
      when auth.uid() is not null then auth.uid()
      when coalesce(pg_catalog.current_setting('request.jwt.claim.role', true), '') = 'service_role' then requesting_owner_id
      else null
    end as owner_id
  )
  select
    z.id,
    'point'::text,
    z.title,
    public.st_y(z.geom)::double precision,
    public.st_x(z.geom)::double precision,
    z.type,
    null::json,
    z.visibility,
    z.area_label
  from public.map_zones z
  cross join caller c
  where z.geom && public.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and (
      (z.visibility = 'public' and z.moderation_status = 'approved')
      or exists (select 1 from public.pets p where p.id = z.pet_id and p.owner_id = c.owner_id)
    )

  union all

  select
    r.id,
    'route'::text,
    r.title,
    public.st_y(coalesce(r.approximate_center, public.st_snaptogrid(public.st_centroid(r.path), 0.01)))::double precision,
    public.st_x(coalesce(r.approximate_center, public.st_snaptogrid(public.st_centroid(r.path), 0.01)))::double precision,
    null::text,
    case when r.owner_id = c.owner_id then public.st_asgeojson(r.path)::json else null::json end,
    r.visibility,
    r.area_label
  from public.map_routes r
  cross join caller c
  where coalesce(r.approximate_center, public.st_centroid(r.path))
      && public.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and ((r.visibility = 'public' and r.moderation_status = 'approved') or r.owner_id = c.owner_id);
$$;

revoke all on function public.get_map_features_in_bounds(
  double precision, double precision, double precision, double precision, uuid
) from public;
grant execute on function public.get_map_features_in_bounds(
  double precision, double precision, double precision, double precision, uuid
) to authenticated, service_role;
