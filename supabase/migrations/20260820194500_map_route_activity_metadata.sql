-- Preserve the meaning of a recorded walk after its geometry is saved.

alter table public.map_routes
  add column if not exists route_source text not null default 'planned'
    check (route_source in ('recorded', 'planned')),
  add column if not exists started_at timestamptz,
  add column if not exists duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),
  add column if not exists distance_meters integer
    check (distance_meters is null or distance_meters >= 0);

create index if not exists map_routes_pet_started_idx
  on public.map_routes (pet_id, started_at desc)
  where started_at is not null;
