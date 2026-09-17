begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); q uuid:=gen_random_uuid(); h uuid:=gen_random_uuid(); s uuid; r jsonb; replay jsonb;
begin
 insert into auth.users(id) values(a),(b);
 insert into public.pets(id,owner_id,name) values(p,a,'Map A'),(q,b,'Map B');
 r:=public.map_publish_signal(a,p,'presence-test-a',repeat('a',64),55.75,37.62,45);s:=(r->>'id')::uuid;
 if not exists(select 1 from public.social_walk_signals where id=s and city='world' and pet_id=p and expires_at>now()) then raise exception 'presence missing'; end if;
 perform public.map_publish_signal(a,p,'presence-test-b',repeat('b',64),55.76,37.63,30);
 replay:=public.map_publish_signal(a,p,'presence-test-a',repeat('a',64),55.75,37.62,45);
 if replay<>r or (select coarse_lat from public.social_walk_signals where id=s)<>55.76 then raise exception 'old replay rewrote signal'; end if;
 update public.social_walk_signals set status='completed' where id=s;
 perform public.map_publish_signal(a,p,'presence-test-a',repeat('a',64),55.75,37.62,45);
 if exists(select 1 from public.social_walk_signals where id=s and status='active') then raise exception 'replay revived signal'; end if;
 begin
  perform public.map_publish_signal(b,p,'foreign-signal','x',55.75,37.62,45);
  raise exception 'ownership not enforced';
 exception when others then if sqlerrm<>'PET_NOT_FOUND' then raise; end if; end;
 perform public.map_save_hazard(a,p,'hazard-test-a','hazard-a',h,55.75,37.62,'Стекло',50,3);
 if not exists(select 1 from public.map_hazards where id=h and owner_id=a and expires_at>now()) then raise exception 'hazard missing'; end if;
 begin
  perform public.map_save_hazard(b,q,'foreign-hazard','x',h,55.75,37.62,'Подмена',50,3);
  raise exception 'foreign overwrite allowed';
 exception when others then if sqlerrm<>'NOT_FOUND' then raise; end if; end;
 delete from public.map_hazards where id=h;
 perform public.map_save_hazard(a,p,'hazard-test-a','hazard-a',h,55.75,37.62,'Стекло',50,3);
 if exists(select 1 from public.map_hazards where id=h) then raise exception 'retry revived removed hazard'; end if;
 begin
  perform public.map_save_hazard(a,p,'hazard-test-a','changed',h,55.75,37.62,'Стекло',50,3);
  raise exception 'conflict not detected';
 exception when others then if sqlerrm<>'IDEMPOTENCY_CONFLICT' then raise; end if; end;
 if has_table_privilege('authenticated','public.map_hazards','INSERT') or has_table_privilege('anon','public.map_hazards','SELECT') or has_function_privilege('authenticated','public.map_publish_signal(uuid,uuid,text,text,double precision,double precision,integer)','EXECUTE') then raise exception 'direct access allowed'; end if;
 raise notice 'PASS map marks: ownership, updates, persistent replay, no resurrection, conflict, RLS';
end $$;
rollback;
