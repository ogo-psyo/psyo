-- Temporary, privacy-preserving walk signals for the live "Гав" map.
-- Device coordinates never reach this table: the BFF stores only the same
-- coarse 0.01-degree grid used by social discovery.

create table if not exists public.social_walk_signals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  city text not null check (city in ('moscow', 'saint_petersburg')),
  district text check (district is null or (
    length(btrim(district)) between 2 and 50
    and district ~ '^[А-ЯЁа-яё -]+$'
    and district !~ '[0-9]'
  )),
  coarse_lat double precision not null check (coarse_lat between -90 and 90),
  coarse_lng double precision not null check (coarse_lng between -180 and 180),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  pace text not null check (pace in ('calm', 'balanced', 'active')),
  note text check (note is null or length(note) <= 180),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'expired')),
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  request_fingerprint text not null check (length(request_fingerprint) = 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > starts_at and expires_at <= starts_at + interval '8 hours'),
  unique (owner_id, idempotency_key)
);

create unique index if not exists social_walk_signals_one_active_pet
  on public.social_walk_signals(pet_id) where status = 'active';
create index if not exists social_walk_signals_live_city
  on public.social_walk_signals(city, expires_at) where status = 'active';

alter table public.social_walk_signals enable row level security;
revoke all on table public.social_walk_signals from anon, authenticated;
grant all on table public.social_walk_signals to service_role;

drop trigger if exists social_walk_signals_touch_updated_at on public.social_walk_signals;
create trigger social_walk_signals_touch_updated_at
before update on public.social_walk_signals
for each row execute function public.touch_updated_at();

alter table public.social_match_requests drop constraint if exists social_match_requests_source_check;
alter table public.social_match_requests
  add constraint social_match_requests_source_check check (source in ('organic', 'invite', 'signal'));
alter table public.social_match_requests
  add column if not exists signal_id uuid references public.social_walk_signals(id) on delete set null;

create or replace function public.enforce_walk_signal_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('social_walk_signals:' || new.owner_id::text, 0));
  select count(*) into v_count from public.social_walk_signals
  where owner_id = new.owner_id and created_at >= now() - interval '1 day';
  if v_count >= 12 then raise exception 'SOCIAL_RATE_LIMITED'; end if;
  return new;
end;
$$;

drop trigger if exists social_walk_signals_rate_limit on public.social_walk_signals;
create trigger social_walk_signals_rate_limit before insert on public.social_walk_signals
for each row execute function public.enforce_walk_signal_rate_limit();
