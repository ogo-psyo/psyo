-- Additive: old clients keep their LineString; current clients do not draw or count GPS gaps.
alter table public.map_routes add column if not exists path_gaps integer[] not null default '{}';
alter table public.map_routes add column if not exists request_fingerprint text;
