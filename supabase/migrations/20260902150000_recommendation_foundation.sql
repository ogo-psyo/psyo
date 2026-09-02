create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  scenario_key text not null check (char_length(trim(scenario_key)) between 1 and 80),
  policy_version text not null check (char_length(trim(policy_version)) between 1 and 120),
  category text not null check (category in ('care','wellbeing','habit','walk','thing')),
  risk text not null check (risk in ('routine','caution','safety_override')),
  status text not null check (status in (
    'candidate','eligible','suppressed','shown','accepted','snoozed',
    'dismissed','completed','expired','superseded','failed'
  )),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  title text not null check (char_length(trim(title)) between 1 and 120),
  why_now jsonb not null default '[]'::jsonb check (
    jsonb_typeof(why_now) = 'array'
    and jsonb_array_length(why_now) between 1 and 2
  ),
  limitation text check (limitation is null or char_length(limitation) <= 240),
  primary_action jsonb not null check (jsonb_typeof(primary_action) = 'object'),
  confidence jsonb not null check (jsonb_typeof(confidence) = 'object'),
  rank jsonb not null check (jsonb_typeof(rank) = 'object'),
  suppression_reasons text[] not null default '{}',
  fresh_until timestamptz not null,
  expires_at timestamptz not null,
  snoozed_until timestamptz,
  shown_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at >= fresh_until)
);

create table if not exists public.recommendation_evidence (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  source_type text not null check (source_type in (
    'profile','passport','reminder','observation','habit',
    'map_zone','route','wishlist','explicit_request'
  )),
  source_id text not null check (char_length(trim(source_id)) between 1 and 160),
  captured_at timestamptz not null,
  observed_at timestamptz,
  due_at timestamptz,
  source_updated_at timestamptz,
  owner_confirmed boolean not null default false,
  input_confidence numeric(4,3) check (input_confidence between 0 and 1),
  excerpt text check (char_length(excerpt) <= 160),
  created_at timestamptz not null default now(),
  unique (recommendation_id, source_type, source_id)
);

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  event_type text not null check (event_type in (
    'show','suppress','expire','supersede','accept','snooze','reactivate','dismiss','complete','fail'
  )),
  from_status text not null check (from_status in (
    'candidate','eligible','suppressed','shown','accepted','snoozed',
    'dismissed','completed','expired','superseded','failed'
  )),
  to_status text not null check (to_status in (
    'candidate','eligible','suppressed','shown','accepted','snoozed',
    'dismissed','completed','expired','superseded','failed'
  )),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now()
);

create table if not exists public.recommendation_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  category text not null check (category in ('care','wellbeing','habit','walk','thing')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pet_id, category)
);

create table if not exists public.recommendation_mutations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create unique index if not exists recommendations_active_fingerprint_uidx
  on public.recommendations(pet_id, fingerprint)
  where status in ('candidate','eligible','shown','accepted','snoozed');
create index if not exists recommendations_main_slot_idx
  on public.recommendations(owner_id, pet_id, status, risk, expires_at);
create index if not exists recommendation_evidence_recommendation_idx
  on public.recommendation_evidence(recommendation_id);
create index if not exists recommendation_events_audit_idx
  on public.recommendation_events(recommendation_id, created_at);
create index if not exists recommendation_preferences_owner_idx
  on public.recommendation_preferences(owner_id, pet_id);

create or replace function public.recommendation_enforce_pet_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.pets p
    where p.id = new.pet_id and p.owner_id = new.owner_id
  ) then
    raise exception 'PET_NOT_FOUND_OR_NOT_OWNED';
  end if;
  return new;
end
$$;

drop trigger if exists recommendations_enforce_pet_owner on public.recommendations;
create trigger recommendations_enforce_pet_owner
before insert or update of owner_id, pet_id on public.recommendations
for each row execute function public.recommendation_enforce_pet_owner();

drop trigger if exists recommendation_preferences_enforce_pet_owner on public.recommendation_preferences;
create trigger recommendation_preferences_enforce_pet_owner
before insert or update of owner_id, pet_id on public.recommendation_preferences
for each row execute function public.recommendation_enforce_pet_owner();

drop trigger if exists recommendations_touch_updated_at on public.recommendations;
create trigger recommendations_touch_updated_at
before update on public.recommendations
for each row execute function public.touch_updated_at();

drop trigger if exists recommendation_preferences_touch_updated_at on public.recommendation_preferences;
create trigger recommendation_preferences_touch_updated_at
before update on public.recommendation_preferences
for each row execute function public.touch_updated_at();

drop trigger if exists recommendation_mutations_touch_updated_at on public.recommendation_mutations;
create trigger recommendation_mutations_touch_updated_at
before update on public.recommendation_mutations
for each row execute function public.touch_updated_at();

alter table public.recommendations enable row level security;
alter table public.recommendation_evidence enable row level security;
alter table public.recommendation_events enable row level security;
alter table public.recommendation_preferences enable row level security;
alter table public.recommendation_mutations enable row level security;

drop policy if exists "recommendations owner read" on public.recommendations;
create policy "recommendations owner read" on public.recommendations
for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "recommendation evidence owner read" on public.recommendation_evidence;
create policy "recommendation evidence owner read" on public.recommendation_evidence
for select to authenticated
using (exists (
  select 1 from public.recommendations r
  where r.id = recommendation_id and r.owner_id = (select auth.uid())
));

drop policy if exists "recommendation events owner read" on public.recommendation_events;
create policy "recommendation events owner read" on public.recommendation_events
for select to authenticated
using (exists (
  select 1 from public.recommendations r
  where r.id = recommendation_id and r.owner_id = (select auth.uid())
));

drop policy if exists "recommendation preferences owner" on public.recommendation_preferences;
create policy "recommendation preferences owner" on public.recommendation_preferences
for all to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "recommendation mutations owner read" on public.recommendation_mutations;
create policy "recommendation mutations owner read" on public.recommendation_mutations
for select to authenticated
using (owner_id = (select auth.uid()));

revoke all on public.recommendations from anon, authenticated;
grant select on public.recommendations to authenticated;
revoke insert, update, delete on public.recommendations from anon, authenticated;

revoke all on public.recommendation_evidence from anon, authenticated;
grant select on public.recommendation_evidence to authenticated;

revoke all on public.recommendation_events from anon, authenticated;
grant select on public.recommendation_events to authenticated;

revoke all on public.recommendation_preferences from anon, authenticated;
grant select, insert, update on public.recommendation_preferences to authenticated;

revoke all on public.recommendation_mutations from anon, authenticated;

create or replace function public.recommendation_transition_atomic(
  p_owner_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_recommendation_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mutation public.recommendation_mutations%rowtype;
  v_recommendation public.recommendations%rowtype;
  v_to_status text;
  v_snoozed_until timestamptz;
  v_event_payload jsonb := '{}'::jsonb;
  v_response jsonb;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 128 then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;
  if p_request_fingerprint is null or p_request_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_REQUEST_FINGERPRINT';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_RECOMMENDATION_PAYLOAD';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_owner_id::text || ':' || p_idempotency_key, 0)
  );

  select * into v_mutation
  from public.recommendation_mutations
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_mutation.request_fingerprint <> p_request_fingerprint then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    if v_mutation.response is not null then
      return v_mutation.response;
    end if;
    delete from public.recommendation_mutations where id = v_mutation.id;
  end if;

  insert into public.recommendation_mutations (
    owner_id, idempotency_key, request_fingerprint, response
  ) values (
    p_owner_id, p_idempotency_key, p_request_fingerprint, null
  );

  select r.* into v_recommendation
  from public.recommendations r
  join public.pets p on p.id = r.pet_id
  where r.id = p_recommendation_id
    and r.owner_id = p_owner_id
    and p.owner_id = p_owner_id
  for update of r;
  if not found then raise exception 'RECOMMENDATION_NOT_FOUND'; end if;

  v_to_status := case p_action
    when 'show' then 'shown'
    when 'suppress' then 'suppressed'
    when 'expire' then 'expired'
    when 'supersede' then 'superseded'
    when 'accept' then 'accepted'
    when 'snooze' then 'snoozed'
    when 'reactivate' then 'eligible'
    when 'dismiss' then 'dismissed'
    when 'complete' then 'completed'
    when 'fail' then 'failed'
    else null
  end;

  if v_to_status is null or not (
    (v_recommendation.status = 'eligible' and v_to_status in ('shown','suppressed','expired','superseded'))
    or (v_recommendation.status = 'shown' and v_to_status in ('accepted','snoozed','dismissed','expired','superseded'))
    or (v_recommendation.status = 'accepted' and v_to_status in ('completed','failed','superseded'))
    or (v_recommendation.status = 'snoozed' and v_to_status in ('eligible','dismissed','expired','superseded'))
  ) then
    raise exception 'INVALID_RECOMMENDATION_TRANSITION';
  end if;

  if p_action = 'snooze' then
    begin
      v_snoozed_until := (p_payload->>'until')::timestamptz;
    exception when others then
      raise exception 'INVALID_SNOOZE_UNTIL';
    end;
    if v_snoozed_until is null or v_snoozed_until <= pg_catalog.now() then
      raise exception 'INVALID_SNOOZE_UNTIL';
    end if;
    v_event_payload := jsonb_build_object('until', v_snoozed_until);
  elsif p_action = 'dismiss' then
    if coalesce(p_payload->>'reason', '') not in ('not_relevant','already_done','wrong_data','never_suggest') then
      raise exception 'INVALID_DISMISS_REASON';
    end if;
    v_event_payload := jsonb_build_object('reason', p_payload->>'reason');
  elsif p_action in ('complete','fail') then
    v_event_payload := jsonb_strip_nulls(jsonb_build_object(
      'domainType', p_payload->>'domainType',
      'domainId', p_payload->>'domainId',
      'occurredAt', p_payload->>'occurredAt'
    ));
  elsif p_action = 'supersede' then
    v_event_payload := jsonb_strip_nulls(jsonb_build_object(
      'replacementId', p_payload->>'replacementId'
    ));
  end if;

  update public.recommendations
  set
    status = v_to_status,
    shown_at = case when v_to_status = 'shown' then coalesce(shown_at, pg_catalog.now()) else shown_at end,
    snoozed_until = case
      when v_to_status = 'snoozed' then v_snoozed_until
      when v_to_status = 'eligible' then null
      else snoozed_until
    end,
    resolved_at = case
      when v_to_status in ('suppressed','dismissed','completed','expired','superseded','failed')
        then pg_catalog.now()
      else resolved_at
    end
  where id = p_recommendation_id;

  insert into public.recommendation_events (
    recommendation_id, event_type, from_status, to_status, payload
  ) values (
    p_recommendation_id, p_action, v_recommendation.status, v_to_status, v_event_payload
  );

  v_response := jsonb_build_object(
    'recommendationId', p_recommendation_id,
    'status', v_to_status,
    'replayed', false
  );

  update public.recommendation_mutations
  set response = v_response
  where owner_id = p_owner_id and idempotency_key = p_idempotency_key;

  return v_response;
end
$$;

revoke all on function public.recommendation_transition_atomic(
  uuid, text, text, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.recommendation_transition_atomic(
  uuid, text, text, uuid, text, jsonb
) to service_role;

revoke all on function public.recommendation_enforce_pet_owner() from public, anon, authenticated;
grant execute on function public.recommendation_enforce_pet_owner() to service_role;
