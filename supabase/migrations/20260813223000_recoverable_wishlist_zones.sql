alter table public.wishlist_items
  add column if not exists deleted_at timestamptz;

alter table public.map_zones
  add column if not exists deleted_at timestamptz;

create index if not exists wishlist_items_active_pet_idx
  on public.wishlist_items (pet_id, created_at desc)
  where deleted_at is null;

create index if not exists map_zones_active_pet_idx
  on public.map_zones (pet_id, created_at desc)
  where deleted_at is null;

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
  where z.deleted_at is null
    and z.geom operator(public.&&) public.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
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
      operator(public.&&) public.st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and ((r.visibility = 'public' and r.moderation_status = 'approved') or r.owner_id = c.owner_id);
$$;

revoke all on function public.get_map_features_in_bounds(
  double precision, double precision, double precision, double precision, uuid
) from public;
grant execute on function public.get_map_features_in_bounds(
  double precision, double precision, double precision, double precision, uuid
) to authenticated, service_role;
