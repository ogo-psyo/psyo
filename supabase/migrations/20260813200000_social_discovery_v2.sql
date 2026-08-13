-- Privacy-first P0 social discovery. All writes go through owner-scoped BFF
-- routes using the service role; browser roles cannot bypass those checks.

create table if not exists public.social_discovery_profiles (
  pet_id uuid primary key references public.pets(id) on delete cascade,
  discoverable boolean not null default false,
  city text not null check (city in ('moscow', 'saint_petersburg')),
  district text check (district is null or (
    length(btrim(district)) between 2 and 50
    and district ~ '^[А-ЯЁа-яё -]+$'
    and district !~ '[0-9]'
    and district !~* '(улица|ул\.|дом|д\.|корпус|квартира|подъезд|строение|проспект|переулок|шоссе|набережная)'
  )),
  coarse_lat double precision,
  coarse_lng double precision,
  scenarios text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((coarse_lat is null and coarse_lng is null) or (
    coarse_lat between -90 and 90 and coarse_lng between -180 and 180
  )),
  check (scenarios <@ array['meet', 'walk', 'socialize', 'mating']::text[]),
  check (not discoverable or cardinality(scenarios) between 1 and 4)
);

create table if not exists public.social_match_requests (
  id uuid primary key default gen_random_uuid(),
  sender_owner_id uuid not null references auth.users(id) on delete cascade,
  recipient_owner_id uuid not null references auth.users(id) on delete cascade,
  sender_pet_id uuid not null references public.pets(id) on delete cascade,
  recipient_pet_id uuid not null references public.pets(id) on delete cascade,
  scenario text not null check (scenario in ('meet', 'walk', 'socialize', 'mating')),
  source text not null default 'organic' check (source in ('organic', 'invite')),
  message text check (message is null or length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'blocked')),
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  request_fingerprint text not null check (length(request_fingerprint) = 64),
  sender_contact_username text check (sender_contact_username is null or sender_contact_username ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$'),
  recipient_contact_username text check (recipient_contact_username is null or recipient_contact_username ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$'),
  sender_contact_verified_at timestamptz,
  recipient_contact_verified_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_owner_id <> recipient_owner_id),
  check (sender_pet_id <> recipient_pet_id),
  unique (sender_owner_id, idempotency_key)
);

create unique index if not exists social_match_requests_pending_pair_unique
  on public.social_match_requests(sender_pet_id, recipient_pet_id, scenario)
  where status = 'pending';

create table if not exists public.social_friend_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (length(token_hash) = 64),
  inviter_owner_id uuid not null references auth.users(id) on delete cascade,
  inviter_pet_id uuid not null references public.pets(id) on delete cascade,
  inviter_contact_username text check (inviter_contact_username is null or inviter_contact_username ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$'),
  inviter_contact_verified_at timestamptz,
  scenario text not null check (scenario in ('meet', 'walk', 'socialize', 'mating')),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_owner_id uuid references auth.users(id) on delete set null,
  recipient_pet_id uuid references public.pets(id) on delete set null,
  request_id uuid references public.social_match_requests(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.social_blocks (
  blocker_owner_id uuid not null references auth.users(id) on delete cascade,
  blocked_owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_owner_id, blocked_owner_id),
  check (blocker_owner_id <> blocked_owner_id)
);

create table if not exists public.social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_owner_id uuid not null references auth.users(id) on delete cascade,
  reported_owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid references public.social_match_requests(id) on delete set null,
  reason text not null check (length(reason) between 3 and 500),
  idempotency_key text not null check (length(idempotency_key) between 8 and 128),
  status text not null default 'open' check (status in ('open', 'reviewed', 'closed')),
  created_at timestamptz not null default now(),
  check (reporter_owner_id <> reported_owner_id),
  unique (reporter_owner_id, idempotency_key)
);

alter table public.social_discovery_profiles enable row level security;
alter table public.social_match_requests enable row level security;
alter table public.social_friend_invites enable row level security;
alter table public.social_blocks enable row level security;
alter table public.social_reports enable row level security;

revoke all on table public.social_discovery_profiles from anon, authenticated;
revoke all on table public.social_match_requests from anon, authenticated;
revoke all on table public.social_friend_invites from anon, authenticated;
revoke all on table public.social_blocks from anon, authenticated;
revoke all on table public.social_reports from anon, authenticated;
grant all on table public.social_discovery_profiles to service_role;
grant all on table public.social_match_requests to service_role;
grant all on table public.social_friend_invites to service_role;
grant all on table public.social_blocks to service_role;
grant all on table public.social_reports to service_role;

drop trigger if exists social_discovery_profiles_touch_updated_at on public.social_discovery_profiles;
create trigger social_discovery_profiles_touch_updated_at
before update on public.social_discovery_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists social_match_requests_touch_updated_at on public.social_match_requests;
create trigger social_match_requests_touch_updated_at
before update on public.social_match_requests
for each row execute function public.touch_updated_at();

-- Authoritative bounded rate limits. Advisory transaction locks serialize
-- concurrent inserts per owner, so parallel retries cannot race past the cap.
create or replace function public.enforce_social_write_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
  v_limit integer;
  v_since timestamptz;
  v_count integer;
begin
  if tg_table_name = 'social_friend_invites' then
    v_owner_id := new.inviter_owner_id; v_limit := 10; v_since := now() - interval '1 hour';
  elsif tg_table_name = 'social_match_requests' then
    v_owner_id := new.sender_owner_id; v_limit := 30; v_since := now() - interval '1 hour';
  elsif tg_table_name = 'social_reports' then
    v_owner_id := new.reporter_owner_id; v_limit := 10; v_since := now() - interval '1 day';
  else
    raise exception 'UNSUPPORTED_SOCIAL_RATE_LIMIT_TABLE';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(tg_table_name || ':' || v_owner_id::text, 0));
  execute pg_catalog.format('select count(*) from public.%I where %I = $1 and created_at >= $2', tg_table_name,
    case tg_table_name
      when 'social_friend_invites' then 'inviter_owner_id'
      when 'social_match_requests' then 'sender_owner_id'
      else 'reporter_owner_id'
    end)
  into v_count using v_owner_id, v_since;
  if v_count >= v_limit then raise exception 'SOCIAL_RATE_LIMITED'; end if;
  return new;
end;
$$;

drop trigger if exists social_friend_invites_rate_limit on public.social_friend_invites;
create trigger social_friend_invites_rate_limit before insert on public.social_friend_invites
for each row execute function public.enforce_social_write_rate_limit();
drop trigger if exists social_match_requests_rate_limit on public.social_match_requests;
create trigger social_match_requests_rate_limit before insert on public.social_match_requests
for each row execute function public.enforce_social_write_rate_limit();
drop trigger if exists social_reports_rate_limit on public.social_reports;
create trigger social_reports_rate_limit before insert on public.social_reports
for each row execute function public.enforce_social_write_rate_limit();

-- One-use invite consumption and request creation are atomic. The raw token is
-- never stored, only its SHA-256 digest.
create or replace function public.consume_social_friend_invite(
  p_token_hash text,
  p_recipient_owner_id uuid,
  p_recipient_pet_id uuid,
  p_idempotency_key text,
  p_recipient_contact_username text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.social_friend_invites%rowtype;
  v_request public.social_match_requests%rowtype;
begin
  select * into v_invite from public.social_friend_invites
  where token_hash = p_token_hash for update;
  if not found or v_invite.expires_at <= now() then
    raise exception 'INVITE_GONE';
  end if;
  if v_invite.used_at is not null then
    if v_invite.used_by_owner_id = p_recipient_owner_id and v_invite.request_id is not null then
      select * into v_request from public.social_match_requests
      where id = v_invite.request_id
        and recipient_owner_id = p_recipient_owner_id
        and idempotency_key = p_idempotency_key;
      if found and v_request.recipient_pet_id = p_recipient_pet_id then
        return jsonb_build_object('request', to_jsonb(v_request), 'replayed', true);
      end if;
    end if;
    raise exception 'INVITE_GONE';
  end if;
  if v_invite.inviter_owner_id = p_recipient_owner_id then
    raise exception 'INVITE_SELF_ACCEPT_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.pets
    where id = p_recipient_pet_id and owner_id = p_recipient_owner_id
  ) then
    raise exception 'RECIPIENT_PET_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.social_blocks
    where (blocker_owner_id = v_invite.inviter_owner_id and blocked_owner_id = p_recipient_owner_id)
       or (blocker_owner_id = p_recipient_owner_id and blocked_owner_id = v_invite.inviter_owner_id)
  ) then
    raise exception 'INVITE_NOT_AVAILABLE';
  end if;
  insert into public.social_match_requests (
    sender_owner_id, recipient_owner_id, sender_pet_id, recipient_pet_id,
    scenario, source, status, idempotency_key, request_fingerprint,
    sender_contact_username, recipient_contact_username,
    sender_contact_verified_at, recipient_contact_verified_at
  ) values (
    v_invite.inviter_owner_id, p_recipient_owner_id, v_invite.inviter_pet_id, p_recipient_pet_id,
    v_invite.scenario, 'invite', 'pending', p_idempotency_key,
    pg_catalog.encode(extensions.digest(
      v_invite.inviter_pet_id::text || ':' || p_recipient_pet_id::text || ':' || v_invite.scenario || ':invite',
      'sha256'
    ), 'hex'),
    v_invite.inviter_contact_username, p_recipient_contact_username,
    v_invite.inviter_contact_verified_at, now()
  ) returning * into v_request;

  update public.social_friend_invites set
    used_at = now(), used_by_owner_id = p_recipient_owner_id,
    recipient_pet_id = p_recipient_pet_id, request_id = v_request.id
  where id = v_invite.id;

  return jsonb_build_object('request', to_jsonb(v_request));
end;
$$;

revoke all on function public.consume_social_friend_invite(text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.consume_social_friend_invite(text, uuid, uuid, text, text) to service_role;
