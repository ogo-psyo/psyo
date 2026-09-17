-- Keep existing signals/pet IDs; extend geography, not location precision.
alter table public.social_walk_signals drop constraint if exists social_walk_signals_city_check;
alter table public.social_walk_signals add constraint social_walk_signals_city_check check (city in ('moscow','saint_petersburg','world'));
create table public.map_hazards (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 pet_id uuid not null references public.pets(id) on delete cascade,
 title text not null check(length(btrim(title)) between 1 and 120),
 lat double precision not null check(lat between -85 and 85), lng double precision not null check(lng between -180 and 180),
 radius integer not null check(radius between 20 and 500), expires_at timestamptz not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index map_hazards_active on public.map_hazards(expires_at,lat,lng);
alter table public.map_hazards enable row level security;
revoke all on public.map_hazards from anon,authenticated;
grant all on public.map_hazards to service_role;
-- Durable replay keys: retries cannot renew a removed/expired mark.
create table public.map_mark_receipts (
 owner_id uuid not null references auth.users(id) on delete cascade,
 request_key text not null, fingerprint text not null, result jsonb not null,
 created_at timestamptz not null default now(),primary key(owner_id,request_key)
);
alter table public.map_mark_receipts enable row level security;
revoke all on public.map_mark_receipts from anon,authenticated;
grant all on public.map_mark_receipts to service_role;
create index map_mark_receipts_rate on public.map_mark_receipts(owner_id,created_at);
create or replace function public.map_publish_signal(p_owner uuid,p_pet uuid,p_key text,p_fingerprint text,p_lat double precision,p_lng double precision,p_minutes integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.social_walk_signals; receipt public.map_mark_receipts; result jsonb; begin
 if not exists(select 1 from public.pets where id=p_pet and owner_id=p_owner) then raise exception 'PET_NOT_FOUND'; end if;
 if p_minutes is null or p_minutes not in (30,45,60) or p_lat is null or p_lng is null or p_lat not between -85 and 85 or p_lng not between -180 and 180 or p_key is null or length(p_key) not between 8 and 128 or p_fingerprint is null then raise exception 'INVALID_SIGNAL'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('map-mark:'||p_owner::text,0));
 select * into receipt from public.map_mark_receipts where owner_id=p_owner and request_key=p_key;
 if found then
  if receipt.fingerprint<>p_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return receipt.result;
 end if;
 if (select count(*) from public.map_mark_receipts where owner_id=p_owner and created_at>now()-interval '1 hour')>=30 then raise exception 'RATE_LIMIT'; end if;
 update public.social_walk_signals set status='expired' where pet_id=p_pet and status='active' and expires_at<=now();
 select * into r from public.social_walk_signals where pet_id=p_pet and status='active';
 if found then
  update public.social_walk_signals set city='world',district=null,coarse_lat=p_lat,coarse_lng=p_lng,starts_at=now(),expires_at=now()+make_interval(mins=>p_minutes),pace='balanced',note=null,idempotency_key=p_key,request_fingerprint=p_fingerprint where id=r.id returning * into r;
 else
  insert into public.social_walk_signals(owner_id,pet_id,city,coarse_lat,coarse_lng,starts_at,expires_at,pace,status,idempotency_key,request_fingerprint)
  values(p_owner,p_pet,'world',p_lat,p_lng,now(),now()+make_interval(mins=>p_minutes),'balanced','active',p_key,p_fingerprint) returning * into r;
 end if;
 result=jsonb_build_object('id',r.id);
 insert into public.map_mark_receipts(owner_id,request_key,fingerprint,result) values(p_owner,p_key,p_fingerprint,result);
 return result;
end $$;
revoke all on function public.map_publish_signal(uuid,uuid,text,text,double precision,double precision,integer) from public,anon,authenticated;
grant execute on function public.map_publish_signal(uuid,uuid,text,text,double precision,double precision,integer) to service_role;
create or replace function public.map_save_hazard(p_owner uuid,p_pet uuid,p_key text,p_fingerprint text,p_id uuid,p_lat double precision,p_lng double precision,p_title text,p_radius integer,p_hours integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare receipt public.map_mark_receipts; result jsonb; begin
 if not exists(select 1 from public.pets where id=p_pet and owner_id=p_owner) then raise exception 'PET_NOT_FOUND'; end if;
 if p_key is null or length(p_key) not between 8 and 128 or p_fingerprint is null or p_id is null or p_lat is null or p_lng is null or p_lat not between -85 and 85 or p_lng not between -180 and 180 or p_title is null or length(btrim(p_title)) not between 1 and 120 or p_radius is null or p_radius not between 20 and 500 or p_hours is null or p_hours not in (1,3,24) then raise exception 'INVALID_HAZARD'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('map-mark:'||p_owner::text,0));
 select * into receipt from public.map_mark_receipts where owner_id=p_owner and request_key=p_key;
 if found then
  if receipt.fingerprint<>p_fingerprint then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return receipt.result;
 end if;
 if (select count(*) from public.map_mark_receipts where owner_id=p_owner and created_at>now()-interval '1 hour')>=30 then raise exception 'RATE_LIMIT'; end if;
 if exists(select 1 from public.map_hazards where id=p_id and owner_id<>p_owner) then raise exception 'NOT_FOUND'; end if;
 insert into public.map_hazards(id,owner_id,pet_id,title,lat,lng,radius,expires_at)
 values(p_id,p_owner,p_pet,btrim(p_title),p_lat,p_lng,p_radius,now()+make_interval(hours=>p_hours))
 on conflict(id) do update set title=excluded.title,lat=excluded.lat,lng=excluded.lng,radius=excluded.radius,expires_at=excluded.expires_at,updated_at=now() where map_hazards.owner_id=p_owner;
 if not found then raise exception 'NOT_FOUND'; end if;
 result=jsonb_build_object('id',p_id);
 insert into public.map_mark_receipts(owner_id,request_key,fingerprint,result) values(p_owner,p_key,p_fingerprint,result);
 return result;
end $$;
revoke all on function public.map_save_hazard(uuid,uuid,text,text,uuid,double precision,double precision,text,integer,integer) from public,anon,authenticated;
grant execute on function public.map_save_hazard(uuid,uuid,text,text,uuid,double precision,double precision,text,integer,integer) to service_role;
