begin;
do $$
declare saved jsonb;
begin
 if not exists(select 1 from public.map_route_save_receipts where id='bbbbbbbb-eeee-4bbb-8bbb-bbbbbbbbbbbb' and route_id=id and fingerprint=repeat('f',64)) then raise exception 'LEGACY_SEED_MISSING';end if;
 saved:=public.map_save_route_atomic('aaaaaaaa-eeee-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-eeee-4bbb-8bbb-bbbbbbbbbbbb',repeat('f',64),'{"title":"Legacy QA"}');
 if saved->>'replayed'<>'true' or saved->'feature'->>'title'<>'Legacy QA' then raise exception 'LEGACY_REPLAY_FAILED';end if;
 delete from public.map_routes where id='bbbbbbbb-eeee-4bbb-8bbb-bbbbbbbbbbbb';
 begin
  perform public.map_save_route_atomic('aaaaaaaa-eeee-4aaa-8aaa-aaaaaaaaaaaa','bbbbbbbb-eeee-4bbb-8bbb-bbbbbbbbbbbb',repeat('f',64),'{"title":"Legacy QA"}');raise exception 'LEGACY_RESURRECTED';
 exception when others then if sqlerrm<>'ROUTE_REMOVED' then raise;end if;end;
 raise notice 'PASS whole additive migration: preexisting route seeded, replay unchanged, deleted replay rejected';
end $$;
rollback;
