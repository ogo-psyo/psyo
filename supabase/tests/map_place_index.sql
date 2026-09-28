-- Run inside a transaction after applying 20260928204500_map_place_index.sql.
create extension if not exists pgtap with schema extensions;
select plan(6);
insert into public.map_place_regions(id,title,bounds,source_url,source_updated_at,place_count) values
 ('map-index-west','Запад',public.st_makeenvelope(37.5,55.7,37.6,55.8,4326),'https://www.openstreetmap.org/copyright','2026-09-28',1),
 ('map-index-east','Восток',public.st_makeenvelope(37.6,55.7,37.7,55.8,4326),'https://www.openstreetmap.org/copyright','2026-09-28',1);
insert into public.map_place_index(id,title,detail,category,group_key,point,source_updated_at) values
 ('osm-node-920001','Западный парк','','парк','parks',public.st_setsrid(public.st_makepoint(37.58,55.75),4326),'2026-09-28'),
 ('osm-node-920002','Восточный парк','','парк','parks',public.st_setsrid(public.st_makepoint(37.62,55.75),4326),'2026-09-28');
insert into public.map_place_region_members values
 ('map-index-west','osm-node-920001'),('map-index-east','osm-node-920002');
select is(public.query_map_place_index(55.72,37.55,55.78,37.65,'parks',80)->>'covered','true','adjacent indexed regions cover one viewport');
select is(jsonb_array_length(public.query_map_place_index(55.72,37.55,55.78,37.65,'parks',80)->'results'),2,'cross-region query returns both places');
select is(jsonb_array_length(public.query_map_place_index(55.72,37.55,55.78,37.65,'parks',80)->'coverage'),2,'response names every contributing region');
select is(public.query_map_place_index(55.72,37.55,55.78,37.75,'parks',80)->>'covered','false','an index gap is not presented as empty coverage');
select throws_ok($$select public.query_map_place_index(55.72,37.55,55.78,37.65,'private',80)$$,'P0001','INVALID_QUERY','unknown category is rejected');
set local role authenticated;
select throws_ok($$select public.query_map_place_index(55.72,37.55,55.78,37.65,'parks',80)$$,'42501',null,'browser roles cannot call the service index');
reset role;
select * from finish();
