-- Public OSM point index. Private owner places never enter these tables.
create table if not exists public.map_place_regions (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  title text not null check (char_length(title) between 1 and 180),
  bounds public.geometry(MultiPolygon,4326) not null,
  source_url text not null check (source_url ~ '^https://'),
  source_updated_at timestamptz not null,
  imported_at timestamptz not null default clock_timestamp(),
  place_count integer not null default 0 check (place_count >= 0)
);
alter table public.map_place_regions alter column bounds type public.geometry(MultiPolygon,4326) using public.st_multi(bounds);

create table if not exists public.map_place_index (
  id text primary key check (id ~ '^osm-(node|way|relation)-[1-9][0-9]*$'),
  title text not null check (char_length(title) between 1 and 240),
  detail text not null default '' check (char_length(detail) <= 600),
  category text not null check (char_length(category) between 1 and 120),
  group_key text not null check (group_key in ('parks','dogParks','vets','shops','grooming','cafes')),
  point public.geometry(Point,4326) not null,
  dog_access text check (dog_access in ('yes','no','leashed','designated')),
  point_is_center boolean not null default false,
  source_updated_at timestamptz not null,
  indexed_at timestamptz not null default clock_timestamp()
);

create table if not exists public.map_place_region_members (
  region_id text not null references public.map_place_regions(id) on delete cascade,
  place_id text not null references public.map_place_index(id) on delete cascade,
  primary key(region_id,place_id)
);

create index if not exists map_place_regions_bounds_gist on public.map_place_regions using gist(bounds);
create index if not exists map_place_index_point_gist on public.map_place_index using gist(point);
create index if not exists map_place_index_group_key_idx on public.map_place_index(group_key);
create index if not exists map_place_region_members_place_idx on public.map_place_region_members(place_id);

alter table public.map_place_regions enable row level security;
alter table public.map_place_index enable row level security;
alter table public.map_place_region_members enable row level security;
revoke all on public.map_place_regions,public.map_place_index,public.map_place_region_members from public,anon,authenticated;

create or replace function public.query_map_place_index(
  p_south double precision,
  p_west double precision,
  p_north double precision,
  p_east double precision,
  p_group text default 'all',
  p_limit integer default 80
) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare
  viewport public.geometry;
  coverage jsonb;
  updated timestamptz;
  fully_covered boolean;
  item_count bigint;
  items jsonb;
begin
  if p_south < -90 or p_north > 90 or p_west < -180 or p_east > 180
    or p_south >= p_north or p_west >= p_east
    or p_north-p_south > 0.3 or p_east-p_west > 0.5
    or p_group not in ('all','parks','dogParks','vets','shops','grooming','cafes')
    or p_limit < 1 or p_limit > 80 then
    raise exception 'INVALID_QUERY';
  end if;
  viewport:=public.st_makeenvelope(p_west,p_south,p_east,p_north,4326);
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title) order by id),'[]'::jsonb),min(source_updated_at),
      coalesce(public.st_covers(public.st_unaryunion(public.st_collect(bounds)),viewport),false)
    into coverage,updated,fully_covered
    from public.map_place_regions
    where public.st_intersects(bounds,viewport);
  if not fully_covered then
    return jsonb_build_object('covered',false,'coverage','[]'::jsonb);
  end if;
  with matches as (
    select distinct on (place.id) place.*
      from public.map_place_index place
      join public.map_place_region_members member on member.place_id=place.id
      join public.map_place_regions region on region.id=member.region_id and public.st_intersects(region.bounds,viewport)
      where public.st_covers(viewport,place.point) and (p_group='all' or place.group_key=p_group)
      order by place.id
  ), ranked as (
    select *,public.st_distance(point::public.geography,public.st_centroid(viewport)::public.geography) distance_meters
      from matches
  ), limited as (
    select * from ranked order by distance_meters,id limit p_limit
  )
  select (select count(*) from matches),coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id',id,'title',title,'detail',detail,'category',category,'group',group_key,
      'point',jsonb_build_object('lat',public.st_y(point),'lng',public.st_x(point)),
      'dogAccess',dog_access,'pointIsCenter',point_is_center
    )) order by distance_meters,id),'[]'::jsonb)
    into item_count,items from limited;
  return jsonb_build_object(
    'covered',true,'results',items,'total',item_count,'truncated',item_count>p_limit,
    'updatedAt',updated,'source','OpenStreetMap','coverage',coverage
  );
end $$;

revoke all on function public.query_map_place_index(double precision,double precision,double precision,double precision,text,integer) from public,anon,authenticated;
grant execute on function public.query_map_place_index(double precision,double precision,double precision,double precision,text,integer) to service_role;
