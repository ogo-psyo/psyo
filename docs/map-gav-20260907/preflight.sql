begin read only;
select jsonb_build_object(
 'migration_versions',(select jsonb_agg(version) from (select version from supabase_migrations.schema_migrations order by version desc limit 5) v),
 'columns',(select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type)) from information_schema.columns where table_schema='public' and table_name in ('map_routes','map_libraries','social_meeting_proposals','map_search_budget')),
 'route_count',(select count(*) from public.map_routes),
 'route_unique_ids',(select count(distinct id) from public.map_routes)
) as preflight;
rollback;
